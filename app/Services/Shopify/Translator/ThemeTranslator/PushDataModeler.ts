import type { ThemeToTranslate } from 'Types/Theme'
import type { LanguageCode, TranslationInput, TranslationsRegister } from 'Types/Translation'
import DefaultPushDataModeler from '../PushDataModeler'

export default class PushDataModeler extends DefaultPushDataModeler {
  public formatTranslationFieldsForGraphQLMutation({
    resourceToTranslate,
    resourceTranslated,
    isoCode,
  }: {
    resourceToTranslate: ThemeToTranslate
    resourceTranslated: ThemeToTranslate
    isoCode: LanguageCode
  }): TranslationsRegister[] {
    const translationInputs = [] as TranslationInput[]

    this.utils.createTranslationEntry(
      {
        key: resourceToTranslate.key,
        isoCode,
        newValue: resourceTranslated.value,
        oldValue: resourceToTranslate.value,
      },
      translationInputs
    )

    return [
      {
        resourceId: resourceToTranslate.id!,
        translations: translationInputs,
      },
    ]
  }
}
