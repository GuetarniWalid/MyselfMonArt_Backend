import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import Conversation from 'App/Models/Conversation'

export type ConversationMessageRole = 'user' | 'assistant' | 'tool'

export default class ConversationMessage extends BaseModel {
  public static table = 'conversation_messages'

  @column({ isPrimary: true })
  public id: number

  @column()
  public conversationId: number

  @column()
  public role: ConversationMessageRole

  @column()
  public content: string | null

  @column({
    prepare: (value: any) =>
      value == null ? null : typeof value === 'string' ? value : JSON.stringify(value),
    consume: (value: any) =>
      value == null ? null : typeof value === 'string' ? JSON.parse(value) : value,
  })
  public toolCalls: any[] | null

  @column()
  public externalMessageId: string | null

  @column()
  public costCents: number

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @belongsTo(() => Conversation)
  public conversation: BelongsTo<typeof Conversation>
}
