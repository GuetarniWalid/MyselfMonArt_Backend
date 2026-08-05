import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

/** Clés connues — nommées ici pour qu'aucune faute de frappe ne crée un marqueur fantôme. */
export const STATE_SES_LAST_EVENT_TS = 'ses_last_event_ts'
export const STATE_SES_FEEDBACK_ALERTED_TS = 'ses_feedback_alerted_ts'
export const STATE_SYNC_ALERTED_TS = 'sync_alerted_ts'

export default class NewsletterState extends BaseModel {
  public static table = 'newsletter_state'

  @column({ isPrimary: true })
  public id: number

  @column()
  public key: string

  @column()
  public value: string | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  /** Lecture d'un marqueur numérique. `null` si absent ou illisible. */
  public static async readNumber(key: string): Promise<number | null> {
    const row = await NewsletterState.findBy('key', key)
    if (!row || row.value === null) return null
    const parsed = Number(row.value)
    return Number.isFinite(parsed) ? parsed : null
  }

  /** Écriture idempotente. Ne lève jamais : un marqueur de santé ne casse pas un envoi. */
  public static async write(key: string, value: string | number): Promise<void> {
    try {
      const row = await NewsletterState.findBy('key', key)
      if (row) {
        row.value = String(value)
        await row.save()
        return
      }
      await NewsletterState.create({ key, value: String(value) })
    } catch {
      // Course perdue contre un autre process : la contrainte UNIQUE a tranché, l'autre
      // écriture fait foi. Un marqueur de santé n'a pas à être transactionnel.
    }
  }
}
