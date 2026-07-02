/**
 * Contrat commun des providers d'images CustomArt (adapter pluggable, plan §2).
 * Le provider primaire et le fallback sont choisis par env
 * (CUSTOM_ART_PRIMARY_PROVIDER / CUSTOM_ART_FALLBACK_PROVIDER), arbitrés au bench M1.
 */

export interface GenerateParams {
  /** Photo client normalisée (JPEG, max 2048px, EXIF appliqué) */
  photoBuffer: Buffer
  /**
   * Images de référence jointes après la photo (images 2..n) : réfs maillot côté foot,
   * réf(s) de style `studio.references` côté générique — même slot, même ordre d'envoi.
   */
  kitRefBuffers: Buffer[]
  /** Image de référence scène/pose (figée J1), optionnelle tant qu'elle n'est pas fournie */
  sceneRefBuffer?: Buffer | null
  /** Prompt maître complet (style pictural + pose + consignes texte) */
  prompt: string
  /** Ratio de sortie (imageConfig.aspectRatio) — défaut '3:4' (posters portrait) */
  aspect?: string
  /** Prénom à rendre sur le maillot (foot uniquement — absent côté générique) */
  playerName?: string | null
  /** Numéro 1-99 (foot uniquement — absent côté générique) */
  playerNumber?: number | null
}

export interface ProviderMeta {
  model: string
  latencyMs: number
  /** Estimation indicative en euros (suivi du cap coût quotidien, pas une facture) */
  estCostEur: number
  /** Renseigné si le modèle a refusé (modération) : message lisible, et imageBuffer est null */
  refused?: string
}

export interface GenerateResult {
  /** JPEG normalisé (sharp), ou null si refus modération (voir providerMeta.refused) */
  imageBuffer: Buffer | null
  providerMeta: ProviderMeta
}

export interface CustomArtProvider {
  /** Nom court du provider ('gemini' | 'openai' | 'replicate') */
  readonly name: string
  /** Identifiant unique du maillon de chaîne, ex 'gemini:gemini-3.1-flash-image' */
  readonly key: string
  /**
   * false pour Gemini 3.x : son filtre d'entrée (anti face-swap, vérifié au bench
   * 2026-06-10) refuse toute requête combinant la photo client et une AUTRE image
   * contenant une personne → la référence scène/pose est retirée pour ces modèles
   * et la pose est décrite uniquement en TEXTE dans le prompt maître.
   */
  readonly acceptsPersonRefs: boolean
  /** false si la clé API nécessaire n'est pas configurée (provider ignoré proprement) */
  isAvailable(): boolean
  generate(params: GenerateParams): Promise<GenerateResult>
}

/** Timeout d'une génération (plan §5 : 45 s, puis fallback automatique). */
export const GENERATION_TIMEOUT_MS = 45000

/** Race helper commun : borne un appel provider au timeout du plan. */
export function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timeout (${GENERATION_TIMEOUT_MS}ms)`)),
        GENERATION_TIMEOUT_MS
      )
    ),
  ])
}
