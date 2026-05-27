import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, HasMany } from '@ioc:Adonis/Lucid/Orm'
import ConversationMessage from 'App/Models/ConversationMessage'

export type ConversationChannel = 'instagram' | 'messenger'
export type ConversationStatus = 'active' | 'escalated' | 'closed'

export default class Conversation extends BaseModel {
  public static table = 'conversations'

  @column({ isPrimary: true })
  public id: number

  @column()
  public channel: ConversationChannel

  @column()
  public externalUserId: string

  @column()
  public externalThreadId: string

  @column()
  public language: string | null

  @column()
  public status: ConversationStatus

  @column.dateTime()
  public lastMessageAt: DateTime | null

  @column.dateTime()
  public escalatedAt: DateTime | null

  @column()
  public escalationReason: string | null

  @column({
    prepare: (value: any) =>
      value == null ? null : typeof value === 'string' ? value : JSON.stringify(value),
    consume: (value: any) =>
      value == null ? null : typeof value === 'string' ? JSON.parse(value) : value,
  })
  public metadata: Record<string, any> | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @hasMany(() => ConversationMessage)
  public messages: HasMany<typeof ConversationMessage>
}
