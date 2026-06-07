import type { ProductToTranslate, ProductWithOutdatedTranslations } from 'Types/Product'
import type { LanguageCode, MetaobjectTranslation, RegionCode } from 'Types/Translation'
import DefaultPullDataModeler from '../PullDataModeler'
import Utils from '../Utils'
import English from 'App/Services/ChatGPT/Translator/Product/English'

export default class PullDataModeler extends DefaultPullDataModeler {
  private utils: Utils

  constructor() {
    super()
    this.utils = new Utils()
  }
  public async getResourceOutdatedTranslations(locale: LanguageCode = 'en', region?: RegionCode) {
    const productToTranslate = [] as Partial<ProductToTranslate>[]
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      // Get products with outdated translations without metaobject translations
      const { query, variables } = this.getProductsWithOutdatedTranslationsQuery(
        cursor,
        locale,
        region
      )
      const productsData = await this.fetchGraphQL(query, variables)
      const products = productsData.products.edges as {
        node: ProductWithOutdatedTranslations
        cursor: string
      }[]

      for (const product of products) {
        // Check if alt media is outdated
        const isAltMediaOutdated = (await this.isAltMediaOutdated(
          product.node.altTextsMetaObject?.reference?.id,
          locale
        )) as boolean

        // Check if the "short title" metafield (title.short) translation is outdated/missing.
        // This metafield is what the storefront renders on collection/product cards.
        const isShortTitleOutdated = await this.isShortTitleOutdated(
          product.node.shortTitleMetafield?.id,
          locale
        )

        const productWithOnlyKeyToTranslate = this.getProductWithOnlyKeyToTranslate(
          product.node,
          isAltMediaOutdated,
          isShortTitleOutdated,
          locale,
          region
        )
        if (productWithOnlyKeyToTranslate) {
          productToTranslate.push(productWithOnlyKeyToTranslate)
        }
      }

      hasNextPage = productsData.products.pageInfo.hasNextPage
      if (hasNextPage) {
        cursor = products[products.length - 1].cursor
      }
    }

    return productToTranslate
  }

  private getProductsWithOutdatedTranslationsQuery(
    cursor: string | null = null,
    locale: LanguageCode,
    region?: RegionCode
  ) {
    const marketId = region ? this.utils.getMarketId(region) : undefined

    return {
      query: `query AllProducts($cursor: String) {
                products(first: 250, after: $cursor, query: "published_status:published") {
                  edges {
                    node {
                      id
                      title
                      descriptionHtml
                      handle
                      shortTitleMetafield: metafield(namespace: "title", key: "short") {
                        id
                        value
                      }
                      media(first: 10) {
                        nodes {
                          id
                          alt
                        }
                      }
                      altTextsMetaObject: metafield(namespace: "meta_object", key: "media") {
                        reference {
                          ... on Metaobject {
                            id
                            field(key: "alts") {
                              jsonValue
                            }
                          }
                        }
                      }
                      options(first: 10) {
                        id
                        name
                        optionValues {
                          id
                          name
                          translations(locale: "${locale}"${marketId ? `, marketId: "${marketId}"` : ''}) {
                            key
                            locale
                            value
                            outdated
                            updatedAt
                          }
                        }
                        translations(locale: "${locale}") {
                          key
                          locale
                          value
                          outdated
                          updatedAt
                        }
                      }
                      productType
                      seo {
                        title
                        description
                      }
                      translations(locale: "${locale}") {
                        key
                        locale
                        value
                        outdated
                        updatedAt
                      }                      
                    }
                    cursor
                  }
                  pageInfo {
                    hasNextPage
                  }
                }
              }`,
      variables: { cursor },
    }
  }

  private async isAltMediaOutdated(metaobjectId: string | undefined, locale: LanguageCode = 'en') {
    if (!metaobjectId) return []

    const { query: metaobjectQuery, variables: metaobjectVariables } = this.getMetaobjectQuery(
      metaobjectId,
      locale
    )
    const metaobjectData = (await this.fetchGraphQL(
      metaobjectQuery,
      metaobjectVariables
    )) as MetaobjectTranslation

    const metaobjectEntry = metaobjectData.translatableResource.translations.filter(
      (metaobject) => metaobject.key === 'alts'
    )
    return metaobjectEntry[0]?.outdated !== undefined ? metaobjectEntry[0]?.outdated : true
  }

  private async isShortTitleOutdated(metafieldId: string | undefined, locale: LanguageCode = 'en') {
    if (!metafieldId) return false

    const { query, variables } = this.getMetaobjectQuery(metafieldId, locale)
    const data = (await this.fetchGraphQL(query, variables)) as MetaobjectTranslation

    const entry = data.translatableResource.translations.filter(
      (translation) => translation.key === 'value'
    )
    // No translation registered yet → it needs translating; otherwise use Shopify's outdated flag.
    return entry[0]?.outdated !== undefined ? entry[0].outdated : true
  }

  public getProductWithOnlyKeyToTranslate(
    product: ProductWithOutdatedTranslations,
    isAltMediaOutdated: boolean,
    isShortTitleOutdated: boolean,
    locale?: LanguageCode,
    region?: RegionCode
  ) {
    const { translations, ...productWithoutTranslations } = product

    const mutableProduct = productWithoutTranslations as {
      [key: string]: any
      seo?: { title?: string; description?: string }
    }

    // The short title lives in a metafield (separate translatable resource). Keep it only
    // when its translation is missing/outdated; drop the raw metafield wrapper either way.
    delete mutableProduct.shortTitleMetafield
    if (isShortTitleOutdated && product.shortTitleMetafield?.value) {
      mutableProduct.shortTitle = {
        id: product.shortTitleMetafield.id,
        value: product.shortTitleMetafield.value,
      }
    }

    translations.forEach((translation) => {
      const key = this.getKeyFromTranslationKey(translation.key)
      if (!translation.outdated) {
        if (key === 'seo.title') {
          delete mutableProduct.seo?.title
        }
        if (key === 'seo.description') {
          delete mutableProduct.seo?.description
        }
        delete mutableProduct[key]
      }
    })

    const processedOptions = product.options.map((option) => {
      const processedOption = this.deleteUpToDateOptionValuesFromOption(
        { ...option },
        locale,
        region
      )

      const { translations: optionTranslations, ...optionWithoutTranslations } = processedOption
      optionTranslations.forEach((translation) => {
        const key = this.getKeyFromTranslationKey(translation.key)
        if (!translation.outdated) {
          delete optionWithoutTranslations[key]
        }
      })
      return optionWithoutTranslations
    })
    mutableProduct.options = processedOptions

    const processedMedia = this.getAltMediaToTranslate(product, isAltMediaOutdated)
    delete mutableProduct.altTextsMetaObject
    mutableProduct.media = processedMedia

    const cleanedProduct = this.cleanResourceEmptyFields({ ...mutableProduct })
    return this.isEmptyField(cleanedProduct) ? null : cleanedProduct
  }

  private getKeyFromTranslationKey(key: string) {
    switch (key) {
      case 'body_html':
        return 'descriptionHtml'
      case 'product_type':
        return 'productType'
      case 'meta_title':
        return 'seo.title'
      case 'meta_description':
        return 'seo.description'
      default:
        return key
    }
  }

  private deleteUpToDateOptionValuesFromOption(
    option: ProductWithOutdatedTranslations['options'][number],
    locale?: LanguageCode,
    region?: RegionCode
  ) {
    const optionValues = option.optionValues
    const translator = locale === 'en' ? new English(region) : null

    const optionValuesCleaned = optionValues.map((optionValue) => {
      const { translations, ...optionValueWithoutTranslations } = optionValue
      translations.forEach((translation) => {
        const key = this.getKeyFromTranslationKey(translation.key)
        if (!translation.outdated) {
          delete optionValueWithoutTranslations[key]
        }
      })

      // Skip option values where the dictionary translation equals the source
      // (e.g., "Poster" → "Poster", "Aluminium" → "Aluminium")
      // These would be rejected by Shopify with "Value cannot match original content"
      if (
        translator &&
        optionValueWithoutTranslations.name &&
        translator.isKnownValue(optionValueWithoutTranslations.name) &&
        translator.translateOptionValue(optionValueWithoutTranslations.name) ===
          optionValueWithoutTranslations.name
      ) {
        delete (optionValueWithoutTranslations as { [key: string]: any }).name
      }

      // For locales without a local dictionary (de/es), option values that carry no
      // translatable words — dimensions like "40x60 cm", pure numbers — read identically
      // in every language. ChatGPT echoes them back unchanged, Shopify rejects
      // value===source, nothing is registered, and the value would be re-queued for
      // translation every night forever. Drop them here so they never enter the loop;
      // the storefront correctly falls back to the source value. en converts dimensions
      // to inches via the dictionary above, so it is intentionally excluded.
      if (
        locale !== 'en' &&
        optionValueWithoutTranslations.name &&
        this.isLanguageNeutralValue(optionValueWithoutTranslations.name)
      ) {
        delete (optionValueWithoutTranslations as { [key: string]: any }).name
      }

      return optionValueWithoutTranslations
    })

    return {
      ...option,
      optionValues: optionValuesCleaned.filter((value) => !this.isEmptyField(value)),
    }
  }

  /**
   * True when a value carries no translatable words — e.g. "40x60 cm", "40 x 60 cm",
   * "2 cm", "100x100", "2,5 cm" — so it reads identically in every language. Such values
   * must not be sent for translation: ChatGPT would echo the source, Shopify rejects
   * value===source, and the value would loop forever. Strips number+unit tokens and
   * dimension separators; if nothing but separators/spaces remains, it is language-neutral.
   */
  private isLanguageNeutralValue(value: string): boolean {
    const residual = value
      .trim()
      .toLowerCase()
      .replace(/\d+([.,]\d+)?\s*(cm|mm|m|in|inch|inches)?/g, ' ')
      .replace(/[x×*/+\-.,'"]/g, ' ')
      .replace(/\s+/g, '')
    return residual.length === 0
  }

  private getAltMediaToTranslate(
    product: ProductWithOutdatedTranslations,
    isAltMediaOutdated: boolean
  ) {
    if (!isAltMediaOutdated || !product.altTextsMetaObject) return null
    return {
      id: product.altTextsMetaObject.reference?.id,
      alts: product.altTextsMetaObject.reference?.field?.jsonValue,
    }
  }
}
