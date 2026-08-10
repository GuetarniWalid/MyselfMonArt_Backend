/**
 * Garde-fou « on publie bien chez nous ».
 *
 * Le flux OAuth Instagram laisse l'utilisateur choisir le compte à connecter.
 * Une ré-autorisation faite sur le mauvais compte — c'est arrivé en production
 * le 2026-08-10, le jeton pointait sur `madebymood.app` — enverrait les œuvres
 * de la boutique chez un tiers, sans que rien ne s'y oppose et sans retour en
 * arrière une fois publié.
 *
 * Logique isolée ici, hors de toute dépendance au framework, pour qu'elle soit
 * testable : c'est le dernier rempart avant une publication irréversible.
 */
export function assertExpectedAccount(input: {
  channel: string
  username: string | undefined
  expected: string | undefined
}): void {
  const { channel, username, expected } = input

  // Non configuré : comportement historique inchangé, on ne bloque rien.
  if (!expected || !expected.trim()) return

  const actual = (username ?? '').trim().toLowerCase()
  if (actual && actual === expected.trim().toLowerCase()) return

  throw new Error(
    `${channel}: jeton connecté au compte « ${username || 'inconnu'} » alors que la boutique attend ` +
      `« ${expected} ». Publication interrompue — ré-autoriser sur le bon compte.`
  )
}
