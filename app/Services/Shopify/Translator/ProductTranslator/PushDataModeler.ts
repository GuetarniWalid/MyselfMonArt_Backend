import type { ProductToTranslate } from 'Types/Product'
import type { LanguageCode, TranslationInput, TranslationsRegister } from 'Types/Translation'
import DefaultPushDataModeler from '../PushDataModeler'

export default class PushDataModeler extends DefaultPushDataModeler {
  public formatTranslationFieldsForGraphQLMutation({
    resourceToTranslate,
    resourceTranslated,
    isoCode,
  }: {
    resourceToTranslate: Partial<ProductToTranslate>
    resourceTranslated: Partial<ProductToTranslate>
    isoCode: LanguageCode
  }): TranslationsRegister[] {
    const collectionTranslationInputs = [] as TranslationInput[]
    const translationEntriesForMedia = [] as TranslationsRegister[]
    const translationEntriesForOptions = [] as TranslationsRegister[]

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
        collectionTranslationInputs
      )
    }

    return [
      {
        resourceId: resourceToTranslate.id!,
        translations: collectionTranslationInputs,
      },
      ...translationEntriesForMedia,
      ...translationEntriesForOptions,
    ]
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
}
