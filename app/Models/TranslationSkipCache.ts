import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class TranslationSkipCache extends BaseModel {
  public static table = 'translation_skip_cache'

  @column({ isPrimary: true, serializeAs: null })
  public id: number

  @column()
  public resourceId: string

  @column()
  public resourceType: string

  @column()
  public locale: string

  @column()
  public region: string

  @column()
  public fieldKey: string

  @column()
  public sourceHash: string

  @column()
  public reason: string | null

  @column.dateTime({ autoCreate: true, serializeAs: null })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, serializeAs: null })
  public updatedAt: DateTime
}
