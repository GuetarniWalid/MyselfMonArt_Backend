import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tokens'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('refresh_token').alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('refresh_token', 255).alter()
    })
  }
}
