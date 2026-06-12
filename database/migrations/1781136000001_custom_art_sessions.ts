import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Sessions du studio CustomArt (poster personnalisé foot).
 * Une session = un visiteur du studio (cookie/token), avec ou sans email.
 * Sert de base aux caps anti-abus : essais/jour par session + ip_hash, relevés par email.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_sessions'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // Jeton opaque remis au navigateur (cookie + miroir sessionStorage côté front)
      table.string('session_token', 64).notNullable().unique('uniq_session_token')
      // Email associé via « Sauvegarder ma création » (nullable tant que le visiteur reste anonyme)
      table.string('email', 191).nullable()
      // Hash SHA-256 (salé APP_KEY) de l'IP : caps anti-abus sans stocker l'IP en clair (RGPD)
      table.string('ip_hash', 64).notNullable()
      // Compteur d'essais cumulés (info) ; les caps/jour sont calculés sur custom_art_jobs.created_at
      table.integer('essais_count').unsigned().notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['ip_hash'], 'idx_ip_hash')
      table.index(['email'], 'idx_email')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
