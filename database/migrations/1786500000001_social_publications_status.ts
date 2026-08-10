import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Rend la publication sociale idempotente.
 *
 * Avant : la ligne n'était écrite qu'APRÈS l'appel réseau. Si le process
 * mourait entre le post et l'insert, le produit repassait éligible le
 * lendemain et repartait une deuxième fois sur le réseau.
 *
 * Après : on RÉSERVE la ligne (`status='pending'`, `external_id` NULL) avant
 * l'appel réseau, puis on la confirme (`status='published'`). Une réservation
 * orpheline continue d'exclure le produit — on préfère perdre une publication
 * plutôt que d'en émettre deux.
 */
export default class extends BaseSchema {
  protected tableName = 'social_publications'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('status', 20).notNullable().defaultTo('published')
      // NULL tant que la plateforme n'a pas confirmé l'identifiant du post.
      table.string('external_id', 128).nullable().alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('status')
    })
  }
}
