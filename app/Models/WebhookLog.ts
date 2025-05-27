import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class WebhookLog extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public webhookId: string

  @column()
  public topic: string

  @column()
  public shop: string

  @column()
  public status: 'processing' | 'completed' | 'failed'

  @column()
  public error: string | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
