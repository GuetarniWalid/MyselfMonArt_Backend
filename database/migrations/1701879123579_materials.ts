import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'materials'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('size_id').unsigned().references('id').inTable('sizes').onDelete('CASCADE')
      table.string('name', 50).notNullable()
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
