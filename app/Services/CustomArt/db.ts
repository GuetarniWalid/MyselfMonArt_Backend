/**
 * Nombre de lignes affectées par un `.update()` du query builder Lucid : selon la
 * version du driver MySQL, le retour est un NOMBRE ou un tableau [nombre] —
 * on normalise (le destructuring direct `const [n] = ...` plantait au runtime :
 * « (intermediate value) is not iterable »). Utilisé par les verrous optimistes
 * (claim de job, revealed_count, essais_count).
 */
export function affectedRows(result: unknown): number {
  return Number(Array.isArray(result) ? result[0] : result) || 0
}
