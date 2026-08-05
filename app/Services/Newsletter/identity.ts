import crypto from 'crypto'
import { CODE_ALPHABET, CODE_LENGTH, CODE_PREFIX, DEFAULT_LOCALE, LOCALES } from './config'
import type { NewsletterLocale } from './config'

/**
 * Identité d'un inscrit : normalisation, empreinte, jeton de désabonnement, tirage du code.
 *
 * Module PUR à une exception près : le secret, injecté par l'appelant. Ça rend l'ensemble
 * testable hors ligne (tests dorés) et évite qu'un secret traîne dans une constante.
 */

/**
 * Normalisation : minuscules + espaces retirés, et RIEN D'AUTRE.
 *
 * On ne retire ni les points, ni les alias `+` : ce sont des adresses DISTINCTES pour
 * Shopify, distinctes pour le fournisseur de messagerie, et les fusionner ferait répondre
 * « déjà inscrit » à quelqu'un qui ne l'est pas — ou pire, enverrait le bon de quelqu'un
 * d'autre.
 */
export function normalizeEmail(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

/**
 * Validation volontairement TOLÉRANTE sur la forme, STRICTE sur la structure.
 *
 * Le but n'est pas de deviner si l'adresse existe (seul un envoi le dit) mais d'écarter ce
 * qui ne peut pas être une adresse. Une validation trop zélée rejette des adresses valides —
 * et un client qui ne reçoit pas son bon écrit au SAV.
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false
  // Une seule arobase, du texte de part et d'autre, un point dans le domaine, pas d'espace.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) return false
  const [local, domain] = email.split('@')
  if (local.length > 64 || domain.length > 255) return false
  // Un domaine ne commence ni ne finit par un tiret, et n'a pas deux points de suite.
  if (/(^|\.)-|-(\.|$)|\.\./.test(domain)) return false
  return true
}

/** Langue affichée par le thème, ramenée à une des cinq. Repli sur le français. */
export function normalizeLocale(raw: unknown): NewsletterLocale {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 2)
  return (LOCALES as readonly string[]).includes(value)
    ? (value as NewsletterLocale)
    : DEFAULT_LOCALE
}

/**
 * Empreinte de l'adresse — HMAC-SHA256 avec un sel serveur, jamais un SHA-256 nu.
 *
 * Un SHA-256 nu se casse par dictionnaire : l'espace des adresses e-mail est petit et
 * énumérable, une table arc-en-ciel le renverse en quelques minutes. Le sel serveur rend
 * l'empreinte inexploitable hors de cette machine.
 *
 * ⚠️ CE SEL NE DOIT JAMAIS CHANGER. Le changer rendrait toute la liste repoussoir illisible
 * et réexposerait des personnes qui s'étaient plaintes — la faute exacte qui coûte un compte
 * d'envoi. Il est dérivé d'`APP_KEY` à défaut d'un secret dédié : toujours présente, jamais
 * commitée, jamais tournée.
 */
export function emailHash(email: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`email:${normalizeEmail(email)}`)
    .digest('hex')
}

/**
 * Jeton de désabonnement — HMAC-SHA256(secret, identifiant interne), en base64url.
 *
 * ⛔ Jamais l'e-mail en clair, jamais l'identifiant Shopify nu. L'URL de désabonnement est
 * publiquement atteignable et figure dans un en-tête que des robots antispam récupèrent
 * automatiquement : un identifiant devinable permettrait de désabonner des tiers EN MASSE,
 * en incrémentant un compteur. 256 bits d'entropie ferment cette porte définitivement.
 *
 * Espace de nommage `unsub:` : le même secret sert à d'autres dérivations, et deux usages
 * différents ne doivent jamais pouvoir produire le même jeton.
 */
export function unsubToken(subscriberId: number, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`unsub:${subscriberId}`).digest('base64url')
}

/**
 * Revérifie qu'un jeton correspond bien à l'inscrit trouvé en base.
 *
 * La recherche par index a déjà tranché ; ceci est une ceinture par-dessus les bretelles, au
 * cas où une ligne serait corrompue ou recopiée. Comparaison à temps constant : comparer deux
 * chaînes avec `===` fuit, par le temps de réponse, le nombre de caractères devinés.
 */
export function verifyUnsubToken(subscriberId: number, token: string, secret: string): boolean {
  const expected = Buffer.from(unsubToken(subscriberId, secret))
  const given = Buffer.from(String(token ?? ''))
  if (expected.length !== given.length) return false
  return crypto.timingSafeEqual(expected, given)
}

/**
 * Tirage d'un code nominatif : `MERCI-` + 6 caractères de l'alphabet sans ambiguïté.
 *
 * `crypto.randomInt` et non `Math.random` : ce code vaut 15 €. Un générateur prévisible
 * laisserait deviner les codes des autres inscrits.
 *
 * Le rejet du modulo est géré par `randomInt` lui-même (tirage uniforme sur [0, n[), ce qui
 * évite le biais classique d'un `% 32` sur un octet aléatoire.
 */
export function generateVoucherCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]
  }
  return `${CODE_PREFIX}${code}`
}
