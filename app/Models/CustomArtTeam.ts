import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

/** Couleurs du club pour les pastilles du studio (clé libre : primary, secondary…). */
export type TeamColors = Record<string, string>

/**
 * Équipe de la bibliothèque curée (~15 équipes, gérée côté admin — M4).
 * kit_ref_urls = 1-2 URLs publiques du maillot domicile, références de génération.
 * fidelity_notes = notes de fidélité maillot (décision grill §0.13) : éléments iconiques
 * + pièges, injectées dans le prompt de génération et fournies au juge vision.
 */
export default class CustomArtTeam extends BaseModel {
  public static table = 'custom_art_teams'

  @column({ isPrimary: true })
  public id: number

  @column()
  public name: string

  @column()
  public slug: string

  @column({
    prepare: (value: any) => (value === null ? null : JSON.stringify(value)),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  public aliases: string[] | null

  @column({
    prepare: (value: any) => (value === null ? null : JSON.stringify(value)),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  public kitRefUrls: string[] | null

  @column({
    prepare: (value: any) => (value === null ? null : JSON.stringify(value)),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  public colors: TeamColors | null

  @column()
  public fidelityNotes: string | null

  @column()
  public active: boolean

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
