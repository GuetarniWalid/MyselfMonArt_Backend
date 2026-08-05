import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Journal d'envoi — et surtout GARDE D'IDEMPOTENCE de la séquence.
 *
 * ⛔ LE POINT CRITIQUE : `UNIQUE(subscriber_id, email_no)` est RÉSERVÉ AVANT L'ENVOI, pas
 * écrit après.
 *
 * Le piège classique de la double écriture : appeler le prestataire d'envoi puis écrire en
 * base. Si le process meurt entre les deux, l'e-mail est parti mais rien ne le dit — et le
 * tour suivant le renvoie. Un doublon, à ce volume, c'est une plainte ; une plainte, c'est
 * 0,83 % là où le contrat SES exige moins de 0,08 % ; et une suspension de compte arrête tout
 * en silence, séquences en cours comprises.
 *
 * La séquence est donc :
 *
 *   1. INSERT (subscriber_id, email_no, status='sending')   ← la contrainte UNIQUE tranche
 *      • ER_DUP_ENTRY = quelqu'un d'autre s'en occupe ou c'est déjà parti → on passe
 *   2. envoi
 *   3. UPDATE status='sent' + identifiant du message
 *
 * Un plantage entre 1 et 3 laisse une ligne `sending` orpheline. Elle n'est JAMAIS relancée :
 * au-delà d'un délai de grâce, elle devient `unknown` et est journalisée. On assume donc un
 * envoi AU PLUS UNE FOIS.
 *
 *   Le pire cas acceptable est qu'un e-mail manque.
 *   Le pire cas inacceptable est qu'il parte deux fois.
 */
export default class extends BaseSchema {
  protected tableName = 'newsletter_sends'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('subscriber_id').unsigned().notNullable()
      // 1 = immédiat, 2 = J+3, 3 = J+7
      table.tinyint('email_no').notNullable()

      // sending | sent | failed | skipped | unknown
      table.string('status', 16).notNullable().defaultTo('sending')

      // 'ses' | 'smtp' — sert au diagnostic quand un seul des deux transports pose problème.
      table.string('transport', 16).nullable()
      // Identifiant renvoyé par le prestataire : c'est la clé de rapprochement avec les
      // notifications de rebond et de plainte.
      table.string('provider_message_id', 255).nullable().index('idx_sends_message_id')

      table.string('locale', 5).nullable()
      // Pourquoi on n'a pas envoyé (skipped) ou pourquoi ça a échoué (failed).
      table.string('reason', 255).nullable()
      table.integer('attempts').notNullable().defaultTo(0)

      table.bigInteger('claimed_ts').notNullable()
      table.bigInteger('sent_ts').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // ⛔ La garde. Sans elle, tout le reste du dispositif ne tient pas.
      table.unique(['subscriber_id', 'email_no'], 'uniq_newsletter_send')
      // Balayage des lignes `sending` restées en plan après un plantage.
      table.index(['status', 'claimed_ts'], 'idx_sends_stuck')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
