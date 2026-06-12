import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Commandes payées liées à un job CustomArt (webhook orders/paid, M9).
 * Une ligne par line item personnalisé. La file print admin (validation humaine
 * de chaque fichier avant commande Picanova) s'appuie sur print_status.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_orders'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('shopify_order_id', 64).notNullable()
      table.integer('job_id').unsigned().notNullable()
      table.string('line_item_id', 64).notNullable()
      // Clé storage du fichier print HD (après upscale Real-ESRGAN, M9)
      table.string('print_file_path', 255).nullable()
      table
        .enum('print_status', [
          'awaiting_file',
          'awaiting_review',
          'approved',
          'ordered',
          'shipped',
        ])
        .notNullable()
        .defaultTo('awaiting_file')
      table.timestamp('reviewed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['shopify_order_id', 'line_item_id'], 'uniq_order_line_item')
      table.index(['job_id'], 'idx_job_id')
      table.index(['print_status', 'created_at'], 'idx_print_status_created')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
