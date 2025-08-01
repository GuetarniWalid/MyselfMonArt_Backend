import { Product, ProductById, ProductByTag } from 'Types/Product'
import Shopify from '..'
import ChatGPT from 'App/Services/ChatGPT'
import { LanguageCode, RegionCode } from 'Types/Translation'

export default class ModelCopier {
  public async copyModelDataOnProduct(product: ProductById, model: ProductByTag) {
    await this.deleteProductOptions(product)
    await this.copyModelOptions(product, model)
    await this.copyModelVariants(product, model)
    await this.copyModelMetafields(product, model)
    await this.translateProductOptionsInAllLanguages(product)
  }

  private async deleteProductOptions(product: ProductById) {
    const shopify = new Shopify()
    await shopify.product.deleteAllOptions(product.id)
  }

  private async copyModelOptions(product: ProductById, model: ProductByTag) {
    const shopify = new Shopify()
    await shopify.product.createOptions(
      product.id,
      model.options.map((option) => ({
        name: option.name,
        values: option.values,
      }))
    )
  }

  private async copyModelVariants(product: ProductById, model: ProductByTag) {
    const shopify = new Shopify()

    const modelVariants = model.variants.nodes
    if (!modelVariants) return

    const defaultVariant = product.variants.nodes[0]
    const variants = modelVariants.map((variant) => ({
      price: variant.price,
      optionValues: variant.selectedOptions.map((option) => ({
        name: option.value,
        optionName: option.name,
      })),
    }))

    const [defaultModelVariant, ...variantsWithoutDefault] = variants
    await shopify.product.updateVariant(product.id, defaultVariant.id, {
      price: defaultModelVariant.price,
    })
    await shopify.product.createVariantsBulk(product.id, variantsWithoutDefault)
  }

  private async copyModelMetafields(product: ProductById, model: ProductByTag) {
    const shopify = new Shopify()

    for (const metafield of model.paintingOptionsMetafields.nodes) {
      await shopify.metafield.update(
        product.id,
        metafield.namespace,
        metafield.key,
        JSON.stringify(metafield.references.edges.map((edge) => edge.node.id))
      )
    }
  }

  private async translateProductOptionsInAllLanguages(product: ProductById) {
    await this.translateProductOptions(product, 'en')
    await this.translateProductOptions(product, 'en', 'UK')
  }

  private async translateProductOptions(
    product: ProductById,
    locale: LanguageCode,
    region?: RegionCode
  ) {
    console.info(
      `🚀 Translating product options: ${product.id} to ${locale}${region ? `-${region}` : ''}`
    )
    const shopify = new Shopify()
    const chatGPT = new ChatGPT()

    const updatedProduct = await shopify.product.getProductById(product.id)

    const productToTranslate = {
      id: updatedProduct.id,
      options: updatedProduct.options.map((option) => ({
        id: option.id,
        name: option.name,
        optionValues: option.optionValues.map((value) => ({
          id: value.id,
          name: value.name,
        })),
      })),
    }

    const productTranslated = await chatGPT.translate(productToTranslate, 'product', locale, region)

    const responses = await shopify.translator('product').updateTranslation({
      resourceToTranslate: productToTranslate,
      resourceTranslated: productTranslated,
      isoCode: locale,
      region,
    })

    responses.forEach((response) => {
      if (response.translationsRegister.userErrors.length > 0) {
        console.log('🚨 Error => ', response.translationsRegister.userErrors)
      } else {
        console.log('✅ Translation updated')
      }
    })
  }

  public isModelProduct(product: ProductById | Product): boolean {
    return product.tags.some((tag) =>
      ['portrait model', 'paysage model', 'square model', 'personalized portrait model'].includes(
        tag
      )
    )
  }

  public canProcessPaintingCreate(product: ProductById | Product): boolean {
    if (!product) return false
    if (this.isModelProduct(product)) return false
    if (product.templateSuffix !== 'painting' && product.templateSuffix !== 'personalized')
      return false
    if (product.media.nodes.length < 1) return false
    if (!product.media.nodes[1].image) return false
    return true
  }

  public async waitForMediaImages(
    product: ProductById | Product,
    maxRetries: number = 5,
    delayMs: number = 2000
  ): Promise<boolean> {
    console.info(`🔄 Waiting for media images to load for product ${product.id}`)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Check if media images are loaded
      const hasImages = product.media.nodes.length > 0 && product.media.nodes[1]?.image !== null

      if (hasImages) {
        console.info(
          `✅ Media images loaded successfully for product ${product.id} on attempt ${attempt}`
        )
        return true
      }

      console.info(
        `⏳ Media images not ready for product ${product.id}, attempt ${attempt}/${maxRetries}`
      )

      if (attempt < maxRetries) {
        console.info(`⏳ Waiting ${delayMs}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))

        // Refresh product data to get updated media
        try {
          const shopify = new Shopify()
          const refreshedProduct = await shopify.product.getProductById(product.id)
          Object.assign(product, refreshedProduct)
        } catch (error) {
          console.warn(`⚠️ Failed to refresh product data on attempt ${attempt}:`, error.message)
        }
      }
    }

    console.warn(
      `❌ Media images failed to load after ${maxRetries} attempts for product ${product.id}`
    )
    return false
  }

  public async areMediaImagesLoaded(product: ProductById | Product): Promise<boolean> {
    if (!product) return false
    if (this.isModelProduct(product)) return false
    if (product.templateSuffix !== 'painting' && product.templateSuffix !== 'personalized')
      return false
    if (product.media.nodes.length < 1) return false

    // Wait for media images to be loaded
    const mediaLoaded = await this.waitForMediaImages(product)
    if (!mediaLoaded) {
      console.warn(`⚠️ Cannot process product ${product.id} - media images not available`)
      return false
    }

    if (!product.media.nodes[1].image) return false
    return true
  }

  public async copyModelDataFromImageRatio(product: ProductById) {
    const model = await this.getModelFromProduct(product)
    if (!model) return
    await this.copyModelDataOnProduct(product, model)
  }

  public async getModelFromProduct(product: ProductById) {
    const image = product.media.nodes[1]?.image
    if (!image) return

    const imageWidth = image.width
    const imageHeight = image.height
    const ratio = imageWidth / imageHeight

    const isPersonalized = product.tags.includes('personnalisé')

    const shopify = new Shopify()
    const tag = shopify.product.getTagByRatio(ratio, isPersonalized)
    const model = await shopify.product.getProductByTag(tag)
    return model
  }

  public getTagFromModel(product: ProductById | Product) {
    const tag = product.tags.find((tag) =>
      ['portrait model', 'paysage model', 'square model', 'personalized portrait model'].includes(
        tag
      )
    )
    if (!tag) throw new Error('Model tag not found')

    return tag
  }

  public getTagFromProduct(product: ProductById | Product) {
    const shopify = new Shopify()
    const image = product.media.nodes[1]?.image
    if (!image) {
      console.log(`No image found for product ${product.id}`)
      return null
    }

    const ratio = image.width / image.height
    const isPersonalized = product.tags.includes('personnalisé')
    const tag = shopify.product.getTagByRatio(ratio, isPersonalized)
    return tag
  }

  public areOptionsSimilar(product: ProductById, model: ProductByTag): boolean {
    if (!product.options || !model.options) return false
    if (product.options.length !== model.options.length) return false

    return product.options.every((productOption, index) => {
      const modelOption = model.options[index]

      if (productOption.name !== modelOption.name) return false
      if (productOption.optionValues.length !== modelOption.values.length) return false

      return productOption.optionValues.every((value) => modelOption.values.includes(value.name))
    })
  }

  public areVariantsSimilar(product: ProductById, model: ProductByTag): boolean {
    if (!product.variants?.nodes || !model.variants?.nodes) return false
    if (product.variants.nodes.length !== model.variants.nodes.length) return false

    return product.variants.nodes.every((productVariant) => {
      const matchingModelVariant = model.variants.nodes.find((modelVariant) => {
        if (productVariant.price !== modelVariant.price) return false

        const optionsMatch = productVariant.selectedOptions.every((productOption) => {
          const hasMatchingOption = modelVariant.selectedOptions.some(
            (modelOption) =>
              modelOption.name === productOption.name && modelOption.value === productOption.value
          )
          if (!hasMatchingOption) return false
          return hasMatchingOption
        })

        return optionsMatch
      })

      return !!matchingModelVariant
    })
  }

  public areMetafieldsSimilar(product: ProductById, model: ProductByTag): boolean {
    if (!product.paintingOptionsMetafields?.nodes || !model.paintingOptionsMetafields?.nodes)
      return false
    if (
      product.paintingOptionsMetafields.nodes.length !==
      model.paintingOptionsMetafields.nodes.length
    )
      return false

    return product.paintingOptionsMetafields.nodes.every((productMetafield) => {
      const matchingModelMetafield = model.paintingOptionsMetafields.nodes.find(
        (modelMetafield) => {
          if (productMetafield.namespace !== modelMetafield.namespace) return false
          if (productMetafield.key !== modelMetafield.key) return false

          const productReferences = productMetafield.references.edges.map((edge) => edge.node.id)
          const modelReferences = modelMetafield.references.edges.map((edge) => edge.node.id)

          if (productReferences.length !== modelReferences.length) return false

          return productReferences.every((id) => modelReferences.includes(id))
        }
      )

      return !!matchingModelMetafield
    })
  }
}
