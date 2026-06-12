import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

/**
 * Session du studio CustomArt : un visiteur identifié par un jeton opaque (cookie/token),
 * anonyme tant qu'il n'a pas laissé d'email via « Sauvegarder ma création ».
 * Les caps/jour sont calculés en comptant les custom_art_jobs du jour (pas via essais_count,
 * qui n'est qu'un compteur cumulé informatif).
 */
export default class CustomArtSession extends BaseModel {
  public static table = 'custom_art_sessions'

  @column({ isPrimary: true })
  public id: number

  @column()
  public sessionToken: string

  @column()
  public email: string | null

  @column()
  public ipHash: string

  @column()
  public essaisCount: number

  // Cap DB des envois « Sauvegarder ma création » : compteur du jour + jour de référence
  // + dernier job notifié (pas de renvoi du même mail). Anti-relais d'emails.
  @column()
  public saveSendsCount: number

  @column.date()
  public saveSendsDate: DateTime | null

  @column()
  public lastSaveJobUuid: string | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
