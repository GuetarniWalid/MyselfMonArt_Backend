import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'variants'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.enum('name', ['square', 'portrait', 'landscape']).notNullable()
      table.json('json').notNullable()
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
