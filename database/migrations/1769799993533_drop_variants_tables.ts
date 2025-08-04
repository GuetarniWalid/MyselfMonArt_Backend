import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'variants'

  public async up() {
    this.schema.dropTable(this.tableName)
  }

  public async down() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.enum('name', ['square', 'portrait', 'landscape', 'personalized portrait']).notNullable()
      table.json('json').notNullable()
    })
  }
}
