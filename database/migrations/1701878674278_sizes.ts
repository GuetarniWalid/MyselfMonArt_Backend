import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'sizes'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name', 50).notNullable()
      table.integer('thickness_id').unsigned().references('id').inTable('thicknesses').onDelete('CASCADE')
      table.integer('frame_id').unsigned().references('id').inTable('frames').onDelete('CASCADE')
      table.integer('border_id').unsigned().references('id').inTable('borders').onDelete('CASCADE')
      table.integer('fixation_id').unsigned().references('id').inTable('fixations').onDelete('CASCADE')
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
