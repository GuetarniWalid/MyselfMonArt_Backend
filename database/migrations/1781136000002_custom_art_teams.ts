import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Bibliothèque d'équipes curée (~15 équipes) pour le poster personnalisé foot.
 * Les images de maillots de référence (kit_ref_urls) sont uploadées côté admin (M4)
 * et servent d'images de référence aux providers de génération.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_teams'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name', 100).notNullable()
      table.string('slug', 100).notNullable().unique('uniq_team_slug')
      // Alias de recherche côté studio (ex: ["om", "olympique de marseille"])
      table.json('aliases').nullable()
      // 1-2 URLs publiques (DO Spaces) du maillot domicile, références pour la génération
      table.json('kit_ref_urls').nullable()
      // Couleurs du club pour les pastilles du studio (ex: { primary: "#009ddc", secondary: "#fff" })
      table.json('colors').nullable()
      table.boolean('active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['active'], 'idx_active')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
