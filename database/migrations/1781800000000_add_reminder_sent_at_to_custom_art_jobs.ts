import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Relance « création sauvegardée » (M10) : date d'envoi du rappel « votre tableau
 * vous attend » envoyé 20-28 h après la création aux sessions ayant laissé un email
 * sans acheter. NULL = jamais relancé. UN seul rappel par création, jamais plus :
 * la colonne sert de verrou (claim conditionnel WHERE reminder_sent_at IS NULL).
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_jobs'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('reminder_sent_at', { useTz: true }).nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('reminder_sent_at')
    })
  }
}
