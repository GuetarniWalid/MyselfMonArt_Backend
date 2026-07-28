/**
 * Mesure de COULEUR d'un candidat — pour les produits vendus « noir sur blanc ».
 *
 * POURQUOI CE MODULE EXISTE
 * Le poster famille est un dessin au trait : un trait noir sur fond blanc, c'est le produit.
 * Le prompt l'interdit trois fois, et le modèle colorie quand même — observé le 28/07/2026 : sur
 * trois candidats d'une même création, UN est sorti avec des vêtements colorés, et c'est LUI que le
 * juge a classé premier. Le juge ne lit que des textes et compte des figures ; la couleur ne le
 * regardait pas. Une image fausse serait partie chez le client.
 *
 * POURQUOI UNE MESURE ET PAS UNE QUESTION À L'IA
 * « Est-ce en couleur ? » est une question à réponse binaire, calculable exactement. La confier à
 * un modèle, c'est ajouter une incertitude là où il n'y en a aucune — et payer un appel pour ça.
 *
 * FONCTION PURE, sans sharp : elle reçoit les pixels bruts déjà décodés par l'appelant. C'est ce
 * qui la rend testable avec un simple `node`, sans image ni bibliothèque native.
 */

/** Écart entre canaux (sur 255) au-delà duquel un pixel est tenu pour COLORÉ. */
export const COLOUR_CHANNEL_SPREAD = 30

/**
 * Part des pixels colorés, entre 0 et 1.
 *
 * @param pixels canal-par-pixel entrelacé (RGB ou RGBA), tel que le rend `sharp().raw()`
 * @param channels 3 (RGB) ou 4 (RGBA)
 */
export function colouredFraction(pixels: Uint8Array | Buffer, channels: number): number {
  if (channels < 3) return 0
  const total = Math.floor(pixels.length / channels)
  if (total === 0) return 0

  let coloured = 0
  for (let i = 0; i < total; i++) {
    const o = i * channels
    const r = pixels[o]
    const g = pixels[o + 1]
    const b = pixels[o + 2]
    const max = r > g ? (r > b ? r : b) : g > b ? g : b
    const min = r < g ? (r < b ? r : b) : g < b ? g : b
    if (max - min > COLOUR_CHANNEL_SPREAD) coloured++
  }
  return coloured / total
}

/**
 * Seuil de refus. Volontairement PERMISSIF : un dessin au trait est très majoritairement blanc, et
 * le JPEG invente des franges colorées le long des traits noirs (sous-échantillonnage de la
 * chrominance). En dessous de ce seuil, on est dans le bruit de compression ; au-dessus, quelqu'un
 * a colorié.
 *
 * ÉTABLI SUR 13 CANDIDATS RÉELS du poster famille, pas au jugé :
 *   - les rendus vraiment propres mesurent tous EXACTEMENT 0,000 % — le modèle, quand il obéit,
 *     produit du gris pur, et le JPEG n'ajoute pas de frange détectable à ce seuil d'écart ;
 *   - la moindre couleur VISIBLE démarre à 1,338 % (une robe jaune sur une seule figure), puis
 *     3,5 %, 8,2 %, 11,2 % quand le modèle colorie franchement.
 * Le seuil est donc posé au MILIEU DU VIDE : infiniment au-dessus des propres, 2,7 fois sous la
 * plus petite infraction observée.
 *
 * ⚠️ Une première version le posait à 2 %, sur la foi de deux mesures seulement (0 % et 11 %) et de
 * la conclusion trop rapide qu'il n'y avait « rien entre les deux ». Une robe jaune à 1,34 % est
 * alors passée. La leçon : un seuil se règle sur la plus petite infraction RÉELLE, jamais sur
 * l'écart entre les deux extrêmes.
 */
export const COLOURED_FRACTION_MAX = 0.005

/** `true` si l'image doit être refusée pour cause de couleur. */
export function isColoured(pixels: Uint8Array | Buffer, channels: number): boolean {
  return colouredFraction(pixels, channels) > COLOURED_FRACTION_MAX
}
