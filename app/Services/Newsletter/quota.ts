/**
 * LE PLAFOND DES ÉMISSIONS — module PUR (aucun import), chargeable par les tests dorés.
 *
 * ⛔ CE QU'IL COMPTE, ET CE QU'IL NE COMPTE PAS. Une seule route sert deux gestes de nature
 * différente :
 *
 *   • RENVOYER un bon existant est une LECTURE — aucune inscription créée, aucune remise
 *     Shopify, aucun e-mail. Ça ne coûte rien et ça ne peut rien abîmer.
 *   • ÉMETTRE un bon (première inscription, ou réémission après expiration) est une CRÉATION :
 *     une remise de plus dans l'admin, du quota d'API consommé, de l'argent engagé.
 *
 * Les soumettre au même plafond revenait à bloquer un client légitime qui voulait simplement
 * retrouver son code — le pire faux positif possible, puisqu'il frappe exactement les personnes
 * qui reviennent. Seules les ÉMISSIONS sont comptées ici ; les lectures sont libres.
 *
 * Le comptage se fait sur le journal de preuve, qui est append-only : rien ne peut le remettre
 * à zéro, ni un redémarrage, ni un déploiement, ni l'autre instance PM2 — contrairement aux
 * compteurs en mémoire du middleware `throttle`.
 */

export type QuotaScope = 'day' | 'hour'

export interface QuotaWindow {
  /** Nommée pour que l'encart puisse dire « réessayez demain » plutôt que « dans un instant ». */
  scope: QuotaScope
  /** Horodatages (epoch s) des ÉMISSIONS déjà portées au journal. Ordre quelconque. */
  issuedTs: number[]
  /** Nombre d'émissions tolérées dans la fenêtre. */
  max: number
  /** Largeur de la fenêtre, en secondes. */
  seconds: number
}

export interface QuotaVerdict {
  blocked: boolean
  scope?: QuotaScope
  /** Secondes à attendre avant qu'une place se libère. Toujours ≥ 1 quand `blocked`. */
  retryAfter?: number
}

/**
 * Verdict sur plusieurs fenêtres à la fois (par adresse, par IP…).
 *
 * ⚠️ FENÊTRE GLISSANTE, pas une fenêtre fixe : `retryAfter` est le temps qu'il reste à la plus
 * ancienne émission bloquante avant de sortir de la fenêtre. Un compteur à fenêtre fixe
 * répondrait « réessayez dans 3 s » à 23:59:57 puis rouvrirait tout d'un coup — et surtout, il
 * ferait mentir le message affiché au client.
 *
 * Quand deux fenêtres bloquent, on renvoie LA PLUS LONGUE : c'est la seule attente qui soit
 * vraie. Annoncer la plus courte ferait revenir la personne pour se faire refuser à nouveau.
 */
export function decideQuota(windows: QuotaWindow[], nowTs: number): QuotaVerdict {
  let verdict: QuotaVerdict = { blocked: false }

  for (const window of windows) {
    if (window.max <= 0) continue

    const since = nowTs - window.seconds
    const inside = window.issuedTs.filter((ts) => ts > since).sort((a, b) => a - b)
    if (inside.length < window.max) continue

    // La place se libère quand assez d'anciennes émissions sont sorties de la fenêtre. Avec
    // exactement `max` émissions dedans, c'est la plus ancienne ; s'il y en a davantage (une
    // course, ou un plafond abaissé après coup), il faut attendre la (n − max + 1)ᵉ.
    const decisive = inside[inside.length - window.max]
    const retryAfter = Math.max(1, decisive + window.seconds - nowTs)

    if (!verdict.blocked || retryAfter > verdict.retryAfter!) {
      verdict = { blocked: true, scope: window.scope, retryAfter }
    }
  }

  return verdict
}
