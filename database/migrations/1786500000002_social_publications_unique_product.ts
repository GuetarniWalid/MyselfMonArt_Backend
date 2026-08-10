import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Garantit « un produit = une seule publication par canal » au niveau de la BASE.
 *
 * Les garde-fous applicatifs (réservation `pending`, registre des publications
 * manuelles) couvrent les causes constatées, mais ils lisent puis écrivent :
 * deux exécutions qui se chevauchent — le cron et un `instagram:publish_next
 * --yes` lancé à la main, par exemple — peuvent lire le même état et insérer
 * toutes les deux. Seule une contrainte d'unicité ferme cette fenêtre.
 *
 * ATTENTION — la contrainte est incréable tant qu'il reste des doublons. Le
 * DELETE ci-dessous ne garde que la PREMIÈRE ligne de chaque groupe (le plus
 * petit `id`) ; le produit reste donc exclu des prochaines sélections. Il ne
 * supprime QUE des lignes de registre : les publications déjà en ligne sur
 * Pinterest ou Instagram ne sont pas touchées. En production les 3 doublons
 * hérités de juin ont déjà été purgés à la main (sauvegarde :
 * /root/backups/social_publications_dupes_2026-08-10.sql), l'instruction y est
 * donc sans effet — elle est là pour que la migration passe aussi sur une base
 * qui aurait dérivé, plutôt que de faire échouer le déploiement.
 */
export default class extends BaseSchema {
  protected tableName = 'social_publications'

  public async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        DELETE s FROM ${this.tableName} s
        JOIN (
          SELECT channel, shopify_product_id, MIN(id) AS keep_id
          FROM ${this.tableName}
          GROUP BY channel, shopify_product_id
          HAVING COUNT(*) > 1
        ) d
          ON d.channel = s.channel
         AND d.shopify_product_id = s.shopify_product_id
        WHERE s.id <> d.keep_id
      `)
    })

    this.schema.alterTable(this.tableName, (table) => {
      // L'index non unique posé à la création devient redondant : la contrainte
      // d'unicité sert exactement les mêmes lectures.
      table.dropIndex(['channel', 'shopify_product_id'], 'idx_channel_product')
      table.unique(['channel', 'shopify_product_id'], 'uq_channel_product')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['channel', 'shopify_product_id'], 'uq_channel_product')
      table.index(['channel', 'shopify_product_id'], 'idx_channel_product')
    })
  }
}
