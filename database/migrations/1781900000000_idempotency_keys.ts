import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Store d'idempotence PARTAGÉ entre tous les workers PM2 (mode cluster `instances:'max'`).
 * Avant : l'anti-doublon de la publication vivait dans des Map statiques EN MÉMOIRE du
 * process -> chaque worker avait les siennes -> un re-clic (après un 524) load-balancé vers
 * un AUTRE worker ne voyait pas la clé et republiait => produit en double. La contrainte
 * UNIQUE sur `key` rend la réservation atomique entre tous les process via le moteur MySQL.
 */
export default class extends BaseSchema {
  protected tableName = 'idempotency_keys'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // clé de dédup, namespacée : `publish:<uuid>`, `reimage:<productId>:<uuid>`,
      // `reimage_product:<productId>` (verrou produit du mode reimage).
      table.string('key', 191).notNullable().unique()
      table.enum('status', ['pending', 'done']).notNullable().defaultTo('pending')
      // résultat à renvoyer tel quel aux re-clics dédupliqués ({ success, data:{ link } } — minuscule).
      table.text('result', 'longtext').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      // balayage des entrées périmées (reprise des verrous orphelins + purge des résultats vieux).
      table.index(['updated_at'], 'idx_idem_updated')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
