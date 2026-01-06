import type { MetaobjectToTranslate } from 'Types/Metaobject'
import type {
  LanguageCode,
  RegionCode,
  TranslationInput,
  TranslationsRegister,
} from 'Types/Translation'
import DefaultPushDataModeler from '../PushDataModeler'

export default class PushDataModeler extends DefaultPushDataModeler {
  public async formatTranslationFieldsForGraphQLMutation({
    resourceToTranslate,
    resourceTranslated,
    isoCode,
    region,
  }: {
    resourceToTranslate: MetaobjectToTranslate
    resourceTranslated: MetaobjectToTranslate
    isoCode: LanguageCode
    region?: RegionCode
  }): Promise<TranslationsRegister[]> {
    const translationInputs = [] as TranslationInput[]

    // Handle painting option, radio container, popup, custom media, colors and themes
    if (
      resourceToTranslate.type === 'painting_option' ||
      resourceToTranslate.type === 'radio_container' ||
      resourceToTranslate.type === 'popup' ||
      resourceToTranslate.type === 'custom_media' ||
      resourceToTranslate.type === 'shopify--color-pattern' ||
      resourceToTranslate.type === 'shopify--theme'
    ) {
      this.utils.createTranslationEntry(
        {
          key: resourceToTranslate.field.key,
          isoCode,
          newValue: resourceTranslated.field.jsonValue,
          oldValue: resourceToTranslate.field.jsonValue,
        },
        translationInputs,
        region
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
