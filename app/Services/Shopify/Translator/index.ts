import type { LanguageCode, TranslatableContent } from 'Types/Translation'
import Authentication from '../Authentication'
import ProductTranslator from './ProductTranslator'

export default class Translator extends Authentication {
  public async getOutdatedTranslations(resource: 'product' | 'collection') {
    const translatorHandler = this.getTranslatorHandler(resource) as ProductTranslator
    return await translatorHandler.getResourceOutdatedTranslations()
  }

  private getTranslatorHandler(resource: 'product' | 'collection') {
    if (resource === 'product') {
      return new ProductTranslator()
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
    resource: 'product' | 'collection'
    isoCode: LanguageCode
  }) {
    const translatorHandler = this.getTranslatorHandler(resource)
    return await translatorHandler.updateResourceTranslation({
      productToTranslate: resourceToTranslate,
      productTranslated: resourceTranslated,
      isoCode,
    })
  }
}
