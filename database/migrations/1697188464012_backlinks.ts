import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'backlinks'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('site').nullable().defaultTo(null)
      table.string('url', 500).notNullable().unique()
      table.string('anchor').nullable().defaultTo(null)
      table.boolean('state').nullable().defaultTo(null)
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
