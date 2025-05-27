import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'webhook_logs'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('webhook_id').notNullable().unique()
      table.string('topic').notNullable()
      table.string('shop').notNullable()
      table.enum('status', ['processing', 'completed', 'failed']).notNullable()
      table.text('error').nullable()
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
