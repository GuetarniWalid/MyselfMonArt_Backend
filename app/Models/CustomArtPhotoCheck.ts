import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'
import type { PhotoAssessment } from 'App/Services/CustomArt/PhotoCheck'

/**
 * Entrée de cache d'un juge « photo-check » (endpoint POST /api/custom-art/photo-check).
 * Clé = SHA-256 de la photo originale ; on ne garde QUE le hash + l'évaluation intrinsèque
 * (RGPD : jamais la photo). TTL ~1 h appliqué à la lecture par le service PhotoCheck.
 */
export default class CustomArtPhotoCheck extends BaseModel {
  public static table = 'custom_art_photo_checks'

  @column({ isPrimary: true })
  public id: number

  @column()
  public hash: string

  @column({
    prepare: (value: any) => (value === null ? null : JSON.stringify(value)),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  public assessment: PhotoAssessment

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
