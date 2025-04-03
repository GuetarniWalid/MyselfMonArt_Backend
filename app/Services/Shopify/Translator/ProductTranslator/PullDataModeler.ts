import type { ProductToTranslate, ProductWithOutdatedTranslations } from 'Types/Product'
import type { LanguageCode, MetaobjectTranslation } from 'Types/Translation'
import DefaultPullDataModeler from '../PullDataModeler'

export default class PullDataModeler extends DefaultPullDataModeler {
  public async getResourceOutdatedTranslations() {
    const productToTranslate = [] as Partial<ProductToTranslate>[]
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      // Get products with outdated translations without metaobject translations
      const { query, variables } = this.getProductsWithOutdatedTranslationsQuery(cursor)
      const productsData = await this.fetchGraphQL(query, variables)
      const products = productsData.products.edges as {
        node: ProductWithOutdatedTranslations
        cursor: string
      }[]

      for (const product of products) {
        // Check if alt media is outdated
        const isAltMediaOutdated = (await this.isAltMediaOutdated(
          product.node.altTextsMetaObject?.reference?.id
        )) as boolean

        const productWithOnlyKeyToTranslate = this.getProductWithOnlyKeyToTranslate(
          product.node,
          isAltMediaOutdated
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
    locale: LanguageCode = 'en'
  ) {
    return {
      query: `query GetUpdatedProducts($cursor: String) {
                products(first: 250, after: $cursor, query: "published_status:published") {
                  edges {
                    node {
                      id
                      title
                      descriptionHtml
                      handle
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
                          translations(locale: "${locale}") {
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

  private async isAltMediaOutdated(metaobjectId: string | undefined) {
    if (!metaobjectId) return []

    const { query: metaobjectQuery, variables: metaobjectVariables } = this.getMetaobjectQuery(
      metaobjectId,
      'en'
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

  public getProductWithOnlyKeyToTranslate(
    product: ProductWithOutdatedTranslations,
    isAltMediaOutdated: boolean
  ) {
    const { translations, ...productWithoutTranslations } = product

    const mutableProduct = productWithoutTranslations as {
      [key: string]: any
      seo?: { title?: string; description?: string }
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
      const processedOption = this.deleteUpToDateOptionValuesFromOption({ ...option })

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
    option: ProductWithOutdatedTranslations['options'][number]
  ) {
    const optionValues = option.optionValues

    const optionValuesCleaned = optionValues.map((optionValue) => {
      const { translations, ...optionValueWithoutTranslations } = optionValue
      translations.forEach((translation) => {
        const key = this.getKeyFromTranslationKey(translation.key)
        if (!translation.outdated) {
          delete optionValueWithoutTranslations[key]
        }
      })
      return optionValueWithoutTranslations
    })

    return {
      ...option,
      optionValues: optionValuesCleaned.filter((value) => !this.isEmptyField(value)),
    }
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
