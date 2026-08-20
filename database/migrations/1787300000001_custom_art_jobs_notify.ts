import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * « Prévenez-moi quand c'est prêt » sur une création qui prend plus longtemps que prévu.
 *
 * POURQUOI : le studio cesse d'attendre au bout de 3 minutes (POLL_TIMEOUT du thème) alors que la
 * génération va au bout. La cliente voyait un échec et perdait sa création — définitivement si elle
 * n'avait laissé aucune adresse. Elle peut désormais être prévenue par e-mail dès que le rendu est
 * prêt (lien de reprise ?ca_job=).
 *
 * Pourquoi sur le JOB et pas sur la session : l'adresse peut être saisie à CE moment-là, pour CETTE
 * création, et différer de celle de la session. `notify_sent_at` rend l'envoi idempotent — le worker
 * peut repasser sur un job (reprise d'orphelin) sans réexpédier l'e-mail.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_jobs'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Adresse à prévenir. NULL = la cliente n'a rien demandé -> aucun e-mail.
      table.string('notify_email', 255).nullable()
      // Langue du studio au moment de la demande ('fr' | 'en' | 'de' | 'nl' | 'es').
      table.string('notify_locale', 5).nullable()
      // Horodatage de l'envoi : garantit « une seule fois », y compris après reprise d'orphelin.
      table.dateTime('notify_sent_at').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('notify_email')
      table.dropColumn('notify_locale')
      table.dropColumn('notify_sent_at')
    })
  }
}
