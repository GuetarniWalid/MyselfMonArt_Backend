import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Caps anti-abus de « Sauvegarder ma création » (POST /jobs/:uuid/save) :
 * compteur d'envois d'emails par session et par jour (en plus du throttle HTTP),
 * + dernier job notifié pour ne pas renvoyer deux fois le même mail.
 * Sans ça, l'endpoint servirait de relais d'emails depuis le domaine de la marque.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_sessions'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('save_sends_count').unsigned().notNullable().defaultTo(0)
      table.date('save_sends_date').nullable()
      table.string('last_save_job_uuid', 36).nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('save_sends_count')
      table.dropColumn('save_sends_date')
      table.dropColumn('last_save_job_uuid')
    })
  }
}
