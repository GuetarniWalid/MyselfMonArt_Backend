import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Notes de fidélité maillot (décision grill §0.13) : texte FR décrivant les éléments
 * iconiques du maillot domicile actuel + les pièges (bande centrale, emplacement du
 * blason, typo nom/numéro…). Injectées dans le prompt de génération et fournies au
 * juge vision pour calibrer la note de fidélité maillot. Éditables depuis l'admin.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_teams'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('fidelity_notes').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('fidelity_notes')
    })
  }
}
