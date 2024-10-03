import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'variants'

  public async up() {
    this.schema.raw(`
      ALTER TABLE ${this.tableName}
      MODIFY COLUMN name ENUM('square', 'portrait', 'landscape', 'personalized portrait') NOT NULL
    `)
  }

  public async down() {
    await this.schema.raw(`
      DELETE FROM ${this.tableName} 
      WHERE name = 'personalized portrait'
    `)

    this.schema.raw(`
      ALTER TABLE ${this.tableName}
      MODIFY COLUMN name ENUM('square', 'portrait', 'landscape') NOT NULL
    `)
  }
}
