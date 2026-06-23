import CustomArtJob, { CustomArtCandidate } from 'App/Models/CustomArtJob'

/**
 * Candidat à IMPRIMER / afficher pour une COMMANDE — source de vérité unique partagée
 * par PrintFileService (fichier print), le webhook orders/paid (email de confirmation) et
 * la file print admin, pour qu'ils désignent TOUJOURS la même image.
 *
 * - `candidateRank` non-null (version figée au panier, navigateur de versions) : on
 *   sélectionne le candidat par son RANG stable (CustomArtCandidate.rank) ; une version
 *   antérieure reste donc imprimable même après d'autres reveals/générations.
 * - `candidateRank` null (flux historique) : repli sur job.chosenIndex (dernier révélé).
 *
 * ⚠️ Sélection par `rank`, JAMAIS par index de tableau : `candidates[]` n'est pas trié par
 * rang (le tri se fait sur une copie au reveal-next) ; `rank` est l'identité publique
 * exposée au front (URL d'aperçu `/preview/{rank-1}`).
 */
export function chosenCandidate(
  job: CustomArtJob,
  candidateRank: number | null
): CustomArtCandidate | null {
  const candidates = job.candidates || []
  if (candidateRank != null) {
    return candidates.find((c) => c.rank === candidateRank) || null
  }
  return job.chosenIndex !== null ? candidates[job.chosenIndex] || null : null
}
