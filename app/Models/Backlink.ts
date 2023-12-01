import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class Backlink extends BaseModel {
  @column({ isPrimary: true, serializeAs: null })
  public id: number

  @column()
  public site: string | null

  @column()
  public url: string

  @column()
  public anchor: string | null

  @column({
    consume: (value: Number) => value === 1,
  })
  public state: boolean

  @column.dateTime({ autoCreate: true, serializeAs: null })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, serializeAs: null })
  public updatedAt: DateTime
}
