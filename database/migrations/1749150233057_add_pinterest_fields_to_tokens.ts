import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'tokens'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('access_token').nullable()
      table.dateTime('expires_at').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('access_token')
      table.dropColumn('expires_at')
    })
  }
}
