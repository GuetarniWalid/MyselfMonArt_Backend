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

/** Un candidat généré + jugé. Les `path` sont des clés storage privées, `previewPath` = aperçu réduit. */
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
 * Entrées SANITIZÉES d'un job GÉNÉRIQUE (chemin piloté par recette produit, contrat
 * growth/STUDIO-GENERATION-RECIPE-CONTRACT.md §6). NULL = job foot (legacy).
 * ⚠️ Ne contient JAMAIS la recette (prompts) — seulement les valeurs client validées
 * + le produit porteur ; le worker relit la recette via l'Admin API (cache 5 min).
 */
export interface CustomArtGenericInputs {
  /** GID produit Shopify (ex 'gid://shopify/Product/123') — clé de relecture de la recette */
  productId: string
  /** Textes par personne, gauche -> droite (découpés, nettoyés, contrôlés) */
  tokens: string[]
  /** Champs sources du titre (sanitizés), ex { familyName: 'Martin' } */
  values: Record<string, string>
  /** Titre assemblé depuis inputs.title.template de la recette, null si non configuré */
  title: string | null
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

  /** NULL pour les jobs GÉNÉRIQUES (recette produit) — toujours renseigné côté foot. */
  @column()
  public teamId: number | null

  /** NULL pour les jobs GÉNÉRIQUES — toujours renseigné côté foot. */
  @column()
  public playerName: string | null

  /** NULL pour les jobs GÉNÉRIQUES — toujours renseigné côté foot. */
  @column()
  public playerNumber: number | null

  @column()
  public format: CustomArtFormat

  @column()
  public frame: string

  /**
   * Entrées sanitizées du chemin GÉNÉRIQUE (cf. CustomArtGenericInputs) : c'est LE
   * discriminant de routage du worker (inputs présent => processGeneric). NULL = foot.
   */
  @column({
    prepare: (value: any) => (value === null ? null : JSON.stringify(value)),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  public inputs: CustomArtGenericInputs | null

  /**
   * Type de produit envoyé par le studio (même vocabulaire que le photo-check) : clé de
   * segmentation de l'estimation glissante de la barre de progression (cf.
   * App/Services/CustomArt/JobEstimate). NULL/absent => bucket 'default'.
   */
  @column()
  public productType: string | null

  /**
   * Durée réelle création -> ready (ms), posée UNE seule fois par le worker au passage
   * AUTOMATIQUE en ready. Alimente la médiane glissante (p75) par productType d'où sort
   * `estimatedMs`. Reste NULL pour tout job jamais passé ready automatiquement (échec,
   * manual_review, ou résultat attaché à la main par l'artiste) => exclu de la stat.
   */
  @column()
  public readyDurationMs: number | null

  @column({
    prepare: (value: any) => (value === null ? null : JSON.stringify(value)),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  public candidates: CustomArtCandidate[] | null

  @column()
  public chosenIndex: number | null

  /**
   * Rang (1-based, cf. CustomArtCandidate.rank) de la version SAUVEGARDÉE par le visiteur
   * via POST /jobs/:uuid/save. Identité STABLE de la version regardée au moment du save —
   * survit aux reveals ultérieurs, contrairement à `chosenIndex` (réécrit à chaque
   * reveal-next). La reprise du lien e-mail (?ca_job=) ré-affiche CETTE version (sélection /
   * repli best validé : App/Services/CustomArt/chosenCandidate, comme l'achat). NULL =
   * jamais sauvegardé -> reprise sur le dernier révélé.
   */
  @column()
  public savedVersionRank: number | null

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
   * Nombre de relances orphelines déjà subies (worker : un job coincé en
   * generating/judging au-delà du seuil d'inactivité). Plafonné par MAX_RECOVERIES : au
   * dernier dépassement, le job part en manual_review au lieu de repartir en pending —
   * garde-fou anti-boucle si la génération/le jugement crashe le process (incident 13/06).
   */
  @column()
  public recoveryCount: number

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

  /**
   * Libellé humain de la création (emails admin, files de revue/print) — foot :
   * « WALID 10 » (sortie inchangée) ; générique : titre assemblé, sinon tokens joints.
   */
  public get displayLabel(): string {
    if (this.playerName) {
      return `${this.playerName} ${this.playerNumber ?? ''}`.trim()
    }
    if (this.inputs?.title) return this.inputs.title
    if (this.inputs?.tokens?.length) return this.inputs.tokens.join(', ')
    return ''
  }

  /** Ajoute un coût au compteur du job (mutation en place, à sauvegarder par l'appelant). */
  public addCost(step: string, eur: number, provider?: string): void {
    const costs: CustomArtCosts = this.costs || { totalEur: 0, details: [] }
    costs.details.push({ step, provider, eur: Math.round(eur * 1000) / 1000 })
    costs.totalEur = Math.round((costs.totalEur + eur) * 1000) / 1000
    this.costs = costs
  }
}
