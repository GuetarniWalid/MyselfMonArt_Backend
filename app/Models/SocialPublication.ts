import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export type SocialChannel = 'pinterest' | 'instagram'

/**
 * `pending` : ligne de réservation posée AVANT l'appel réseau. Elle exclut déjà
 * le produit des prochaines sélections, ce qui garantit qu'un crash entre le
 * post et sa confirmation ne provoque jamais une seconde publication.
 * `published` : la plateforme a confirmé le post (`externalId` renseigné).
 */
export type SocialPublicationStatus = 'pending' | 'published'

export default class SocialPublication extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public channel: SocialChannel

  @column()
  public shopifyProductId: string

  @column()
  public externalId: string | null

  @column()
  public status: SocialPublicationStatus

  @column()
  public externalBoardId: string | null

  @column.dateTime()
  public publishedAt: DateTime

  @column({
    prepare: (value: Record<string, unknown> | null) => (value ? JSON.stringify(value) : null),
  })
  public metadata: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
