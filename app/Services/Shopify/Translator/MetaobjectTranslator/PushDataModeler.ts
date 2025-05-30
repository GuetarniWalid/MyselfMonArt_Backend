import type { MetaobjectToTranslate } from 'Types/Metaobject'
import type { LanguageCode, TranslationInput, TranslationsRegister } from 'Types/Translation'
import DefaultPushDataModeler from '../PushDataModeler'

export default class PushDataModeler extends DefaultPushDataModeler {
  public formatTranslationFieldsForGraphQLMutation({
    resourceToTranslate,
    resourceTranslated,
    isoCode,
  }: {
    resourceToTranslate: MetaobjectToTranslate
    resourceTranslated: MetaobjectToTranslate
    isoCode: LanguageCode
  }): TranslationsRegister[] {
    const translationInputs = [] as TranslationInput[]

    // Handle painting option, radio container and popup
    if (
      resourceToTranslate.type === 'painting_option' ||
      resourceToTranslate.type === 'radio_container' ||
      resourceToTranslate.type === 'popup' ||
      resourceToTranslate.type === 'custom_media'
    ) {
      this.utils.createTranslationEntry(
        {
          key: resourceToTranslate.field.key,
          isoCode,
          newValue: resourceTranslated.field.jsonValue,
          oldValue: resourceToTranslate.field.jsonValue,
        },
        translationInputs
      )
    }

    return [
      {
        resourceId: resourceToTranslate.id!,
        translations: translationInputs,
      },
    ]
  }
}
