import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'conversations'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('channel', 20).notNullable()
      table.string('external_user_id', 191).notNullable()
      table.string('external_thread_id', 191).notNullable()
      table.string('language', 8).nullable()
      table.enum('status', ['active', 'escalated', 'closed']).notNullable().defaultTo('active')
      table.timestamp('last_message_at', { useTz: true }).nullable()
      table.timestamp('escalated_at', { useTz: true }).nullable()
      table.string('escalation_reason', 191).nullable()
      table.json('metadata').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['channel', 'external_thread_id'], 'uniq_channel_thread')
      table.index(['status', 'last_message_at'], 'idx_status_last_msg')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
