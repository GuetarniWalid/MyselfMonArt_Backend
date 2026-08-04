import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class PromoRotation extends BaseModel {
  public static table = 'promo_rotations'

  @column({ isPrimary: true })
  public id: number

  /** Semaine ISO ciblée, ex. "2026-W32" — clé d'idempotence (UNIQUE en base). */
  @column()
  public isoWeek: string

  /** Code publié, ex. "MERCI-K7QXR" (déterministe : HMAC(secret, isoWeek)). */
  @column()
  public code: string

  /**
   * Doublon LISIBLE de la fin de validité, pour qui inspecte la table à l'œil nu.
   * ⚠️ Ne jamais s'en servir pour comparer ou republier : un TIMESTAMP se fait réinterpréter
   * par le fuseau de session MySQL puis par celui du process Node. La vérité est `endsTs`.
   */
  @column.dateTime()
  public endsAt: DateTime

  /** Le même instant, en secondes epoch — SOURCE DE VÉRITÉ (aucun fuseau à réinterpréter). */
  @column()
  public endsTs: number

  @column()
  public discountGid: string | null

  /** 'pending' = ligne posée, métachamps pas encore écrits ; 'published' = tout est en ligne. */
  @column()
  public status: 'pending' | 'published'

  @column.dateTime()
  public publishedAt: DateTime | null

  @column()
  public attempts: number

  @column()
  public lastError: string | null

  @column.dateTime()
  public alertSentAt: DateTime | null

  @column.dateTime()
  public deactivatedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
