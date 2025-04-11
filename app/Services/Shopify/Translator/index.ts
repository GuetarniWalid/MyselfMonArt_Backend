import type { LanguageCode, TranslatableContent, TranslationsRegister } from 'Types/Translation'
import type { Resource } from 'Types/Resource'
import type { ArticleToTranslate } from 'Types/Article'
import type { BlogToTranslate } from 'Types/Blog'
import type { CollectionToTranslate } from 'Types/Collection'
import type { ModelToTranslate } from 'Types/Model'
import type { PageToTranslate } from 'Types/Page'
import type { ProductToTranslate } from 'Types/Product'
import type { StaticSectionToTranslate } from 'Types/StaticSection'
import Authentication from '../Authentication'
import ArticleTranslator from './ArticleTranslator'
import BlogTranslator from './BlogTranslator'
import CollectionTranslator from './CollectionTranslator'
import ModelTranslator from './ModelTranslator'
import PageTranslator from './PageTranslator'
import ProductTranslator from './ProductTranslator'
import StaticSectionTranslator from './StaticSectionTranslator'
import Utils from './Utils'
export default class Translator extends Authentication {
  private resourceHandler:
    | ArticleTranslator
    | BlogTranslator
    | CollectionTranslator
    | PageTranslator
    | ProductTranslator
    | ModelTranslator
    | StaticSectionTranslator
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
  ):
    | ProductTranslator
    | CollectionTranslator
    | ArticleTranslator
    | BlogTranslator
    | PageTranslator
    | ModelTranslator
    | StaticSectionTranslator {
    if (resource === 'article') {
      return new ArticleTranslator()
    }
    if (resource === 'blog') {
      return new BlogTranslator()
    }
    if (resource === 'collection') {
      return new CollectionTranslator()
    }
    if (resource === 'page') {
      return new PageTranslator()
    }
    if (resource === 'product') {
      return new ProductTranslator()
    }
    if (resource === 'model') {
      return new ModelTranslator()
    }
    if (resource === 'static_section') {
      return new StaticSectionTranslator()
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
      | Partial<ArticleToTranslate>
      | Partial<BlogToTranslate>
      | Partial<CollectionToTranslate>
      | Partial<PageToTranslate>
      | Partial<ProductToTranslate>
      | ModelToTranslate
      | StaticSectionToTranslate
    resourceTranslated:
      | Partial<ArticleToTranslate>
      | Partial<BlogToTranslate>
      | Partial<CollectionToTranslate>
      | Partial<PageToTranslate>
      | Partial<ProductToTranslate>
      | ModelToTranslate
      | StaticSectionToTranslate
    isoCode: LanguageCode
  }) {
    try {
      const translationsToRegister = this.resourceHandler.pushDataModeler
        .formatTranslationFieldsForGraphQLMutation({
          resourceToTranslate: resourceToTranslate as any,
          resourceTranslated: resourceTranslated as any,
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
