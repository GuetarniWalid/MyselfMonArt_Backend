import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Garde-fou anti-boucle (incident coûts 13/06) : compteur de relances orphelines par job.
 * Le worker incrémente recovery_count à chaque reprise d'un job coincé en
 * generating/judging ; au-delà de MAX_RECOVERIES, le job part en manual_review (terminal)
 * au lieu de repartir en pending — un job qui crashe systématiquement le process (SIGSEGV
 * libvips non rattrapable) ne peut plus boucler et re-facturer génération + jugement.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_jobs'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('recovery_count').unsigned().notNullable().defaultTo(0)
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('recovery_count')
    })
  }
}
