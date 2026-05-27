import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export type InboxChannel = 'instagram' | 'messenger'
export type InboxStatus = 'pending' | 'processing' | 'replied' | 'escalated' | 'failed' | 'skipped'

export default class InboxMessage extends BaseModel {
  public static table = 'inbox_messages'

  @column({ isPrimary: true })
  public id: number

  @column()
  public channel: InboxChannel

  @column()
  public externalMessageId: string

  @column()
  public externalThreadId: string | null

  @column()
  public externalUserId: string | null

  @column({
    prepare: (value: any) => (typeof value === 'string' ? value : JSON.stringify(value)),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  public rawPayload: Record<string, any>

  @column()
  public status: InboxStatus

  @column()
  public attempts: number

  @column()
  public lastError: string | null

  @column.dateTime()
  public processedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
