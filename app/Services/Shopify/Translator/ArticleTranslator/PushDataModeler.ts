import type { ArticleToTranslate } from 'Types/Article'
import type { LanguageCode, TranslationInput, TranslationsRegister } from 'Types/Translation'
import Utils from '../Utils'

export default class PushDataModeler {
  private utils: Utils

  constructor() {
    this.utils = new Utils()
  }

  public formatTranslationFieldsForGraphQLMutation({
    articleToTranslate,
    articleTranslated,
    isoCode,
  }: {
    articleToTranslate: Partial<ArticleToTranslate>
    articleTranslated: Partial<ArticleToTranslate>
    isoCode: LanguageCode
  }): TranslationsRegister[] {
    const articleTranslationInputs = [] as TranslationInput[]
    const translationEntriesForMedia = [] as TranslationsRegister[]

    for (const key in articleToTranslate) {
      if (key === 'id') {
        continue
      }
      const oldValue = articleToTranslate[key]
      const newValue = articleTranslated[key]

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
        articleTranslationInputs
      )
    }

    return [
      {
        resourceId: articleToTranslate.id!,
        translations: articleTranslationInputs,
      },
      ...translationEntriesForMedia,
    ]
  }

  private createTranslationEntryForMedia({
    isoCode,
    newMediaData,
    oldMediaData,
    translationEntriesForMedia,
  }: {
    isoCode: LanguageCode
    newMediaData: ArticleToTranslate['image']
    oldMediaData: ArticleToTranslate['image']
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
      case 'body':
        return 'body_html'
      case 'summary':
        return 'summary_html'
      default:
        return key
    }
  }
}
