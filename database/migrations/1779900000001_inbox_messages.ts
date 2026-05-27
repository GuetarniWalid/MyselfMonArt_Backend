import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'inbox_messages'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('channel', 20).notNullable()
      table.string('external_message_id', 191).notNullable()
      table.string('external_thread_id', 191).nullable()
      table.string('external_user_id', 191).nullable()
      table.json('raw_payload').notNullable()
      table
        .enum('status', ['pending', 'processing', 'replied', 'escalated', 'failed', 'skipped'])
        .notNullable()
        .defaultTo('pending')
      table.integer('attempts').notNullable().defaultTo(0)
      table.text('last_error').nullable()
      table.timestamp('processed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['channel', 'external_message_id'], 'uniq_channel_external_msg')
      table.index(['status', 'created_at'], 'idx_status_created')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
