/**
 * CE QU'ON RÉPOND À UNE ADRESSE DÉJÀ CONNUE — module PUR (aucun import), pour que les tests
 * dorés le chargent sans base, sans réseau et sans monter l'application.
 *
 * ⛔ LE DÉFAUT QUE CE FICHIER EXISTE POUR EMPÊCHER.
 *
 * L'encart produit considère la réponse comme un ÉCHEC dès que le champ `code` est absent
 * (`!data.ok || !data.code`). Toute réponse sans code affiche donc « votre inscription n'a pas
 * abouti », QUEL QUE SOIT `state` — le thème ne lit même pas ce champ. Une personne déjà
 * inscrite qui resoumet son adresse repartait ainsi sans rien, alors qu'elle a un bon valide,
 * ou qu'elle y a droit.
 *
 * D'où la règle unique : ON NE REND JAMAIS LA MAIN SANS CODE À QUELQU'UN QUI EST EN DROIT
 * D'EN AVOIR UN. Trois situations, trois actions, et l'ordre ci-dessous ne s'inverse pas.
 */

export type ReplayAction =
  /** Le bon en cours est encore valide : on le renvoie tel quel. C'est une LECTURE. */
  | 'return'
  /** Plus rien de valide à renvoyer, mais la personne y a droit : on émet un bon neuf. */
  | 'reissue'
  /** On ne donne rien, et c'est délibéré (ligne terminale, ou bon déjà consommé). */
  | 'refuse'

export interface ReplaySnapshot {
  /** Statut de l'inscrit. Seul `active` peut recevoir quoi que ce soit. */
  status: string
  discountCode: string | null
  /**
   * Instant de fin RÉEL du code chez Shopify (epoch s) — jamais la date annoncée, qui tombe un
   * jour plus tôt. C'est lui qui dit si le code marche encore au moment où on répond.
   */
  discountExpiresTs: number | null
  /** Renseigné dès que Shopify a signalé le code consommé — LE signal de conversion. */
  codeConsumedTs: number | null
}

export interface ReplayDecision {
  action: ReplayAction
  /** Motif journalisable : c'est lui qui rend la décision diagnosticable après coup. */
  reason: string
}

/**
 * L'ORDRE DES RÈGLES, et ce que chacune coûte si on la déplace :
 *
 *   1. STATUT TERMINAL d'abord. Se réabonner après un désabonnement, un rebond dur ou une
 *      plainte passe par un humain — jamais par l'encart. Émettre un bon ici, ce serait
 *      relancer commercialement quelqu'un qui a demandé le contraire.
 *   2. BON ENCORE VALIDE : on le renvoie, on ne le remplace pas. Réémettre à chaque
 *      soumission laisserait derrière soi une traînée de remises vivantes et non réclamées,
 *      et ferait annoncer dans E2/E3 un code différent de celui affiché à l'écran.
 *   3. BON DÉJÀ CONSOMMÉ **et** expiré : rien de neuf. Le cadeau de bienvenue a été honoré ;
 *      en émettre un second ferait de l'encart un robinet à remises pour qui sait attendre
 *      sept jours. ⚠️ Cette règle vient APRÈS la 2 : un bon consommé mais encore dans sa
 *      fenêtre reste RENVOYÉ à son propriétaire — c'est son code, il a le droit de le relire.
 *   4. Sinon on émet : bon expiré, ou bon jamais créé (l'inscription avait été enregistrée
 *      mais l'appel à Shopify avait échoué — `sequence_stop_reason = voucher_failed`).
 */
export function decideReplay(snapshot: ReplaySnapshot, nowTs: number): ReplayDecision {
  if (snapshot.status !== 'active') {
    return { action: 'refuse', reason: `statut ${snapshot.status}` }
  }

  const alive =
    !!snapshot.discountCode &&
    snapshot.discountExpiresTs !== null &&
    snapshot.discountExpiresTs > nowTs

  if (alive) return { action: 'return', reason: 'bon encore valide' }

  if (snapshot.codeConsumedTs) return { action: 'refuse', reason: 'bon déjà utilisé' }

  return {
    action: 'reissue',
    reason: snapshot.discountCode ? 'bon expiré' : 'aucun bon émis',
  }
}
