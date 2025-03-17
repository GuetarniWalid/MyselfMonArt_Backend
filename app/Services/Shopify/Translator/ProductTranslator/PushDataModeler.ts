import type { ProductToTranslate } from 'Types/Product'
import type { LanguageCode, TranslationInput, TranslationsRegister } from 'Types/Translation'
import Utils from '../Utils'

export default class PushDataModeler {
  private utils: Utils

  constructor() {
    this.utils = new Utils()
  }

  public formatTranslationFieldsForGraphQLMutation({
    productToTranslate,
    productTranslated,
    isoCode,
  }: {
    productToTranslate: Partial<ProductToTranslate>
    productTranslated: Partial<ProductToTranslate>
    isoCode: LanguageCode
  }): TranslationsRegister[] {
    const productTranslationInputs = [] as TranslationInput[]
    const translationEntriesForOptions = [] as TranslationsRegister[]
    const translationEntriesForMedia = [] as TranslationsRegister[]

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
        this.createTranslationEntryForMedia({
          isoCode,
          newMediaData: newValue,
          oldMediaData: oldValue,
          translationEntriesForMedia,
        })
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
        resourceId: productToTranslate.id!,
        translations: productTranslationInputs,
      },
      ...translationEntriesForOptions,
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

  private createTranslationEntryForMedia({
    isoCode,
    newMediaData,
    oldMediaData,
    translationEntriesForMedia,
  }: {
    isoCode: LanguageCode
    newMediaData: ProductToTranslate['media']
    oldMediaData: ProductToTranslate['media']
    translationEntriesForMedia: TranslationsRegister[]
  }): void {
    const translationInputMedia = [] as TranslationInput[]

    this.utils.createTranslationEntry(
      {
        key: 'alts',
        isoCode,
        newValue: JSON.stringify(newMediaData.alts),
        oldValue: JSON.stringify(oldMediaData.alts),
      },
      translationInputMedia
    )
    const translationEntryForMedia = {
      resourceId: oldMediaData.id,
      translations: translationInputMedia,
    }
    translationEntriesForMedia.push(translationEntryForMedia)
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
      const translationInputOption = [] as TranslationInput[]
      if (option.name) {
        this.utils.createTranslationEntry(
          {
            key: 'name',
            isoCode,
            newValue: option.name!,
            oldValue: oldOptionsData[index].name!,
          },
          translationInputOption
        )

        const translationEntryForOption = {
          resourceId: oldOptionsData[index].id,
          translations: translationInputOption,
        }
        translationEntriesForOptions.push(translationEntryForOption)
      }

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

        const TranslationEntryForOptionValue = {
          resourceId: optionValue.id,
          translations: translationInput,
        }
        translationEntriesForOptions.push(TranslationEntryForOptionValue)
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
}
