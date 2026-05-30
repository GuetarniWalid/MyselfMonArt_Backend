import type { CollectionToTranslate } from 'Types/Collection'
import type { LanguageCode, TranslationInput, TranslationsRegister } from 'Types/Translation'
import DefaultPushDataModeler from '../PushDataModeler'

export default class PushDataModeler extends DefaultPushDataModeler {
  public async formatTranslationFieldsForGraphQLMutation({
    resourceToTranslate,
    resourceTranslated,
    isoCode,
  }: {
    resourceToTranslate: Partial<CollectionToTranslate>
    resourceTranslated: Partial<CollectionToTranslate>
    isoCode: LanguageCode
  }): Promise<TranslationsRegister[]> {
    // The intro metafield is a separate translatable resource (the metafield itself),
    // so strip it before delegating the standard fields to the base modeler.
    const { intro: oldIntro, ...restOld } = resourceToTranslate
    const { intro: newIntro, ...restNew } = resourceTranslated

    const entries = await super.formatTranslationFieldsForGraphQLMutation({
      resourceToTranslate: restOld,
      resourceTranslated: restNew,
      isoCode,
    })

    if (oldIntro?.id && newIntro?.value) {
      const introInputs = [] as TranslationInput[]
      this.utils.createTranslationEntry(
        {
          key: 'value',
          isoCode,
          newValue: newIntro.value,
          oldValue: oldIntro.value,
        },
        introInputs
      )
      if (introInputs.length > 0) {
        entries.push({ resourceId: oldIntro.id, translations: introInputs })
      }
    }

    return entries
  }
}
