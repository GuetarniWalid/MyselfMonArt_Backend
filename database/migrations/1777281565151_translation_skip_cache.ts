import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'translation_skip_cache'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('resource_id', 255).notNullable()
      table.string('resource_type', 50).notNullable()
      table.string('locale', 10).notNullable()
      table.string('region', 10).notNullable().defaultTo('')
      table.string('field_key', 100).notNullable()
      table.string('source_hash', 64).notNullable()
      table.string('reason', 255).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['resource_id', 'locale', 'region', 'field_key'], 'uniq_skip')
      table.index(['resource_id', 'locale', 'region'], 'idx_lookup')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
