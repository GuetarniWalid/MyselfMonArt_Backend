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
    // intro/guide/faq/cocon are each their own translatable resource (the metafield itself),
    // so strip them before delegating the standard fields to the base modeler.
    const {
      intro: oldIntro,
      guide: oldGuide,
      faq: oldFaq,
      cocon: oldCocon,
      ...restOld
    } = resourceToTranslate
    const {
      intro: newIntro,
      guide: newGuide,
      faq: newFaq,
      cocon: newCocon,
      ...restNew
    } = resourceTranslated

    const entries = await super.formatTranslationFieldsForGraphQLMutation({
      resourceToTranslate: restOld,
      resourceTranslated: restNew,
      isoCode,
    })

    this.pushMetafieldValueEntry(oldIntro, newIntro, isoCode, entries)
    this.pushMetafieldValueEntry(oldGuide, newGuide, isoCode, entries)
    this.pushMetafieldValueEntry(oldFaq, newFaq, isoCode, entries)
    this.pushMetafieldValueEntry(oldCocon, newCocon, isoCode, entries)

    return entries
  }

  /**
   * Registers a `value`-keyed translation entry for a standalone translatable
   * metafield (intro/guide/faq). No-op when ids/values are missing or unchanged.
   */
  private pushMetafieldValueEntry(
    old: { id: string; value: string } | undefined,
    next: { id: string; value: string } | undefined,
    isoCode: LanguageCode,
    entries: TranslationsRegister[]
  ) {
    if (!old?.id || !next?.value) return
    const inputs = [] as TranslationInput[]
    this.utils.createTranslationEntry(
      { key: 'value', isoCode, newValue: next.value, oldValue: old.value },
      inputs
    )
    if (inputs.length > 0) {
      entries.push({ resourceId: old.id, translations: inputs })
    }
  }
}
