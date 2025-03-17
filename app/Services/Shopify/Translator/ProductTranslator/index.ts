import type { ProductToTranslate, ProductWithOutdatedTranslations } from 'Types/Product'
import type { LanguageCode, TranslationsRegister, MetaobjectTranslation } from 'Types/Translation'
import Authentication from '../../Authentication'
import PullDataModeler from './PullDataModeler'
import PushDataModeler from './PushDataModeler'

export default class ProductTranslator extends Authentication {
  private pullDataModeler: PullDataModeler
  private pushDataModeler: PushDataModeler

  constructor() {
    super()
    this.pullDataModeler = new PullDataModeler()
    this.pushDataModeler = new PushDataModeler()
  }

  public async getResourceOutdatedTranslations() {
    const productToTranslate = [] as any[]
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

        const productWithOnlyKeyToTranslate = this.pullDataModeler.getProductWithOnlyKeyToTranslate(
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

  public async updateResourceTranslation({
    resourceToTranslate: productToTranslate,
    resourceTranslated: productTranslated,
    isoCode,
  }: {
    resourceToTranslate: Partial<ProductToTranslate>
    resourceTranslated: Partial<ProductToTranslate>
    isoCode: LanguageCode
  }) {
    try {
      const translationsToRegister = this.pushDataModeler
        .formatTranslationFieldsForGraphQLMutation({
          productToTranslate,
          productTranslated,
          isoCode,
        })
        .filter((translation) => translation.translations.length > 0)
      let responses = [] as any[]

      for (const translations of translationsToRegister) {
        const { query, variables } = this.updateTranslationQuery(translations)
        const response = await this.fetchGraphQL(query, variables)
        responses.push(response)

        if (!response || response.errors) {
          throw new Error(JSON.stringify(response?.errors))
        }
      }
      return responses
    } catch (error) {
      throw new Error(`Failed to update product translation: ${error.message}`)
    }
  }

  private updateTranslationQuery(translationsToRegister: TranslationsRegister) {
    return {
      query: `mutation TranslationsRegister($resourceId: ID!, $translations: [TranslationInput!]!) {
          translationsRegister(resourceId: $resourceId, translations: $translations) {
            translations {
              key
              locale
              value
            }
            userErrors {
              field
              message
            }
          }
        }`,
      variables: translationsToRegister,
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

  private getMetaobjectQuery(metaobjectId: string, locale: LanguageCode) {
    return {
      query: `query GetMetaobject($id: ID!) {
        translatableResource(resourceId: $id) {
          translations(locale: "${locale}") {
            key
            locale
            value
            outdated
            updatedAt
          }
        }
      }`,
      variables: { id: metaobjectId },
    }
  }
}
