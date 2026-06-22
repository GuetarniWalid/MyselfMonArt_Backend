import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

/**
 * Single-row table tracking the Gmail incremental sync cursor.
 *
 * - lastHistoryId: the Gmail mailbox historyId up to which we've already
 *   ingested. Push notifications / the poll fallback call history.list from
 *   this id, so we only ever process messages ADDED since — never the backlog.
 * - watchExpiration: epoch ms when the current users.watch() registration
 *   lapses (~7 days). RenewGmailWatch re-arms it before then.
 */
export default class GmailSyncState extends BaseModel {
  public static table = 'gmail_sync_state'

  @column({ isPrimary: true })
  public id: number

  @column()
  public emailAddress: string | null

  @column()
  public lastHistoryId: string | null

  @column()
  public watchExpiration: number | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  /** Get the singleton row, creating it empty on first access. */
  public static async singleton(): Promise<GmailSyncState> {
    const existing = await this.query().orderBy('id', 'asc').first()
    if (existing) return existing
    return await this.create({})
  }
}
