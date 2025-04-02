import type { LanguageCode, TranslatableContent } from 'Types/Translation'
import Authentication from '../Authentication'
import ProductTranslator from './ProductTranslator'
import CollectionTranslator from './CollectionTranslator'
import ArticleTranslator from './ArticleTranslator'
export default class Translator extends Authentication {
  public async getOutdatedTranslations(resource: 'product' | 'collection' | 'article') {
    const translatorHandler = this.getTranslatorHandler(resource) as
      | ProductTranslator
      | CollectionTranslator
    return await translatorHandler.getResourceOutdatedTranslations()
  }

  private getTranslatorHandler(resource: 'product' | 'collection' | 'article') {
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
    resource,
    isoCode,
  }: {
    resourceToTranslate: TranslatableContent
    resourceTranslated: TranslatableContent
    resource: 'product' | 'collection' | 'article'
    isoCode: LanguageCode
  }) {
    const translatorHandler = this.getTranslatorHandler(resource)
    return await translatorHandler.updateResourceTranslation({
      resourceToTranslate,
      resourceTranslated,
      isoCode,
    })
  }
}
