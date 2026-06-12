import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Mockups Photopea (M7, plan §8) — backlog de rattrapage :
 * `mockups_pending` = true tant que des mises en situation restent à rendre pour un job
 * ready (moteur Photopea down au reveal, ou rendu interrompu en cours de route).
 * Le worker re-scanne ce flag toutes les 60 s et rattrape quand le moteur revient ;
 * le flag est levé atomiquement à la fin (et déclenche l'email « aperçus prêts » si la
 * session a un email).
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_jobs'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('mockups_pending').notNullable().defaultTo(false)
      table.index(['mockups_pending', 'status'], 'idx_mockups_pending_status')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['mockups_pending', 'status'], 'idx_mockups_pending_status')
      table.dropColumn('mockups_pending')
    })
  }
}
