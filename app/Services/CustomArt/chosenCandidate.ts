import CustomArtJob, { CustomArtCandidate } from 'App/Models/CustomArtJob'

/**
 * Candidat à IMPRIMER / afficher pour une COMMANDE — source de vérité unique partagée
 * par PrintFileService (fichier print), le webhook orders/paid (email de confirmation) et
 * la file print admin, pour qu'ils désignent TOUJOURS la même image.
 *
 * GARANTIE DE SÛRETÉ (décision Walid — chemin commande payée, zéro régression) : ne renvoie
 * JAMAIS un candidat recalé par le juge (`pass:false`). Le client ne doit jamais recevoir une
 * version non validée — y compris via un `_version_rank` forgé ou une ligne panier PÉRIMÉE
 * (créée avant le déploiement « validés seulement »). Repli sûr universel = le MEILLEUR
 * candidat validé (rang 1 ; les validés trient en tête dans Worker.rankCandidates). Ne renvoie
 * `null` QUE si le job n'a aucun candidat validé (ex. job purgé) — l'appelant escalade alors
 * proprement (PrintFileService -> print_error + email admin), jamais de crash, jamais un recalé.
 *
 * - `candidateRank` non-null + candidat VALIDÉ correspondant : on l'imprime (version figée
 *   au panier, navigateur de versions — une version antérieure reste imprimable).
 * - `candidateRank` non-null mais non validé / introuvable : repli sur le meilleur validé.
 * - `candidateRank` null (vieilles commandes) : dernier révélé (job.chosenIndex) s'il est
 *   validé, sinon repli sur le meilleur validé.
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
  // Meilleur candidat validé = plus petit rang parmi les pass (= rang 1 en pratique, le tri
  // pass-d'abord de rankCandidates garantissant des rangs validés contigus 1..K).
  const bestValidated = candidates.filter((c) => c.pass).sort((a, b) => a.rank - b.rank)[0] || null

  if (candidateRank != null) {
    const byRank = candidates.find((c) => c.rank === candidateRank)
    // Rang figé valide ET validé -> on l'imprime ; sinon (forgé / périmé / non-pass) repli best.
    return byRank && byRank.pass ? byRank : bestValidated
  }

  // Pas de rang figé (vieilles commandes) : dernier révélé s'il est validé, sinon best validé.
  const chosen = job.chosenIndex !== null ? candidates[job.chosenIndex] || null : null
  return chosen && chosen.pass ? chosen : bestValidated
}
