/**
 * Phase à laquelle une publication réseau social a échoué.
 *
 * - `prepare` : rien n'a encore été soumis à la plateforme — construction du
 *   payload, génération du texte, upload d'un média intermédiaire, création
 *   d'un conteneur, attente de traitement. Aucun post n'existe, donc réessayer
 *   dans un autre format est SÛR.
 * - `publish` : l'appel qui crée réellement le post a échoué. Le résultat est
 *   AMBIGU : un timeout réseau, un socket coupé ou un 5xx peuvent très bien
 *   survenir alors que la plateforme a déjà accepté le post. Basculer sur un
 *   format de repli ici, c'est publier deux fois le même produit — précisément
 *   le bug « un carrousel republié en simple image ».
 */
export type PublishPhase = 'prepare' | 'publish'

/**
 * Un échec en phase `publish` n'est PAS ambigu quand la plateforme a répondu un
 * 4xx explicite : la requête a été rejetée, rien n'a été créé, on peut se
 * rabattre sans risque. Tout le reste — absence de réponse (timeout, DNS,
 * socket), 5xx, 408, 429 — laisse planer le doute et interdit le repli.
 */
export function isDefinitiveRejection(cause: unknown): boolean {
  const status = (cause as any)?.response?.status
  if (typeof status !== 'number') return false
  if (status === 408 || status === 429) return false
  return status >= 400 && status < 500
}

export class PublishError extends Error {
  public readonly phase: PublishPhase
  public readonly ambiguous: boolean
  public readonly cause: unknown

  constructor(message: string, phase: PublishPhase, cause?: unknown) {
    super(message)
    this.name = 'PublishError'
    this.phase = phase
    this.cause = cause
    this.ambiguous = phase === 'publish' && !isDefinitiveRejection(cause)
  }
}

/**
 * `true` quand l'échec peut cacher un post réellement créé. Dans ce cas on ne
 * republie JAMAIS : on tente une réconciliation auprès de la plateforme, et à
 * défaut on abandonne le tick.
 */
export function isAmbiguousPublishFailure(error: unknown): boolean {
  return error instanceof PublishError && error.ambiguous
}

/** Message court et lisible pour les logs. */
export function describeError(error: unknown): string {
  if (error instanceof PublishError) {
    return `${error.message} (phase=${error.phase}, ambigu=${error.ambiguous})`
  }
  return (error as any)?.message ?? String(error)
}
