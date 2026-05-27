import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'conversation_messages'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('conversation_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('conversations')
        .onDelete('CASCADE')
      table.enum('role', ['user', 'assistant', 'tool']).notNullable()
      table.text('content', 'longtext').nullable()
      table.json('tool_calls').nullable()
      table.string('external_message_id', 191).nullable()
      table.integer('cost_cents').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['conversation_id', 'created_at'], 'idx_conv_created')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
