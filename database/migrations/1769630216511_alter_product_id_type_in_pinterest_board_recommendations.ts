import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'pinterest_board_recommendations'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('product_id').notNullable().alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('product_id').unsigned().notNullable().alter()
    })
  }
}
