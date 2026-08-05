import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

/**
 * `sending` = place RÉSERVÉE avant l'envoi (la contrainte UNIQUE a tranché), `sent` = parti,
 * `failed` = refusé par le transport AVANT toute remise, `skipped` = la porte d'avant-envoi a
 * dit non, `unknown` = plantage entre la réservation et l'envoi — statut TERMINAL, jamais
 * relancé (un doublon coûte plus cher qu'un e-mail manquant).
 */
export type SendStatus = 'sending' | 'sent' | 'failed' | 'skipped' | 'unknown'

export default class NewsletterSend extends BaseModel {
  public static table = 'newsletter_sends'

  @column({ isPrimary: true })
  public id: number

  @column()
  public subscriberId: number

  /** 1 = immédiat, 2 = J+3, 3 = J+7. UNIQUE avec `subscriberId`. */
  @column()
  public emailNo: number

  @column()
  public status: SendStatus

  @column()
  public transport: string | null

  /** Clé de rapprochement avec les notifications de rebond et de plainte. */
  @column()
  public providerMessageId: string | null

  @column()
  public locale: string | null

  @column()
  public reason: string | null

  @column()
  public attempts: number

  @column({ consume: (v) => (v === null || v === undefined ? null : Number(v)) })
  public claimedTs: number

  @column({ consume: (v) => (v === null || v === undefined ? null : Number(v)) })
  public sentTs: number | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
