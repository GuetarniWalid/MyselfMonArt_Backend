import type { ModelToTranslate } from 'Types/Model'
import type { LanguageCode, TranslationInput, TranslationsRegister } from 'Types/Translation'
import DefaultPushDataModeler from '../PushDataModeler'

export default class PushDataModeler extends DefaultPushDataModeler {
  public formatTranslationFieldsForGraphQLMutation({
    resourceToTranslate,
    resourceTranslated,
    isoCode,
  }: {
    resourceToTranslate: ModelToTranslate
    resourceTranslated: ModelToTranslate
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
