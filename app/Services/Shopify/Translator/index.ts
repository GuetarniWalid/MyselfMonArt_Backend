import type {
  LanguageCode,
  RegionCode,
  TranslatableContent,
  TranslationsRegister,
} from 'Types/Translation'
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
import MetaobjectTranslator from './MetaobjectTranslator'
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
    | MetaobjectTranslator
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

  public async getOutdatedTranslations(locale: LanguageCode = 'en', region?: RegionCode) {
    return await this.resourceHandler.pullDataModeler.getResourceOutdatedTranslations(
      locale,
      region
    )
  }

  /**
   * Theme section-setting media (SVG icons, file refs) must stay identical across
   * locales. Returns any media setting that still carries a per-locale override for
   * `locale` — these are stale and should be removed so the storefront inherits the
   * source artwork. Only meaningful for the static_section resource.
   */
  public async getStaleThemeMediaOverrides(locale: LanguageCode) {
    if (!(this.resourceHandler instanceof StaticSectionTranslator)) {
      throw new Error('getStaleThemeMediaOverrides is only supported for static_section')
    }
    return await this.resourceHandler.pullDataModeler.getStaleMediaOverrides(locale)
  }

  /**
   * Removes per-locale translation overrides for the given keys on a resource, so the
   * storefront falls back to the default-locale (source) value. Used to purge stale
   * theme media overrides. Keys are removed in batches per resource.
   */
  public async removeTranslations({
    resourceId,
    translationKeys,
    locale,
  }: {
    resourceId: string
    translationKeys: string[]
    locale: LanguageCode
  }) {
    const batchSize = 100
    const responses = [] as any[]
    for (let i = 0; i < translationKeys.length; i += batchSize) {
      const keys = translationKeys.slice(i, i + batchSize)
      const { query, variables } = this.removeTranslationQuery(resourceId, keys, locale)
      const response = await this.fetchGraphQL(query, variables)
      if (!response || response.errors) {
        throw new Error(JSON.stringify(response?.errors))
      }
      responses.push(response)
    }
    return responses
  }

  private removeTranslationQuery(resourceId: string, translationKeys: string[], locale: string) {
    return {
      query: `mutation TranslationsRemove($resourceId: ID!, $translationKeys: [String!]!, $locales: [String!]!) {
        translationsRemove(resourceId: $resourceId, translationKeys: $translationKeys, locales: $locales) {
          translations { key locale }
          userErrors { field message }
        }
      }`,
      variables: { resourceId, translationKeys, locales: [locale] },
    }
  }

  private getTranslatorHandler(
    resource: Resource
  ):
    | ArticleTranslator
    | BlogTranslator
    | CollectionTranslator
    | MetaobjectTranslator
    | ModelTranslator
    | PageTranslator
    | ProductTranslator
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
    if (resource === 'metaobject') {
      return new MetaobjectTranslator()
    }
    if (resource === 'model') {
      return new ModelTranslator()
    }
    if (resource === 'page') {
      return new PageTranslator()
    }
    if (resource === 'product') {
      return new ProductTranslator()
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
    region,
  }: {
    resourceToTranslate: TranslatableContent
    resourceTranslated: TranslatableContent
    isoCode: LanguageCode
    region?: RegionCode
  }) {
    return await this.updateResourceTranslation({
      resourceToTranslate,
      resourceTranslated,
      isoCode,
      region,
    })
  }

  public async updateResourceTranslation({
    resourceToTranslate,
    resourceTranslated,
    isoCode,
    region,
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
    region?: RegionCode
  }) {
    try {
      const translationsToRegister = (
        await this.resourceHandler.pushDataModeler.formatTranslationFieldsForGraphQLMutation({
          resourceToTranslate: resourceToTranslate as any,
          resourceTranslated: resourceTranslated as any,
          isoCode,
          region,
        })
      ).filter((translation) => translation.translations.length > 0)

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
              market {
                name
              }
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
