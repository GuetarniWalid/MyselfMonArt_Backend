import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Inscrits à la séquence du bon de 15 € — l'ÉTAT VIVANT d'une personne.
 *
 * Cette table ne détient PAS le consentement : la vérité du consentement est chez Shopify
 * (`marketingState`), relue avant chaque envoi et jamais mise en cache. Ce qu'elle détient,
 * c'est tout ce que Shopify ne sait pas dire :
 *
 *   • la FINALITÉ (`purpose`) — à quelle séquence la personne a consenti. C'est la colonne la
 *     plus importante du dispositif : la boutique compte ~750 abonnés dormants marqués
 *     `SUBSCRIBED` chez Shopify. Une règle « Shopify dit oui, j'envoie » les réveillerait tous
 *     et détruirait un domaine d'envoi neuf. Ils n'ont pas de ligne ici : ils sont
 *     STRUCTURELLEMENT hors d'atteinte, pas protégés par un filtre qu'on pourrait oublier.
 *   • la JOIGNABILITÉ (`status = bounced`) — un rebond arrête l'envoi mais ne touche JAMAIS au
 *     consentement Shopify : `UNSUBSCRIBED` veut dire « s'était abonné puis s'est retiré », et
 *     l'écrire sur un rebond falsifierait le registre de consentement.
 *   • l'ÉTAT DE SÉQUENCE et le code nominatif émis.
 *   • le JETON de désabonnement.
 *
 * Instants : tout ce qui décide d'une action est un BIGINT epoch, jamais un TIMESTAMP. Un
 * entier ressort de la base tel qu'il y est entré ; un TIMESTAMP se fait réinterpréter par le
 * fuseau de session MySQL puis par celui du process Node — un décalage silencieux d'une à deux
 * heures selon la saison. Le projet s'est déjà fait avoir (cf. `promo_rotations.ends_ts`).
 */
export default class extends BaseSchema {
  protected tableName = 'newsletter_subscribers'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Adresse normalisée (minuscules + trim). UNIQUE : c'est la garde d'idempotence de
      // l'inscription — deux soumissions du même formulaire ne créent qu'un inscrit.
      //
      // NULLABLE, et c'est une exigence RGPD, pas une négligence : l'effacement (art. 17)
      // doit pouvoir vider l'adresse en gardant la ligne, son empreinte et son historique
      // d'envoi. Avec un `notNullable`, aucune purge — automatique ou manuelle — ne serait
      // exprimable, et le dispositif accumulerait des adresses à vie. MySQL autorise
      // plusieurs NULL sous un index UNIQUE : les lignes effacées ne se gênent pas entre
      // elles.
      table.string('email', 320).nullable().unique('uniq_newsletter_email')

      // SHA-256(sel serveur + email). Sert à retrouver la personne dans la liste repoussoir
      // APRÈS une purge RGPD, quand l'adresse en clair n'existe plus nulle part.
      table.string('email_hash', 64).notNullable().index('idx_newsletter_email_hash')

      // Langue AFFICHÉE au moment de l'inscription. C'est le local qui fait foi à l'envoi :
      // `Customer.locale` chez Shopify est modifiable par d'autres écrivains (admin, compte
      // client, thème) et pourrait changer entre l'inscription et E3.
      table.string('locale', 5).notNullable().defaultTo('fr')

      // ⛔ LE MARQUEUR DE FINALITÉ. Ne jamais envoyer à quelqu'un qui n'a pas la valeur
      // attendue ici. cf. l'en-tête de ce fichier.
      table.string('purpose', 32).notNullable().defaultTo('bon15')

      // GID Shopify, mémorisé pour que les vérifications d'avant-envoi se fassent PAR
      // IDENTIFIANT et jamais par recherche sur l'e-mail (moins cher, et insensible à un
      // changement d'adresse côté Shopify).
      table.string('shopify_customer_id', 64).nullable()

      // active | unsubscribed | bounced | complained | converted | redacted
      // Un seul de ces états autorise l'envoi : `active`.
      table.string('status', 16).notNullable().defaultTo('active')

      // --- Code nominatif (cf. NewsletterVoucher) ------------------------------------
      // UNIQUE : deux inscrits ne peuvent pas se voir attribuer le même code, même en cas de
      // collision du tirage aléatoire — la base tranche avant Shopify.
      table.string('discount_code', 32).nullable().unique('uniq_newsletter_discount_code')
      table.string('discount_gid', 128).nullable()
      table.bigInteger('discount_expires_ts').nullable()
      // Renseigné dès que Shopify signale le code consommé : c'est LE signal de conversion,
      // le seul qui fonctionne même si la personne a payé en invité avec une autre adresse.
      table.bigInteger('code_consumed_ts').nullable()

      // --- Séquence ------------------------------------------------------------------
      // Départ de la séquence. Sert au TEXTE des e-mails (« vous avez demandé votre bon
      // le JJ/MM ») et au journal — plus jamais à décider d'une échéance : voir ci-dessous.
      table.bigInteger('sequence_started_ts').notNullable()

      // Prochain e-mail attendu (1|2|3) et son échéance.
      //
      // ⛔ L'ÉCHÉANCE EST RÉANCRÉE SUR L'ENVOI RÉEL DU PRÉCÉDENT, jamais recalculée depuis
      // l'inscription. La différence n'est pas cosmétique, c'est la protection contre le pire
      // scénario d'exploitation non surveillée :
      //
      //   Panne de quatre jours. Une personne inscrite il y a huit jours a E1 non parti, et
      //   E2 comme E3 déjà « en retard ». Avec des décalages calculés depuis l'inscription,
      //   le premier tour réussi enverrait E1, puis E2 quinze minutes plus tard, puis E3
      //   quinze minutes après : trois e-mails commerciaux en quarante-cinq minutes, à tout
      //   l'arriéré d'un coup. Une seule plainte, et le seuil de 0,08 % est dépassé douze
      //   fois.
      //
      // Réancrer sur l'envoi réel (E2 = E1 + 3 j, E3 = E2 + 4 j) fait qu'un rattrapage
      // s'étale exactement comme une séquence normale. Une séquence à l'heure tombe toujours
      // à J+3 et J+7.
      table.tinyint('next_email').nullable()
      table.bigInteger('next_email_due_ts').nullable()
      // Vrai dès que la séquence est terminée OU arrêtée, quelle qu'en soit la raison. Sert
      // uniquement à BORNER le balayage du cron : sans lui, le scan des 15 minutes grossirait
      // indéfiniment avec les années.
      table.boolean('sequence_done').notNullable().defaultTo(false)
      // Raison de l'arrêt, pour l'inspection à l'œil nu (converted, unsubscribed, bounced…).
      table.string('sequence_stop_reason', 32).nullable()

      // --- Désabonnement --------------------------------------------------------------
      // HMAC-SHA256(clé serveur, id) en base64url. Stocké pour être RECHERCHÉ (index) — on ne
      // recalcule jamais un HMAC sur une entrée utilisateur pour retrouver la ligne.
      table.string('unsub_token', 64).notNullable().unique('uniq_newsletter_unsub_token')
      table.bigInteger('unsubscribed_ts').nullable()
      table.bigInteger('bounced_ts').nullable()
      table.bigInteger('complained_ts').nullable()

      // --- Réconciliation Shopify ------------------------------------------------------
      // L'écriture locale est TOUJOURS en avance sur Shopify (§6 du brief) : on bloque ici, on
      // répond, puis on propage. Ces colonnes portent la file de rejeu.
      table.boolean('shopify_sync_pending').notNullable().defaultTo(false)
      table.integer('shopify_sync_attempts').notNullable().defaultTo(0)
      table.text('shopify_sync_error').nullable()
      table.timestamp('shopify_synced_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Balayage du cron : les seules lignes à examiner sont les séquences encore ouvertes
      // et effectivement dues. Sans `sequence_done` en tête, ce scan grossirait indéfiniment
      // avec les années.
      table.index(['status', 'sequence_done', 'next_email_due_ts'], 'idx_newsletter_sequence_scan')
      // Balayage du rejeu de synchronisation Shopify.
      table.index(['shopify_sync_pending'], 'idx_newsletter_sync_pending')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
