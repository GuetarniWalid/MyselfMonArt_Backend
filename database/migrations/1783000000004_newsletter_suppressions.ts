import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Liste REPOUSSOIR — les adresses auxquelles on ne réécrira plus, jamais, quoi qu'il arrive.
 *
 * ⛔ AUCUNE ADRESSE EN CLAIR ICI. Uniquement l'empreinte SHA-256(sel serveur + adresse).
 * C'est ce qui permet de tenir deux exigences contradictoires :
 *
 *   • le RGPD impose d'effacer les données d'une personne qui le demande
 *     (`customers/redact`) ;
 *   • la survie du compte d'envoi impose de ne PLUS JAMAIS écrire à quelqu'un qui s'est
 *     plaint — donc de se souvenir de lui.
 *
 * Une empreinte salée ne permet pas de retrouver l'adresse, mais permet de reconnaître
 * l'adresse si elle se represente. On peut donc effacer la personne ET tenir la promesse de
 * ne plus la contacter. C'est aussi la seule raison pour laquelle `redact` ne vide pas cette
 * table (§10 du brief : « conserver l'empreinte hachée en liste repoussoir »).
 *
 * ⚠️ Le sel ne doit jamais changer : le changer rendrait toute la liste illisible et
 * réexposerait des personnes qui s'étaient plaintes. Il est dérivé d'`APP_KEY` (toujours
 * présente, jamais commitée) — voir NewsletterHash.
 */
export default class extends BaseSchema {
  protected tableName = 'newsletter_suppressions'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('email_hash', 64).notNullable().unique('uniq_suppression_email_hash')

      // complaint | hard_bounce | unsubscribe | redact | manual
      table.string('reason', 24).notNullable()

      // Fin de rétention (3 ans). Une PLAINTE, elle, n'expire jamais : `expires_ts` est nul
      // dans ce cas. Réécrire à quelqu'un qui s'est plaint trois ans plus tôt reste la
      // meilleure façon de perdre le compte d'envoi.
      table.bigInteger('expires_ts').nullable().index('idx_suppression_expires')

      table.bigInteger('created_ts').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
