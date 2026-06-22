import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  public async up() {
    // 1) Add the 'drafted' status to inbox_messages for the email channel's
    //    draft-first flow (reply saved as a Gmail draft, not auto-sent).
    this.schema.alterTable('inbox_messages', (table) => {
      table
        .enum('status', [
          'pending',
          'processing',
          'replied',
          'escalated',
          'failed',
          'skipped',
          'drafted',
        ])
        .notNullable()
        .defaultTo('pending')
        .alter()
    })

    // 2) Track Gmail incremental sync state (historyId + watch expiration) so a
    //    push notification only processes messages added since the last sync,
    //    never the whole mailbox backlog. Single-row table.
    this.schema.createTable('gmail_sync_state', (table) => {
      table.increments('id')
      table.string('email_address', 191).nullable()
      table.string('last_history_id', 64).nullable()
      table.bigInteger('watch_expiration').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  public async down() {
    this.schema.dropTable('gmail_sync_state')
    this.schema.alterTable('inbox_messages', (table) => {
      table
        .enum('status', ['pending', 'processing', 'replied', 'escalated', 'failed', 'skipped'])
        .notNullable()
        .defaultTo('pending')
        .alter()
    })
  }
}
