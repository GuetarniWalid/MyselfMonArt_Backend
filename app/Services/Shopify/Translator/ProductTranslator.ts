import type { ProductToTranslate } from 'Types/Product'
import type { LanguageCode, TranslationInput, TranslationsRegister } from 'Types/Translation'
import Authentication from '../Authentication'
import Utils from './Utils'

export default class ProductTranslator extends Authentication {
  private utils: Utils

  constructor() {
    super()
    this.utils = new Utils()
  }

  public async getResourceOutdatedTranslations() {
    const updatedProducts = [] as ProductToTranslate[]
    let cursor = null
    let hasNextPage = true

    while (hasNextPage) {
      const { query, variables } = this.getProductsWithOutdatedTranslationsQuery(cursor)
      const productsData = await this.fetchGraphQL(query, variables)
      const products = productsData.products.edges
      products.forEach((product) => updatedProducts.push(product.node))
      hasNextPage = productsData.products.pageInfo.hasNextPage
      if (hasNextPage) {
        cursor = products[products.length - 1].cursor
      }
    }

    return updatedProducts
  }

  public getProductsWithOutdatedTranslationsQuery(cursor: string | null = null) {
    return {
      query: `query GetUpdatedProducts($cursor: String) {
                    products(first: 250, after: $cursor, query: "published_status:published AND translations.outdated:true") {
                      edges {
                        node {
                          id
                          title
                          descriptionHtml
                          handle
                          productType
                          options(first: 10) {
                            optionValues {
                              id
                              name
                            }
                          }
                          seo {
                            title
                            description
                          }
                          media(first: 10, query: "media_type:IMAGE") {
                            nodes {
                              id
                              alt
                            }
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

  private formatTranslationFieldsForGraphQLMutation({
    productToTranslate,
    productTranslated,
    isoCode,
  }: {
    productToTranslate: ProductToTranslate
    productTranslated: ProductToTranslate
    isoCode: LanguageCode
  }): TranslationsRegister[] {
    const productTranslationInputs = [] as TranslationInput[]
    const translationEntriesForOptions = [] as TranslationsRegister[]

    for (const key in productToTranslate) {
      if (key === 'id') {
        continue
      }
      const oldValue = productToTranslate[key]
      const newValue = productTranslated[key]

      // Handle nested SEO object
      if (key === 'seo' && typeof newValue === 'object') {
        this.createTranslationEntryForSEO({
          isoCode,
          newSeoData: newValue,
          oldSeoData: oldValue,
          translationInputs: productTranslationInputs,
        })
        continue
      }

      // Handle nested media object
      if (key === 'media' && typeof newValue === 'object') {
        // TODO: Implement logic to create translation entries for media
        continue
      }

      // Handle nested options object
      if (key === 'options' && typeof newValue === 'object') {
        this.createTranslationEntryForOptions({
          isoCode,
          newOptionsData: newValue,
          oldOptionsData: oldValue,
          translationEntriesForOptions,
        })
        continue
      }

      this.utils.createTranslationEntry(
        {
          key: this.defineTranslationKey(key),
          isoCode,
          newValue: newValue,
          oldValue: oldValue,
        },
        productTranslationInputs
      )
    }

    return [
      {
        resourceId: productToTranslate.id,
        translations: productTranslationInputs,
      },
      ...translationEntriesForOptions,
    ]
  }

  private createTranslationEntryForSEO({
    isoCode,
    newSeoData,
    oldSeoData,
    translationInputs,
  }: {
    isoCode: LanguageCode
    newSeoData: ProductToTranslate['seo']
    oldSeoData: ProductToTranslate['seo']
    translationInputs: TranslationInput[]
  }): void {
    for (const seoKey in newSeoData) {
      const key = seoKey === 'title' ? 'meta_title' : 'meta_description'
      this.utils.createTranslationEntry(
        {
          key: key,
          isoCode,
          newValue: newSeoData[seoKey],
          oldValue: oldSeoData[seoKey],
        },
        translationInputs
      )
    }
  }

  private createTranslationEntryForOptions({
    isoCode,
    newOptionsData,
    oldOptionsData,
    translationEntriesForOptions,
  }: {
    isoCode: LanguageCode
    newOptionsData: ProductToTranslate['options']
    oldOptionsData: ProductToTranslate['options']
    translationEntriesForOptions: TranslationsRegister[]
  }): void {
    for (const [index, option] of newOptionsData.entries()) {
      for (const [indexOptionValue, optionValue] of option.optionValues.entries()) {
        const translationInput = [] as TranslationInput[]

        this.utils.createTranslationEntry(
          {
            key: 'name',
            isoCode,
            newValue: optionValue.name,
            oldValue: oldOptionsData[index].optionValues[indexOptionValue].name,
          },
          translationInput
        )

        const TranslationEntryForOption = {
          resourceId: optionValue.id,
          translations: translationInput,
        }
        translationEntriesForOptions.push(TranslationEntryForOption)
      }
    }
  }

  private defineTranslationKey(key: string): string {
    switch (key) {
      case 'descriptionHtml':
        return 'body_html'
      case 'productType':
        return 'product_type'
      default:
        return key
    }
  }

  public async updateResourceTranslation({
    productToTranslate,
    productTranslated,
    isoCode,
  }: {
    productToTranslate: ProductToTranslate
    productTranslated: ProductToTranslate
    isoCode: LanguageCode
  }) {
    try {
      const translationsToRegister = this.formatTranslationFieldsForGraphQLMutation({
        productToTranslate,
        productTranslated,
        isoCode,
      })
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
}
