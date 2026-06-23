import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Estimation de durée de génération (barre de progression du studio) :
 * - `product_type` : type de produit envoyé par le studio (même vocabulaire que le
 *   photo-check) — clé de segmentation de la stat glissante. NULL = bucket 'default'.
 * - `ready_duration_ms` : durée réelle création -> ready (ms), posée UNE fois par le
 *   worker au passage automatique en ready. NULL = exclu de la stat (échec,
 *   manual_review, ou résultat passé ready à la main par l'artiste).
 *
 * Index (product_type, status, id) : sert la fenêtre glissante (50–100 derniers ready
 * d'un productType, classés par id desc) calculée par App/Services/CustomArt/JobEstimate.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_jobs'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('product_type', 40).nullable()
      table.integer('ready_duration_ms').unsigned().nullable()
      table.index(['product_type', 'status', 'id'], 'idx_ca_jobs_producttype_status')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['product_type', 'status', 'id'], 'idx_ca_jobs_producttype_status')
      table.dropColumn('product_type')
      table.dropColumn('ready_duration_ms')
    })
  }
}
