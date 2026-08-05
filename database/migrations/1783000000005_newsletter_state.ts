import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Marqueurs de SANTÉ du dispositif — quelques clés/valeurs, pas une base de données.
 *
 * Une seule question à laquelle rien d'autre ne répond : « la boucle de retour est-elle
 * encore vivante ? »
 *
 * Les rebonds et les plaintes arrivent par un chemin entièrement hors de notre contrôle
 * (SES → configuration set → SNS → abonnement HTTPS → cet endpoint). Chacun de ces cinq
 * maillons peut se rompre en silence : un configuration set renommé, un abonnement SNS resté
 * en `PendingConfirmation`, une URL changée. Et la rupture est INVISIBLE par nature — elle se
 * manifeste par une ABSENCE d'événements, ce qui ressemble exactement à « tout va bien ».
 *
 * Pendant ce temps, les adresses mortes ne sont plus écartées, le taux de rebond monte, et le
 * compte d'envoi finit suspendu. `ses_last_event_ts` transforme cette absence en alerte : si
 * on a envoyé des e-mails mais rien reçu en retour depuis des jours, quelque chose est cassé.
 */
export default class extends BaseSchema {
  protected tableName = 'newsletter_state'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('key', 64).notNullable().unique('uniq_newsletter_state_key')
      table.text('value').nullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
