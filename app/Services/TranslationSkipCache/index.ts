import { createHash } from 'crypto'
import TranslationSkipCache from 'App/Models/TranslationSkipCache'

type SkipKey = {
  resourceId: string
  resourceType: string
  locale: string
  region?: string
  fieldKey: string
}

export default class TranslationSkipCacheService {
  public hashContent(content: unknown): string {
    const serialized = typeof content === 'string' ? content : JSON.stringify(content)
    return createHash('sha256').update(serialized, 'utf8').digest('hex')
  }

  public async shouldSkip(key: SkipKey, currentSourceContent: unknown): Promise<boolean> {
    const entry = await TranslationSkipCache.query()
      .where('resource_id', key.resourceId)
      .where('locale', key.locale)
      .where('region', key.region ?? '')
      .where('field_key', key.fieldKey)
      .first()
    if (!entry) return false
    return entry.sourceHash === this.hashContent(currentSourceContent)
  }

  public async markFailed(
    key: SkipKey,
    currentSourceContent: unknown,
    reason: string
  ): Promise<void> {
    const sourceHash = this.hashContent(currentSourceContent)
    const region = key.region ?? ''
    await TranslationSkipCache.updateOrCreate(
      {
        resourceId: key.resourceId,
        locale: key.locale,
        region,
        fieldKey: key.fieldKey,
      },
      {
        resourceType: key.resourceType,
        sourceHash,
        reason: reason.slice(0, 255),
      }
    )
  }
}
