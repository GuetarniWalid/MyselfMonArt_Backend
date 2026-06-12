import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import CustomArtJob from 'App/Models/CustomArtJob'

export type CustomArtPrintStatus =
  | 'awaiting_file'
  | 'awaiting_review'
  | 'approved'
  | 'ordered'
  | 'shipped'

/**
 * Ligne de commande payée liée à un job CustomArt (webhook orders/paid — M9).
 * print_status pilote la file print admin : chaque fichier est validé humainement
 * avant la commande manuelle sur le portail Picanova.
 */
export default class CustomArtOrder extends BaseModel {
  public static table = 'custom_art_orders'

  @column({ isPrimary: true })
  public id: number

  @column()
  public shopifyOrderId: string

  /** Numéro lisible Shopify (« #1832 ») — file admin + emails transactionnels. */
  @column()
  public orderName: string | null

  @column()
  public jobId: number

  @column()
  public lineItemId: string

  /** Email client capturé au webhook orders/paid (confirmation + « part en production »). */
  @column()
  public customerEmail: string | null

  @column()
  public printFilePath: string | null

  @column()
  public printStatus: CustomArtPrintStatus

  /** Dernière erreur de préparation du fichier print (affichée dans la file admin). */
  @column()
  public printError: string | null

  @column.dateTime()
  public reviewedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => CustomArtJob, { foreignKey: 'jobId' })
  public job: BelongsTo<typeof CustomArtJob>
}
