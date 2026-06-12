import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Fallback artiste (décision grill §0.15) :
 * - statut `manual_review` : photo refusée par les filtres (IMAGE_SAFETY) ou 2 rounds
 *   sans pass → le job atterrit dans la file admin /custom-art-review (+ email Walid).
 * - `forced_provider` : maillon de chaîne imposé depuis la file admin (« relancer
 *   avec <provider> »), ex 'gemini:gemini-3-pro-image'. NULL = chaîne automatique.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_jobs'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('status', [
          'pending',
          'generating',
          'judging',
          'ready',
          'failed',
          'expired',
          'manual_review',
        ])
        .notNullable()
        .defaultTo('pending')
        .alter()
      table.string('forced_provider', 60).nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('status', ['pending', 'generating', 'judging', 'ready', 'failed', 'expired'])
        .notNullable()
        .defaultTo('pending')
        .alter()
      table.dropColumn('forced_provider')
    })
  }
}
