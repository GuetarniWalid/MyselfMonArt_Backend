import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Shopify from '../../services/Shopify/index'
import Env from '@ioc:Adonis/Core/Env'
import { google, content_v2_1 } from 'googleapis'
import Variants from 'App/Models/Variants'
import Mail from '@ioc:Adonis/Addons/Mail'
import isEqual from 'lodash/isEqual'
import sortBy from 'lodash/sortBy'
import omit from 'lodash/omit'
import forOwn from 'lodash/forOwn'
import isEmpty from 'lodash/isEmpty'
import Google from '../../services/Google'

export default class ShopifyFluxToMerchantCenter extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(3, 0)
  }
  /**
   * Set enable use .lock file for block run retry task
   * Lock file save to `build/tmp/adonis5-scheduler/locks/your-class-name`
   */
  public static get useLock() {
    return false
  }

  public async handle() {
    try {
      const oauth2Client = await new Google().authentication.getOauth2Client()
      const merchantCenter = google.content({
        version: 'v2.1',
        auth: oauth2Client,
      })

      // Promotions
      const promotionData = await this.getPromotionData()
      const promotions = await this.formatPromotions(promotionData)
      const promotionsToCreate = await this.filterPromotionsInMerchantCenter(
        promotions,
        merchantCenter
      )
      await this.sendPromotionsToMerchantCenter(promotionsToCreate, merchantCenter)

      // Shipping
      const shipping = (await this.getShippingDetailsInShopify()) as ShippingDetails
      const shippingFormatted = this.formatShipping(shipping)

      // Products
      const products = (await this.getProductsInShopify()) as ProductFromShopify[]
      const productsCleaned = this.cleanProducts(products)
      const productsFormatted = this.formatProducts(productsCleaned, shippingFormatted)

      const productsFormatForMerchantCenterPromises = productsFormatted.map(async (product) => {
        // @ts-ignore
        return this.getProductWithStartedPriceByMaterial(product)
      })
      const promisesResolved = await Promise.allSettled(productsFormatForMerchantCenterPromises)
      const productsFormatForMerchantCenter = promisesResolved
        .filter((result) => result.status === 'fulfilled' && result.value !== null)
        // @ts-ignore
        .flatMap((result) => result.value)

      const productOnMerchantCenter = await this.getMerchantCenterProducts(merchantCenter)
      const [productToInsert, productToUpdate] = this.compareProducts(
        // @ts-ignore
        productsFormatForMerchantCenter,
        productOnMerchantCenter
      )

      this.insertProductToMerchantCenter(productToInsert, merchantCenter)
      this.updateProductToMerchantCenter(productToUpdate, merchantCenter, productOnMerchantCenter)
    } catch (error) {
      console.error('🚀 ~ error:', error)
      this.sendEmail(error)
    }
  }

  // Shipping
  private async getShippingDetailsInShopify() {
    const shopify = new Shopify()
    const shipping = await shopify.shipping.getDefaultDetails()
    return shipping
  }

  private formatShipping(shipping: ShippingDetails) {
    const formatShipping = shipping.profileLocationGroups.map((profileLocationGroup) => {
      const allPriceByCountry = profileLocationGroup.locationGroupZones.nodes.map((node) => {
        const pricseByCouintry = node.zone.countries.map((country) => {
          const price = node.methodDefinitions.nodes[0].rateProvider.price.amount
          const currency = node.methodDefinitions.nodes[0].rateProvider.price.currencyCode
          return {
            country: country.code.countryCode,
            price: {
              value: price,
              currency,
            },
          }
        })
        return pricseByCouintry
      })
      return allPriceByCountry
    })
    return formatShipping.flat(2)
  }

  // Products on Shopify
  private async getProductWithStartedPriceByMaterial(product: ProductFormatted) {
    if (product.ratio === 'tapestry') {
      return null
    }

    const variant = await Variants.findByOrFail('name', product.ratio)
    const pricesPerMaterial = this.getPricePerMaterialForSmallerSize(variant.json)
    const { ratio, ...productCleaned } = product
    return pricesPerMaterial.map((pricePerMaterial) => {
      return {
        ...productCleaned,
        id:
          product.channel +
          ':' +
          product.contentLanguage +
          ':' +
          product.targetCountry +
          ':' +
          productCleaned.id +
          '-' +
          pricePerMaterial.materialType,
        offerId: productCleaned.id + '-' + pricePerMaterial.materialType,
        price: pricePerMaterial.price,
        title: this.formatTitleWithMaterial(productCleaned.title, pricePerMaterial.materialName),
        material: this.translateMaterial(pricePerMaterial.materialType),
      }
    })
  }

  private async getProductsInShopify() {
    const shopify = new Shopify()
    const products = await shopify.product.getAll()
    return products
  }

  private cleanProducts(products: ProductFromShopify[]) {
    return products.filter((product) => {
      return (
        product.templateSuffix === 'painting' ||
        product.templateSuffix === 'personalized' ||
        product.templateSuffix === 'tapestry'
      )
    })
  }

  private formatProducts(products: ProductFromShopify[], shipping: Shipping[]) {
    const productsFormatted = products.map((product) => {
      try {
        return {
          id: this.getIdFromShopifyProductId(product.id),
          offerId: this.getIdFromShopifyProductId(product.id),
          itemGroupId: this.getIdFromShopifyProductId(product.id),
          title: product.title,
          description: product.description,
          link: this.getProductLinkFromHandle(product.handle),
          imageLink: this.getMainImageUrlFromImages(product.images.edges),
          additionalImageLinks: this.getAdditionalImageUrlFromImages(product.images.edges),
          googleProductCategory: this.getGoogleTaxonomyIdFromTemplateSuffix(product.templateSuffix),
          productTypes: [this.getProductTypeFromMetafields(product.metafields.edges)],
          availability: 'in stock',
          contentLanguage: 'fr',
          targetCountry: 'FR',
          condition: 'new',
          brand: product.vendor,
          identifierExists: false,
          shipping,
          taxes: [
            { country: 'FR', rate: 0.2, taxShip: true },
            { country: 'CH', rate: 0.077, taxShip: true },
            { country: 'AT', rate: 0.2, taxShip: true },
            { country: 'BE', rate: 0.21, taxShip: true },
            { country: 'BG', rate: 0.2, taxShip: true },
            { country: 'HR', rate: 0.25, taxShip: true },
            { country: 'CY', rate: 0.19, taxShip: true },
            { country: 'CZ', rate: 0.21, taxShip: true },
            { country: 'DE', rate: 0.19, taxShip: true },
            { country: 'DK', rate: 0.25, taxShip: true },
            { country: 'EE', rate: 0.2, taxShip: true },
            { country: 'FI', rate: 0.24, taxShip: true },
            { country: 'GR', rate: 0.24, taxShip: true },
            { country: 'HU', rate: 0.27, taxShip: true },
            { country: 'IE', rate: 0.23, taxShip: true },
            { country: 'IT', rate: 0.22, taxShip: true },
            { country: 'LV', rate: 0.21, taxShip: true },
            { country: 'LT', rate: 0.21, taxShip: true },
            { country: 'LU', rate: 0.17, taxShip: true },
            { country: 'MT', rate: 0.18, taxShip: true },
            { country: 'NL', rate: 0.21, taxShip: true },
            { country: 'PL', rate: 0.23, taxShip: true },
            { country: 'PT', rate: 0.23, taxShip: true },
            { country: 'RO', rate: 0.19, taxShip: true },
            { country: 'SK', rate: 0.2, taxShip: true },
            { country: 'SI', rate: 0.22, taxShip: true },
            { country: 'ES', rate: 0.21, taxShip: true },
            { country: 'SE', rate: 0.25, taxShip: true },
            { country: 'GB', rate: 0.2, taxShip: true },
          ],
          ratio: this.getImageRatio(product.images.edges, product.templateSuffix),
          channel: 'online',
          productHighlights: this.getProductHilightsFromMaterial(product.templateSuffix),
        }
      } catch (error) {
        console.error('🚀 ~ error:', error)
        this.sendEmail(error)
        return null
      }
    })
    return productsFormatted.filter((product) => product !== null)
  }

  private getIdFromShopifyProductId(id: string) {
    const chunks = id.split('/')
    const lastChunk = chunks[chunks.length - 1]
    return lastChunk
  }

  private getProductLinkFromHandle(handle: string) {
    return 'https://www.myselfmonart.com/products/' + handle
  }

  private getMainImageUrlFromImages(images: ProductFromShopify['images']['edges']) {
    return images[1]?.node.url ?? images[0]?.node.url ?? ''
  }

  private getAdditionalImageUrlFromImages(images: ProductFromShopify['images']['edges']) {
    const imagesCopy = [...images]
    imagesCopy.splice(1, 1)
    if (imagesCopy.length === 1) return []
    return imagesCopy.map((image) => image.node.url)
  }

  private getGoogleTaxonomyIdFromTemplateSuffix(templateSuffix: string) {
    switch (templateSuffix) {
      case 'painting':
        return '500044'
      case 'personalized':
        return '500044'
      case 'tapestry':
        return '500045'
      default:
        return '9'
    }
  }

  private getProductTypeFromMetafields(metafields: ProductFromShopify['metafields']['edges']) {
    const motherCollectionEdge = metafields.find(
      (metafield) =>
        metafield.node.namespace === 'link' && metafield.node.key === 'mother_collection'
    )
    const motherCollectionTitle = motherCollectionEdge?.node.reference?.title
    const productType = this.formatProductTypeFromMotherCollection(motherCollectionTitle)
    return productType
  }

  private formatProductTypeFromMotherCollection(value: string | undefined): string {
    if (!value) return ''

    const keywordPatterns = [
      {
        keywords: ['Posters & Affiches', 'Poster & Affiche', 'Posters', 'Poster'],
        mainCategory: 'Posters',
      },
      {
        keywords: ['Tableaux', 'Tableau'],
        mainCategory: 'Tableaux',
      },
      {
        keywords: ['Tapisseries', 'Tapisserie'],
        mainCategory: 'Tapisseries',
      },
    ]

    for (const pattern of keywordPatterns) {
      for (const keyword of pattern.keywords) {
        if (value.includes(keyword)) {
          const index = value.indexOf(keyword) + keyword.length
          const subCategory = value.substring(index).trim()
          if (subCategory) {
            return `${pattern.mainCategory} > ${subCategory}`
          } else {
            return pattern.mainCategory
          }
        }
      }
    }

    return value
  }

  private getImageRatio(images: ProductFromShopify['images']['edges'], templateSuffix: string) {
    if (templateSuffix === 'tapestry') {
      return 'tapestry' as const
    } else if (templateSuffix === 'personalized') {
      return 'personalized portrait' as const
    } else {
      const image = images[1].node
      return image.height > image.width
        ? ('portrait' as const)
        : image.height < image.width
          ? ('landscape' as const)
          : ('square' as const)
    }
  }

  private getPricePerMaterialForSmallerSize(
    data: PaintingJson
  ): { price: { value: string; currency: string }; materialName: string; materialType: string }[] {
    const sizePrice = data[0].price as number
    return data[0].children.map((material) => {
      return {
        price: {
          value: (sizePrice + material.price).toFixed(2),
          currency: 'EUR',
        },
        materialType: material.technicalName,
        materialName: material.name,
      }
    })
  }

  private formatTitleWithMaterial(title: string, material: string) {
    if (material === 'Poster') {
      const titleWithouAffiche = title.replace(/Affiche /gi, '')
      const titleWithoutPoster = titleWithouAffiche.replace(/Poster /gi, '')
      const titleWithoutTableau = titleWithoutPoster.replace(/Tableau /gi, '')
      const titleWithoutToile = titleWithoutTableau.replace(/Toile /gi, '')
      const titleWithoutAluminium = titleWithoutToile.replace(/Aluminium /gi, '')
      const titleWithoutPlexiglass = titleWithoutAluminium.replace(/Plexiglass /gi, '')
      const titleWithoutPlexiglas = titleWithoutPlexiglass.replace(/Plexiglas /gi, '')
      const titleWithoutEt = titleWithoutPlexiglas.replace(/^et /, '')

      const titleToFormat = `Affiche et Poster ${titleWithoutEt} | Art Moderne & Design Unique | Idéal pour Déco Intérieure`
      return this.formatFinalTitle(titleToFormat)
    }
    return `${title} en ${material} | Art Moderne & Design Unique | Idéal pour Déco Intérieure`
  }

  private translateMaterial(material: string) {
    switch (material) {
      case 'poster':
        return 'Affiche & Poster'
      case 'canvas':
        return 'Toile'
      case 'aluminium':
        return 'Aluminium'
      case 'aluminium-plexi':
        return 'Plexiglass'
      default:
        return material
    }
  }

  private formatFinalTitle(title: string) {
    title = title.replace(/\s{2,}/g, ' ')
    const match = title.match(/^([\s\S]*?)(\s*\|[\s\S]*)?$/) as RegExpMatchArray
    let firstPart = match[1] as string
    const rest = match[2] || ''
    firstPart = firstPart.replace(/\s*:\s*/g, ' ')
    firstPart = firstPart.replace(/\s{2,}/g, ' ').trim()
    const words = firstPart.split(' ')

    const capitalizedWords = words.map((word) => {
      const parts = word.split(/(['’])/)
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] && /\p{L}/u.test(parts[i].charAt(0))) {
          parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].slice(1).toLowerCase()
        }
      }
      return parts.join('')
    })

    const formattedFirstPart = capitalizedWords.join(' ')

    // Reconstruire le titre formaté
    return formattedFirstPart + rest
  }

  private getProductHilightsFromMaterial(templateSuffix: string) {
    if (templateSuffix === 'tapestry') {
      return [
        'Impression haute qualité, pour des couleurs vives et des détails impeccables',
        'Tissu léger et résistant, facile à installer et durable dans le temps',
        'Facile à poser, sans outils spécifiques, pour une transformation rapide de votre espace',
        'Fabriqué en Europe, garantissant une production de qualité supérieure',
        'Personnalisez votre espace, avec une décoration audacieuse qui reflète votre personnalité et votre créativité',
        'Idéal pour toutes les pièces, des salons aux chambres, en passant par les bureaux, pour créer une atmosphère unique',
      ]
    }
    return [
      'Tableau de haute qualité, durable et résistante pour un rendu exceptionnel',
      'Encres premium, offrant des couleurs éclatantes et fidèles à l’image',
      'Image en haute résolution, pour des détails nets et précis',
      'Fabriqué en Europe, garantissant un processus de production respectueux des normes',
      'Idéal pour la décoration intérieure, apportant une touche d’élégance et de modernité',
      'Installation facile, compatible avec divers supports muraux',
    ]
  }

  // Products on Merchant Center
  private async getMerchantCenterProducts(merchantCenter: content_v2_1.Content) {
    let thereArePproductsLeft = true
    let nextPageToken: string | undefined
    const products = [] as content_v2_1.Schema$Product[]

    while (thereArePproductsLeft) {
      const { next25Products, nextPageToken: nextPageTokenReceive } =
        await this.get25MerchantCenterProducts(merchantCenter, nextPageToken)

      products.push(...next25Products)
      thereArePproductsLeft = !!nextPageTokenReceive
      nextPageToken = nextPageTokenReceive
    }

    return products
  }

  private async get25MerchantCenterProducts(
    merchantCenter: content_v2_1.Content,
    nextPageTokenToSend: string | undefined
  ) {
    const response = await merchantCenter.products.list({
      merchantId: Env.get('ID_MERCHANT_CENTER'),
      pageToken: nextPageTokenToSend,
    })
    const next25Products = response.data.resources ?? []
    const nextPageToken = response.data.nextPageToken ?? undefined
    return { next25Products, nextPageToken }
  }

  private async insertProductToMerchantCenter(
    products: content_v2_1.Schema$Product[],
    merchantCenter: content_v2_1.Content
  ) {
    let productsCount = 0
    const promises = products.map(async (product) => {
      const response = await merchantCenter.products.insert({
        merchantId: Env.get('ID_MERCHANT_CENTER'),
        requestBody: product,
      })
      productsCount++
      return response.data
    })
    const promisesResolved = await Promise.allSettled(promises)
    const errors = promisesResolved.filter((result) => result.status === 'rejected')
    if (errors.length) {
      console.error('errors:', errors)
      throw new Error(JSON.stringify(errors))
    }
    console.log(`${productsCount} products successfully sent to Merchant Center at :`, new Date())
  }

  private async updateProductToMerchantCenter(
    products: content_v2_1.Schema$Product[],
    merchantCenter: content_v2_1.Content,
    productsOnMerchantCenter: content_v2_1.Schema$Product[]
  ) {
    const merchantId = Env.get('ID_MERCHANT_CENTER') as string
    let productsToUpdateCount = 0

    const promises = products.map(async (product) => {
      const productOnMerchantCenter = productsOnMerchantCenter.find((p) => p.id === product.id)

      const attributesToUpdate = this.getAttributesThatHaveChanged(product, productOnMerchantCenter)

      if (isEmpty(attributesToUpdate)) {
        return
      }

      console.log('Attributes to update for product:', product.id, attributesToUpdate)
      const response = await merchantCenter.products.update({
        merchantId: merchantId,
        productId: product.id as string,
        requestBody: attributesToUpdate,
      })
      productsToUpdateCount++

      return response.data
    })

    const promisesResolved = await Promise.allSettled(promises)
    const errors = promisesResolved.filter((result) => result.status === 'rejected')
    if (errors.length) {
      console.error('errors:', errors)
    }
    if (productsToUpdateCount > 0) {
      console.log(
        `${productsToUpdateCount} products successfully updated in Merchant Center at:`,
        new Date()
      )
    } else {
      console.log('No products to update in Merchant Center')
    }
  }

  // Compare products
  private compareProducts(
    products: ProductFormatted[],
    productsOnMerchantCenter: content_v2_1.Schema$Product[]
  ) {
    const productToInsert = [] as ProductFormatted[]
    const productToUpdate = [] as ProductFormatted[]

    products.forEach((product) => {
      const productIsOnMerchantCenter = productsOnMerchantCenter.find(
        (productOnMerchantCenter) => productOnMerchantCenter.id === product.id
      )
      if (productIsOnMerchantCenter) {
        productToUpdate.push(product)
      } else {
        productToInsert.push(product)
      }
    })

    return [productToInsert, productToUpdate]
  }

  private getAttributesThatHaveChanged(
    product: content_v2_1.Schema$Product,
    productOnMerchantCenter?: content_v2_1.Schema$Product
  ) {
    if (!productOnMerchantCenter) {
      return product
    }

    const preparedProduct = this.prepareProductForComparison(product)
    const preparedProductOnMerchantCenter =
      this.prepareProductForComparison(productOnMerchantCenter)

    if (isEqual(preparedProduct, preparedProductOnMerchantCenter)) {
      return {}
    }

    const attributesToUpdate: Partial<content_v2_1.Schema$Product> = {}
    forOwn(preparedProduct, (newValue, key) => {
      const oldValue = preparedProductOnMerchantCenter[key]

      if (!isEqual(newValue, oldValue)) {
        attributesToUpdate[key] = newValue
      }
    })

    return attributesToUpdate
  }

  private prepareProductForComparison(product: content_v2_1.Schema$Product) {
    const productToCompare = omit(product, ['kind', 'feedLabel', 'source'])
    if (productToCompare.shipping) {
      productToCompare.shipping = sortBy(productToCompare.shipping, ['country'])
    }
    if (product.taxes) {
      productToCompare.taxes = sortBy(productToCompare.taxes, ['country'])
    }
    return productToCompare
  }

  // Promotions
  private async getPromotionData() {
    const shopify = new Shopify()
    const discounts = (await shopify.discount.getDiscounts()) as DiscountFromShopify[]
    return discounts
  }

  private async formatPromotions(
    promotionData: DiscountFromShopify[]
  ): Promise<content_v2_1.Schema$Promotion[]> {
    const promises = promotionData.map(async (promotion) => {
      let discount
      if ('percentage' in promotion.automaticDiscount.customerGets.value) {
        discount = {
          percentOff: promotion.automaticDiscount.customerGets.value.percentage * 100,
          couponValueType: 'PERCENT_OFF' as const,
        }
      } else if ('amount' in promotion.automaticDiscount.customerGets.value) {
        discount = {
          moneyOffAmount: {
            value: promotion.automaticDiscount.customerGets.value.amount.amount,
            currency: promotion.automaticDiscount.customerGets.value.amount.currencyCode,
          },
          couponValueType: 'MONEY_OFF' as const,
        }
      } else {
        throw new Error('Invalid discount type')
      }

      return {
        promotionId: promotion.automaticDiscount.title,
        targetCountry: 'FR',
        contentLanguage: 'fr',
        productApplicability: 'ALL_PRODUCTS' as const,
        offerType: 'NO_CODE' as const,
        longTitle: await this.translateText(promotion.automaticDiscount.shortSummary),
        redemptionChannel: ['ONLINE'],
        promotionEffectiveTimePeriod: {
          startTime: promotion.automaticDiscount.startsAt,
          endTime: promotion.automaticDiscount.endsAt,
        },
        ...discount,
      }
    })
    const promisesResolved = (await Promise.allSettled(
      promises
    )) as PromiseSettledResult<content_v2_1.Schema$Promotion>[]
    return (
      promisesResolved
        .filter((result) => result.status === 'fulfilled')
        // @ts-ignore
        .map((result) => result.value)
    )
  }

  private async filterPromotionsInMerchantCenter(
    promotions: content_v2_1.Schema$Promotion[],
    merchantCenter: content_v2_1.Content
  ) {
    const existingPromotions = await this.getExistingPromotions(merchantCenter)
    return promotions.filter((promotion) => {
      return !existingPromotions.find(
        (existingPromotion) => existingPromotion.promotionId === promotion.promotionId
      )
    })
  }

  private async getExistingPromotions(merchantCenter: content_v2_1.Content) {
    const response = await merchantCenter.promotions.list({
      merchantId: Env.get('ID_MERCHANT_CENTER'),
    })
    return response.data.promotions ?? []
  }

  private async translateText(text: string, targetLang: 'fr' | 'en' = 'fr') {
    try {
      const response = (await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${Env.get('GOOGLE_API_KEY')}`,
        {
          method: 'POST',
          body: JSON.stringify({ q: text, target: targetLang }),
        }
      )) as any
      const json = await response.json()
      const translation = json.data.translations[0].translatedText
      return translation
    } catch (error) {
      console.error(
        'Erreur lors de la traduction :',
        error.response ? error.response.data : error.message
      )
      throw error
    }
  }

  private async sendPromotionsToMerchantCenter(
    promotions: content_v2_1.Schema$Promotion[],
    merchantCenter: content_v2_1.Content
  ) {
    if (promotions.length === 0) {
      console.log('No promotions to send to Merchant Center')
      return
    }

    try {
      const promises = promotions.map(async (promotion) => {
        const response = await merchantCenter.promotions.create({
          merchantId: Env.get('ID_MERCHANT_CENTER'),
          requestBody: promotion,
        })
        return response.data
      })
      const promisesResolved = await Promise.allSettled(promises)
      const errors = promisesResolved.filter((result) => result.status === 'rejected')
      if (errors.length) {
        console.log('🚀 ~ errors:', errors)
        throw new Error(JSON.stringify(errors))
      }
      console.log('Promotions successfully sent to Merchant Center at :', new Date())
    } catch (error) {
      this.sendEmail(error)
    }
  }

  // Email
  private async sendEmail(error: Error) {
    await Mail.send((message) => {
      message
        .to(Env.get('MAIL_RECIPIENT'))
        .from(Env.get('MAIL_SENDER'))
        .subject('Problème dans le flux Shopify vers Merchant Center')
        .text(
          `An error occurred in the flux from Shopify to Google Merchant Center : ${error.message}`
        )
    })
  }
}

interface ProductFromShopify {
  id: string
  title: string
  description: string
  handle: string
  images: {
    edges: {
      node: {
        height
        width
        url: string
      }
    }[]
  }
  templateSuffix: string
  metafields: {
    edges: {
      node: {
        namespace: string
        key: string
        reference?: {
          title: string
        }
      }
    }[]
  }
  vendor: string
}

interface ShippingDetails {
  name: string
  default: boolean
  profileLocationGroups: {
    locationGroupZones: {
      nodes: {
        methodDefinitions: {
          nodes: {
            rateProvider: {
              price: {
                amount: string
                currencyCode: string
              }
            }
          }[]
        }
        zone: {
          countries: {
            code: {
              countryCode: string
            }
          }[]
        }
      }[]
    }
  }[]
}

interface Shipping {
  country: string
  price: {
    value: string
    currency: string
  }
}

interface ProductFormatted {
  id: string
  offerId: string
  title: string
  description: string
  material?: string
  link: string
  imageLink: string
  additionalImageLinks: string[]
  googleProductCategory: string
  productTypes: string[]
  availability: string
  contentLanguage: string
  targetCountry: string
  condition: string
  brand: string
  identifierExists: boolean
  itemGroupId?: string
  shipping: Shipping[]
  taxes: {
    country: string
    rate: number
    taxShip: boolean
  }[]
  ratio: 'tapestry' | 'landscape' | 'square' | 'personalized portrait' | 'portrait'
  price?: {
    value: string
    currency: string
  }
  channel: string
  productHighlights?: string[]
}

interface DiscountFromShopify {
  automaticDiscount: {
    startsAt: string
    endsAt: string
    shortSummary: string
    title: string
    customerGets: {
      value: { percentage: number } | { amount: { amount: string; currencyCode: string } }
    }
  }
}
