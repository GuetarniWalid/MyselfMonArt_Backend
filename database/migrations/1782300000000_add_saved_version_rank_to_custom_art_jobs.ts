import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Version SAUVEGARDÉE par le visiteur (POST /jobs/:uuid/save « Sauvegarder ma création »).
 *
 * `saved_version_rank` = le RANG (1-based, cf. CustomArtCandidate.rank) de la version
 * REGARDÉE au moment du save (navigateur de versions du studio). Identité STABLE de la
 * version — exactement comme custom_art_orders.candidate_rank pour l'ACHAT : survit aux
 * reveals/générations ultérieurs, contrairement à custom_art_jobs.chosen_index (pointeur
 * réécrit à chaque reveal-next = dernier runner-up révélé, pas celui affiché).
 *
 * Sert la REPRISE : le lien e-mail (?ca_job=<uuid>) -> GET /jobs/:uuid ré-affiche CETTE
 * version au lieu du rang 1 par défaut. Sélection/repli par rang (version non validée /
 * hors bornes -> meilleur validé) : App/Services/CustomArt/chosenCandidate, le même
 * sélecteur que l'impression. NULL = jamais sauvegardé -> reprise sur le dernier révélé.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_jobs'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('saved_version_rank').unsigned().nullable().after('chosen_index')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('saved_version_rank')
    })
  }
}
