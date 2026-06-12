import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import CustomArtSession from 'App/Models/CustomArtSession'
import CustomArtTeam from 'App/Models/CustomArtTeam'

export type CustomArtJobStatus =
  | 'pending'
  | 'generating'
  | 'judging'
  | 'ready'
  | 'failed'
  | 'expired'
  // Fallback artiste (décision grill §0.15) : photo refusée (IMAGE_SAFETY) ou 2 rounds
  // sans pass → file admin /custom-art-review + notification email
  | 'manual_review'

export type CustomArtFormat = '30x40' | '60x80'

/** Un candidat généré + jugé. Les `path` sont des clés storage privées, `previewPath` = preview watermarkée. */
export interface CustomArtCandidate {
  path: string
  previewPath: string
  provider: string
  model: string
  latencyMs: number
  estCostEur: number
  score: number
  pass: boolean
  /**
   * Score de suspicion anatomique 0-N (calibration §0.14) : nombre de signaux de zone
   * relevés par le juge (rotation impossible, segment sans main dans le cadre, sans
   * rattachement épaule…). Sert UNIQUEMENT à départager les candidats au classement
   * (on révèle le moins suspect à score égal) — jamais un échec dur.
   */
  suspicion: number
  verdicts: Record<string, any>
  rank: number
}

/** Mise en situation Photopea (M7) : remplie au fil de l'eau après le reveal. */
export interface CustomArtMockup {
  psd: string
  status: 'pending' | 'done' | 'error'
  url?: string
}

/** Coûts agrégés du job — sert au cap coût global quotidien. */
export interface CustomArtCosts {
  totalEur: number
  details: Array<{ step: string; provider?: string; eur: number }>
}

/**
 * Job de génération CustomArt, persisté en MySQL (restart-safe, contrairement à la
 * queue mémoire MockupQueue). Consommé par App/Services/CustomArt/Worker.
 */
export default class CustomArtJob extends BaseModel {
  public static table = 'custom_art_jobs'

  @column({ isPrimary: true })
  public id: number

  @column()
  public uuid: string

  @column()
  public sessionId: number

  @column()
  public status: CustomArtJobStatus

  @column()
  public photoPath: string

  @column()
  public teamId: number

  @column()
  public playerName: string

  @column()
  public playerNumber: number

  @column()
  public format: CustomArtFormat

  @column()
  public frame: string

  @column({
    prepare: (value: any) => (value === null ? null : JSON.stringify(value)),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  public candidates: CustomArtCandidate[] | null

  @column()
  public chosenIndex: number | null

  @column()
  public revealedCount: number

  @column({
    prepare: (value: any) => (value === null ? null : JSON.stringify(value)),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  public mockups: CustomArtMockup[] | null

  /**
   * Backlog mockups (M7) : true tant que des mises en situation restent à rendre
   * (moteur Photopea down ou rendu interrompu). Re-scanné par le worker toutes les 60 s ;
   * levé atomiquement quand tout est réglé (déclenche l'email « aperçus prêts »).
   */
  @column({ consume: (value: any) => Boolean(value) })
  public mockupsPending: boolean

  @column()
  public provider: string | null

  @column({
    prepare: (value: any) => (value === null ? null : JSON.stringify(value)),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  public costs: CustomArtCosts | null

  @column()
  public error: string | null

  @column()
  public round: number

  /**
   * Relance « création sauvegardée » (M10) : date d'envoi du rappel unique « votre
   * tableau vous attend » (20-28 h après création, session avec email, non acheté).
   * NULL = jamais relancé. Sert aussi de verrou anti-double envoi (claim conditionnel).
   */
  @column.dateTime()
  public reminderSentAt: DateTime | null

  /**
   * Maillon de chaîne imposé depuis la file admin (« relancer avec <provider> »),
   * ex 'gemini:gemini-3-pro-image'. NULL = chaîne automatique (env/défauts bench).
   */
  @column()
  public forcedProvider: string | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @belongsTo(() => CustomArtSession, { foreignKey: 'sessionId' })
  public session: BelongsTo<typeof CustomArtSession>

  @belongsTo(() => CustomArtTeam, { foreignKey: 'teamId' })
  public team: BelongsTo<typeof CustomArtTeam>

  /** Ajoute un coût au compteur du job (mutation en place, à sauvegarder par l'appelant). */
  public addCost(step: string, eur: number, provider?: string): void {
    const costs: CustomArtCosts = this.costs || { totalEur: 0, details: [] }
    costs.details.push({ step, provider, eur: Math.round(eur * 1000) / 1000 })
    costs.totalEur = Math.round((costs.totalEur + eur) * 1000) / 1000
    this.costs = costs
  }
}
