import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'social_publications'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('channel', 20).notNullable()
      table.string('shopify_product_id', 128).notNullable()
      table.string('external_id', 128).notNullable()
      table.string('external_board_id', 128).nullable()
      table.timestamp('published_at', { useTz: true }).notNullable()
      table.json('metadata').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.index(['channel', 'shopify_product_id'], 'idx_channel_product')
      table.index('published_at', 'idx_published_at')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
