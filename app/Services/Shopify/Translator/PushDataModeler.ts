import type { ArticleToTranslate } from 'Types/Article'
import type { CollectionToTranslate } from 'Types/Collection'
import type { ProductToTranslate } from 'Types/Product'
import type { PageToTranslate } from 'Types/Page'
import type { BlogToTranslate } from 'Types/Blog'
import type { LanguageCode, TranslationInput, TranslationsRegister } from 'Types/Translation'
import type { ResourceSEO, ResourceMedia, ResourceImage } from 'Types/Resource'
import type { ThemeToTranslate } from 'Types/Theme'
import Utils from './Utils'

export default class PushDataModeler {
  protected utils: Utils

  constructor() {
    this.utils = new Utils()
  }

  public formatTranslationFieldsForGraphQLMutation({
    resourceToTranslate,
    resourceTranslated,
    isoCode,
  }: {
    resourceToTranslate:
      | Partial<ProductToTranslate>
      | Partial<CollectionToTranslate>
      | Partial<ArticleToTranslate>
      | Partial<PageToTranslate>
      | Partial<BlogToTranslate>
      | ThemeToTranslate
    resourceTranslated:
      | Partial<ProductToTranslate>
      | Partial<CollectionToTranslate>
      | Partial<ArticleToTranslate>
      | Partial<PageToTranslate>
      | Partial<BlogToTranslate>
      | ThemeToTranslate
    isoCode: LanguageCode
  }): TranslationsRegister[] {
    const collectionTranslationInputs = [] as TranslationInput[]
    const translationEntriesForMedia = [] as TranslationsRegister[]

    for (const key in resourceToTranslate) {
      if (key === 'id') {
        continue
      }
      const oldValue = resourceToTranslate[key]
      const newValue = resourceTranslated[key]

      // Handle nested SEO object
      if (key === 'seo' && typeof newValue === 'object') {
        this.createTranslationEntryForSEO({
          isoCode,
          newSeoData: newValue,
          oldSeoData: oldValue,
          translationInputs: collectionTranslationInputs,
        })
        continue
      }

      // Handle nested media object
      if (key === 'media' && typeof newValue === 'object') {
        this.createTranslationEntryForMedia({
          isoCode,
          newMediaData: newValue,
          oldMediaData: oldValue,
          translationEntriesForMedia,
        })
        continue
      }

      // Handle nested media object
      if (key === 'image' && typeof newValue === 'object') {
        this.createTranslationEntryForMedia({
          isoCode,
          newMediaData: newValue,
          oldMediaData: oldValue,
          translationEntriesForMedia,
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
        collectionTranslationInputs
      )
    }

    return [
      {
        resourceId: resourceToTranslate.id!,
        translations: collectionTranslationInputs,
      },
      ...translationEntriesForMedia,
    ]
  }

  protected createTranslationEntryForSEO({
    isoCode,
    newSeoData,
    oldSeoData,
    translationInputs,
  }: {
    isoCode: LanguageCode
    newSeoData: ResourceSEO
    oldSeoData: ResourceSEO
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

  protected createTranslationEntryForMedia({
    isoCode,
    newMediaData,
    oldMediaData,
    translationEntriesForMedia,
  }: {
    isoCode: LanguageCode
    newMediaData: ResourceMedia | ResourceImage
    oldMediaData: ResourceMedia | ResourceImage
    translationEntriesForMedia: TranslationsRegister[]
  }): void {
    const translationInputMedia = [] as TranslationInput[]

    // Use type guards to safely access properties
    const newAlts = this.utils.isResourceMedia(newMediaData)
      ? newMediaData.alts
      : [newMediaData.altText]

    const oldAlts = this.utils.isResourceMedia(oldMediaData)
      ? oldMediaData.alts
      : [oldMediaData.altText]

    this.utils.createTranslationEntry(
      {
        key: 'alts',
        isoCode,
        newValue: JSON.stringify(newAlts),
        oldValue: JSON.stringify(oldAlts),
      },
      translationInputMedia
    )
    const translationEntryForMedia = {
      resourceId: oldMediaData.id,
      translations: translationInputMedia,
    }
    translationEntriesForMedia.push(translationEntryForMedia)
  }

  protected defineTranslationKey(key: string): string {
    switch (key) {
      case 'body':
        return 'body_html'
      case 'descriptionHtml':
        return 'body_html'
      case 'productType':
        return 'product_type'
      case 'summary':
        return 'summary_html'
      default:
        return key
    }
  }
}
