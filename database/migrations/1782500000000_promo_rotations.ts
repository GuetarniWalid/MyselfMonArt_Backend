import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Journal de la rotation automatique du code promo de l'encart produit (une ligne par
 * semaine ISO). Trois rôles, dans cet ordre d'importance :
 *
 *   1. GARDE D'IDEMPOTENCE — `UNIQUE(iso_week)` : deux lancements concurrents ne peuvent
 *      pas créer deux fois la remise de la semaine. Combiné au code DÉTERMINISTE (dérivé
 *      de la semaine ISO par HMAC), rejouer le cron est sans effet.
 *   2. MÉMOIRE DE MÉNAGE — `discount_gid` + `ends_at` permettent de désactiver plus tard
 *      UNIQUEMENT les remises que ce cron a créées, jamais celles du marchand.
 *   3. JOURNAL + SANTÉ — alimente `GET /promo/status` et l'alerte « rotation en échec »
 *      sans jamais interroger l'admin Shopify.
 *
 * ⚠️ La présence d'une ligne ne suffit PAS à sauter le travail : seul `status = 'published'`
 * le fait. Une semaine créée mais non publiée doit pouvoir être retentée au tour suivant
 * (§8 du brief : réessayer, ne jamais rester bloqué).
 */
export default class extends BaseSchema {
  protected tableName = 'promo_rotations'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // Semaine ISO ciblée, ex. "2026-W32" — clé d'idempotence
      table.string('iso_week', 10).notNullable().unique('uniq_promo_rotation_iso_week')
      // Code publié, ex. "MERCI-K7QXR" (déterministe : HMAC(secret, iso_week))
      table.string('code', 32).notNullable()
      // Fin de validité de la remise, deux fois. `ends_ts` (secondes epoch) est la SOURCE DE
      // VÉRITÉ : un entier ressort de la base tel qu'il y est entré, là où un TIMESTAMP se
      // fait réinterpréter par le fuseau de session MySQL puis par celui du process Node —
      // un décalage silencieux de une à deux heures selon la saison. `ends_at` n'est qu'un
      // doublon lisible à l'œil nu quand on inspecte la table ; aucun code ne s'en sert.
      table.timestamp('ends_at', { useTz: true }).notNullable()
      table.bigInteger('ends_ts').notNullable()
      // GID de la remise Shopify, renseigné seulement après RELECTURE confirmée
      table.string('discount_gid', 128).nullable()
      // 'pending' (créée en base, pas encore publiée) | 'published' (métachamps écrits)
      table.string('status', 16).notNullable().defaultTo('pending')
      table.timestamp('published_at', { useTz: true }).nullable()
      // Nombre de passages en échec sur cette semaine : 2 déclenchent l'alerte e-mail
      table.integer('attempts').notNullable().defaultTo(0)
      table.text('last_error').nullable()
      // Verrou anti-spam de l'alerte (une seule par semaine ISO)
      table.timestamp('alert_sent_at', { useTz: true }).nullable()
      // Ménage : remise désactivée (endsAt dépassé de plus de 30 jours)
      table.timestamp('deactivated_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Balayage du ménage mensuel (remises expirées depuis longtemps)
      table.index(['ends_at'], 'idx_promo_rotation_ends_at')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
