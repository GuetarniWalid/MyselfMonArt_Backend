import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export type SuppressionReason = 'complaint' | 'hard_bounce' | 'unsubscribe' | 'redact' | 'manual'

/**
 * Liste repoussoir — empreintes SEULEMENT, jamais d'adresse en clair.
 *
 * C'est ce qui permet d'effacer une personne à sa demande (RGPD) tout en tenant la promesse
 * de ne plus jamais lui écrire : une empreinte salée ne rend pas l'adresse, mais la reconnaît
 * si elle se represente.
 */
export default class NewsletterSuppression extends BaseModel {
  public static table = 'newsletter_suppressions'

  @column({ isPrimary: true })
  public id: number

  @column()
  public emailHash: string

  @column()
  public reason: SuppressionReason

  /** Nul = pour toujours. C'est le cas des PLAINTES : elles n'expirent jamais. */
  @column({ consume: (v) => (v === null || v === undefined ? null : Number(v)) })
  public expiresTs: number | null

  @column({ consume: (v) => (v === null || v === undefined ? null : Number(v)) })
  public createdTs: number

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime
}
