import type { LanguageCode, TranslatableContent, TranslationsRegister } from 'Types/Translation'
import type { Resource } from 'Types/Resource'
import Authentication from '../Authentication'
import ProductTranslator from './ProductTranslator'
import CollectionTranslator from './CollectionTranslator'
import ArticleTranslator from './ArticleTranslator'
import { CollectionToTranslate } from 'Types/Collection'
import { ArticleToTranslate } from 'Types/Article'
import { ProductToTranslate } from 'Types/Product'
import Utils from './Utils'

export default class Translator extends Authentication {
  private resourceHandler: ProductTranslator | CollectionTranslator | ArticleTranslator
  protected utils: Utils

  constructor(resource: Resource) {
    super()
    this.utils = new Utils()
    this.resourceHandler = this.getTranslatorHandler(resource)
  }

  public async getOutdatedTranslations() {
    return await this.resourceHandler.pullDataModeler.getResourceOutdatedTranslations()
  }

  private getTranslatorHandler(
    resource: Resource
  ): ProductTranslator | CollectionTranslator | ArticleTranslator {
    if (resource === 'product') {
      return new ProductTranslator()
    }
    if (resource === 'collection') {
      return new CollectionTranslator()
    }
    if (resource === 'article') {
      return new ArticleTranslator()
    }
    throw new Error('Resource not supported')
  }

  public async updateTranslation({
    resourceToTranslate,
    resourceTranslated,
    isoCode,
  }: {
    resourceToTranslate: TranslatableContent
    resourceTranslated: TranslatableContent
    isoCode: LanguageCode
  }) {
    return await this.updateResourceTranslation({
      resourceToTranslate,
      resourceTranslated,
      isoCode,
    })
  }

  public async updateResourceTranslation({
    resourceToTranslate,
    resourceTranslated,
    isoCode,
  }: {
    resourceToTranslate:
      | Partial<ProductToTranslate>
      | Partial<CollectionToTranslate>
      | Partial<ArticleToTranslate>
    resourceTranslated:
      | Partial<ProductToTranslate>
      | Partial<CollectionToTranslate>
      | Partial<ArticleToTranslate>
    isoCode: LanguageCode
  }) {
    try {
      const translationsToRegister = this.resourceHandler.pushDataModeler
        .formatTranslationFieldsForGraphQLMutation({
          resourceToTranslate,
          resourceTranslated,
          isoCode,
        })
        .filter((translation) => translation.translations.length > 0)
      console.log('🚀 ~ Translations to register:')
      translationsToRegister.forEach((translationToRegister) => {
        console.log(' 🚀 ~ resourceId:', translationToRegister.resourceId)
        translationToRegister.translations.forEach((translation) => {
          console.log('   🚀 ~ translation:', translation)
        })
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
      throw new Error(`Failed to update resource translation: ${error.message}`)
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
