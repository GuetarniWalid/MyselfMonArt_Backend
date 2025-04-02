import type { CollectionToTranslate } from 'Types/Collection'
import type { LanguageCode, TranslationInput, TranslationsRegister } from 'Types/Translation'
import Utils from '../Utils'

export default class PushDataModeler {
  private utils: Utils

  constructor() {
    this.utils = new Utils()
  }

  public formatTranslationFieldsForGraphQLMutation({
    collectionToTranslate,
    collectionTranslated,
    isoCode,
  }: {
    collectionToTranslate: Partial<CollectionToTranslate>
    collectionTranslated: Partial<CollectionToTranslate>
    isoCode: LanguageCode
  }): TranslationsRegister[] {
    const collectionTranslationInputs = [] as TranslationInput[]
    const translationEntriesForMedia = [] as TranslationsRegister[]

    for (const key in collectionToTranslate) {
      if (key === 'id') {
        continue
      }
      const oldValue = collectionToTranslate[key]
      const newValue = collectionTranslated[key]

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
        resourceId: collectionToTranslate.id!,
        translations: collectionTranslationInputs,
      },
      ...translationEntriesForMedia,
    ]
  }

  private createTranslationEntryForSEO({
    isoCode,
    newSeoData,
    oldSeoData,
    translationInputs,
  }: {
    isoCode: LanguageCode
    newSeoData: CollectionToTranslate['seo']
    oldSeoData: CollectionToTranslate['seo']
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

  private createTranslationEntryForMedia({
    isoCode,
    newMediaData,
    oldMediaData,
    translationEntriesForMedia,
  }: {
    isoCode: LanguageCode
    newMediaData: CollectionToTranslate['image']
    oldMediaData: CollectionToTranslate['image']
    translationEntriesForMedia: TranslationsRegister[]
  }): void {
    const translationInputImage = [] as TranslationInput[]

    this.utils.createTranslationEntry(
      {
        key: 'alts',
        isoCode,
        newValue: JSON.stringify([newMediaData.altText]),
        oldValue: JSON.stringify([oldMediaData.altText]),
      },
      translationInputImage
    )
    const translationEntryForMedia = {
      resourceId: oldMediaData.id,
      translations: translationInputImage,
    }
    translationEntriesForMedia.push(translationEntryForMedia)
  }

  private defineTranslationKey(key: string): string {
    switch (key) {
      case 'descriptionHtml':
        return 'body_html'
      default:
        return key
    }
  }
}
