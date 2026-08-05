import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Journal de PREUVE du consentement — append-only.
 *
 * Aucun UPDATE, aucun DELETE : on n'écrit ici que des faits datés, jamais un état. C'est ce
 * qui distingue cette table de `newsletter_subscribers` (qui, elle, ne dit que « où on en
 * est »).
 *
 * POURQUOI LA PREUVE NE PEUT PAS VIVRE CHEZ SHOPIFY — `consentUpdatedAt` y est un champ
 * UNIQUE et ÉCRASÉ : « the latest date the customer consented OR objected ». Un désabonnement
 * puis un réabonnement détruit donc la preuve d'origine, celle-là même qu'exige l'art. 7(1)
 * du RGPD (« être en mesure de démontrer que la personne a donné son consentement »).
 * Démontrer suppose de conserver : la date, le libellé RÉELLEMENT affiché, la page d'origine,
 * et l'IP. C'est exactement la liste des colonnes ci-dessous.
 *
 * ORDRE D'ÉCRITURE : cette ligne est posée AVANT le moindre appel à Shopify. Si l'API tombe,
 * la preuve existe quand même — l'inverse serait une collecte sans preuve.
 */
export default class extends BaseSchema {
  protected tableName = 'newsletter_consent_events'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Pas de clé étrangère : ce journal doit SURVIVRE à la disparition de l'inscrit (purge
      // RGPD, suppression du client Shopify). Une contrainte avec cascade effacerait la
      // preuve au pire moment. L'e-mail est dupliqué ici pour la même raison — et il est
      // effacé par la purge RGPD, qui ne laisse alors que l'empreinte.
      table.integer('subscriber_id').unsigned().nullable().index('idx_consent_subscriber')
      table.string('email', 320).nullable()
      table.string('email_hash', 64).notNullable().index('idx_consent_email_hash')

      // subscribe | resubscribe | unsubscribe | bounce | complaint | redact
      table.string('event', 24).notNullable()

      // --- Les éléments de preuve, tels qu'ils étaient à l'instant du geste ---------
      // IPv6 comprise (45 caractères suffisent y compris pour une forme mappée IPv4).
      table.string('ip', 45).nullable()
      table.string('user_agent', 255).nullable()
      // Page depuis laquelle la personne s'est inscrite.
      table.string('source_url', 512).nullable()
      // Le libellé de consentement RÉELLEMENT AFFICHÉ, envoyé par le thème. Un libellé
      // reconstitué après coup ne prouve rien : c'est celui-ci qui fait foi.
      table.text('consent_label').nullable()
      // Version des mentions légales en vigueur ce jour-là.
      table.string('terms_version', 32).nullable()
      table.string('locale', 5).nullable()
      table.string('purpose', 32).nullable()

      /**
       * État de consentement lu chez Shopify AVANT notre écriture.
       *
       * Une colonne, deux rôles, tous deux importants :
       *   • elle prouve qu'on a REGARDÉ avant d'écrire — c'est la trace du refus quand
       *     l'adresse s'était désabonnée ;
       *   • elle rend l'opération RÉVERSIBLE. Sans elle, une écriture de consentement écrase
       *     un état que Shopify ne conserve pas, et plus personne ne peut dire ce qu'il
       *     valait avant.
       */
      table.string('prior_marketing_state', 24).nullable()

      // Instant du geste. `occurred_ts` (epoch) est la source de vérité ; `occurred_at` n'est
      // qu'un doublon lisible à l'œil nu quand on inspecte la table.
      table.bigInteger('occurred_ts').notNullable().index('idx_consent_occurred_ts')
      table.timestamp('occurred_at', { useTz: true }).notNullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
