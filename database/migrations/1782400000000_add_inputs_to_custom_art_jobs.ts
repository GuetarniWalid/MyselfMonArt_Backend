import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Chemin GÉNÉRIQUE piloté par recette produit (metafield `studio.recipe` — contrat
 * growth/STUDIO-GENERATION-RECIPE-CONTRACT.md §6, signé 2026-07-02).
 *
 * - `inputs` (JSON MySQL) : le set d'entrées SANITIZÉES d'un job générique
 *   `{ productId, tokens: [...], values: {...}, title }`. NULL = job foot (legacy).
 *   La RECETTE elle-même n'est JAMAIS persistée ici (relue par le worker via l'Admin
 *   API, cache 5 min) : seuls les inputs client validés/nettoyés le sont.
 * - `team_id` / `player_name` / `player_number` passent NULLABLE : ces colonnes foot
 *   restent intactes pour le chemin legacy (toujours renseignées), mais un job
 *   générique n'a ni équipe ni prénom/numéro. C'est LE complément indispensable à la
 *   colonne `inputs` (amendement B.3 du contrat).
 *
 * ⚠️ down : le retour en NOT NULL échouerait si des jobs génériques (valeurs NULL)
 * existent encore — purger/convertir avant tout rollback.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_jobs'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('inputs').nullable().after('frame')
      table.integer('team_id').unsigned().nullable().alter()
      table.string('player_name', 20).nullable().alter()
      table.integer('player_number').unsigned().nullable().alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('inputs')
      table.integer('team_id').unsigned().notNullable().alter()
      table.string('player_name', 20).notNullable().alter()
      table.integer('player_number').unsigned().notNullable().alter()
    })
  }
}
