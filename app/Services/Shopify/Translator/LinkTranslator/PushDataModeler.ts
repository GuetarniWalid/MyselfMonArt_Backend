import type { ModelToTranslate } from 'Types/Model'
import type {
  LanguageCode,
  RegionCode,
  TranslationInput,
  TranslationsRegister,
} from 'Types/Translation'
import DefaultPushDataModeler from '../PushDataModeler'

/**
 * A LINK has a single translatable field (`title`). Same shape as the static_section /
 * model push: one translation entry, keyed by the field, with the source value's digest.
 */
export default class PushDataModeler extends DefaultPushDataModeler {
  public async formatTranslationFieldsForGraphQLMutation({
    resourceToTranslate,
    resourceTranslated,
    isoCode,
    region,
  }: {
    resourceToTranslate: ModelToTranslate
    resourceTranslated: ModelToTranslate
    isoCode: LanguageCode
    region?: RegionCode
  }): Promise<TranslationsRegister[]> {
    const translationInputs = [] as TranslationInput[]

    this.utils.createTranslationEntry(
      {
        key: resourceToTranslate.key,
        isoCode,
        newValue: resourceTranslated.value as string,
        oldValue: resourceToTranslate.value as string,
      },
      translationInputs,
      region
    )

    return [
      {
        resourceId: resourceToTranslate.id!,
        translations: translationInputs,
      },
    ]
  }
}
