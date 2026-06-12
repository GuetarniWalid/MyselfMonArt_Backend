import BaseSchema from '@ioc:Adonis/Lucid/Schema'

/**
 * Jobs de génération CustomArt — persistés en MySQL (PAS la queue mémoire existante,
 * non restart-safe). Le worker in-process (App/Services/CustomArt/Worker) consomme les
 * jobs `pending` et re-scanne les orphelins `generating|judging` au boot.
 */
export default class extends BaseSchema {
  protected tableName = 'custom_art_jobs'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // UUID public exposé au front (polling) ; l'id auto-increment reste interne
      table.string('uuid', 36).notNullable().unique('uniq_job_uuid')
      table.integer('session_id').unsigned().notNullable()
      table
        .enum('status', ['pending', 'generating', 'judging', 'ready', 'failed', 'expired'])
        .notNullable()
        .defaultTo('pending')
      // Clé storage (DO Spaces) de la photo source — JAMAIS exposée publiquement
      table.string('photo_path', 255).notNullable()
      table.integer('team_id').unsigned().notNullable()
      table.string('player_name', 20).notNullable()
      table.integer('player_number').unsigned().notNullable()
      // '30x40' | '60x80'
      table.string('format', 10).notNullable()
      // Finition cadre (slug) : 'none' + 5 finitions admin
      table.string('frame', 30).notNullable()
      // [{ path, previewPath, provider, model, latencyMs, estCostEur, score, pass, verdicts, rank }]
      table.json('candidates').nullable()
      // Index (dans le tableau candidates) du candidat actuellement montré au client
      table.integer('chosen_index').nullable()
      // Nombre de candidats déjà révélés (1 au reveal initial, puis reveal-next)
      table.integer('revealed_count').unsigned().notNullable().defaultTo(0)
      // [{ psd, status: 'pending'|'done'|'error', url? }] — rempli par le moteur Photopea (M7)
      table.json('mockups').nullable()
      // Provider du candidat retenu (trace)
      table.string('provider', 30).nullable()
      // { totalEur, details: [{ step, provider, eur }] } — sert au cap coût global quotidien
      table.json('costs').nullable()
      table.text('error').nullable()
      // Round de génération en cours (round 2 silencieux si 0 pass, max 2)
      table.integer('round').unsigned().notNullable().defaultTo(1)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['status', 'created_at'], 'idx_status_created')
      table.index(['session_id', 'created_at'], 'idx_session_created')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
