import type { ModelToTranslate } from 'Types/Model'
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
