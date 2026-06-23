import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Version ACHETÉE figée par ligne de commande (navigateur de versions du studio).
 *
 * `candidate_rank` = le RANG (1-based, cf. CustomArtCandidate.rank) du candidat affiché
 * au moment de l'ajout au panier. C'est l'identité STABLE de la version : elle survit aux
 * reveals/générations ultérieurs, contrairement à custom_art_jobs.chosen_index (pointeur
 * unique réécrit à chaque reveal-next = DERNIER runner-up révélé, pas celui affiché).
 *
 * Le fichier print (App/Services/CustomArt/PrintFileService) sélectionne le candidat par
 * ce rang : acheter une version ANTÉRIEURE imprime bien cette version-là.
 * NULL = flux historique (avant navigateur de versions) -> repli sur chosen_index.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_orders'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('candidate_rank').unsigned().nullable().after('job_id')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('candidate_rank')
    })
  }
}
