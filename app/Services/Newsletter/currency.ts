import { intlTag } from './expiry'
import type { NewsletterLocale } from './config'

/**
 * LE MONTANT ROND DANS CHAQUE DEVISE — module PUR, testable hors ligne.
 *
 * ⛔ LE PROBLÈME QUE CE FICHIER RÉSOUT. Un code à montant fixe est TOUJOURS libellé dans la
 * devise de la boutique : `DiscountAmountInput` n'a aucun champ de devise. Un code de 15 €
 * présenté à un Américain donne « −17,43 $ » au paiement, et ce montant change d'un jour à
 * l'autre. On calcule donc, à l'émission, le montant EN EUROS qui tombera sur la cible RONDE de
 * la devise du visiteur.
 *
 * ⛔ CE QU'IL NE FAUT PAS FAIRE À LA PLACE : figer un taux de change manuel par marché pour
 * obtenir « −15,00 $ » pile. Ça marche, mais la liste de prix de la boutique est un ajustement
 * en POURCENTAGE (+26,6 % sur USA et Canada), pas des prix fixes : le taux s'applique AVANT
 * l'ajustement, donc y toucher déplacerait tout le catalogue du marché. La Suisse et le
 * Royaume-Uni n'ont aucune grille dédiée — 100 % de leurs prix viennent de cette conversion.
 * Cette voie est écartée.
 */

export const VOUCHER_CURRENCIES = ['EUR', 'USD', 'CAD', 'CHF', 'GBP'] as const
export type VoucherCurrency = (typeof VOUCHER_CURRENCIES)[number]
export const DEFAULT_CURRENCY: VoucherCurrency = 'EUR'

export interface VoucherOffer {
  /** Ce que le client voit promis, dans SA devise. */
  amount: number
  /** Le seuil annoncé, dans SA devise. */
  threshold: number
}

/**
 * Les cibles RONDES par devise. Ce sont des montants d'affichage, choisis par le marchand :
 * ils ne se déduisent d'aucun taux de change et ne suivent pas les cours.
 */
export const VOUCHER_OFFERS: Record<VoucherCurrency, VoucherOffer> = {
  EUR: { amount: 15, threshold: 80 },
  USD: { amount: 15, threshold: 90 },
  CAD: { amount: 20, threshold: 130 },
  CHF: { amount: 14, threshold: 75 },
  GBP: { amount: 13, threshold: 70 },
}

/**
 * Marge de sécurité de 2 %, appliquée VERS LE HAUT sur le montant et VERS LE BAS sur le seuil.
 *
 * Entre l'émission et l'utilisation il s'écoule jusqu'à 7 jours, et le taux bouge. Cette marge
 * absorbe la dérive, ainsi que l'écart entre le taux de la BCE et celui que Shopify applique
 * réellement au paiement. Le client reçoit donc toujours AU MOINS ce qui lui a été promis, et
 * n'est jamais refusé sur un seuil qu'il croyait atteint.
 *
 * Un client qui reçoit 15,31 $ au lieu de 15 $ ne se plaint jamais ; un client qui reçoit
 * 14,96 $ écrit au service client. L'asymétrie est volontaire, et elle a un sens unique.
 */
export const FX_SAFETY_MARGIN = 0.02

/**
 * Repli PAYS → DEVISE, quand le thème n'envoie pas `currency` ou en envoie une inconnue.
 *
 * ⚠️ `locale` ne sert JAMAIS à ça : un Allemand lit en allemand et paie en euros, un Suisse
 * peut lire en français et payer en francs, un Américain lit en anglais et paie en dollars. La
 * langue et la devise sont deux axes indépendants.
 */
export const COUNTRY_CURRENCY: Record<string, VoucherCurrency> = {
  US: 'USD',
  CA: 'CAD',
  CH: 'CHF',
  GB: 'GBP',
  UK: 'GBP',
}

/**
 * Taux de repli à FROID — 1 EUR vaut N unités de la devise. Référence BCE du 2026-08-06.
 *
 * ⛔ Ce ne sont PAS les taux de travail : le service `Rates` rafraîchit chaque jour depuis la
 * BCE et conserve le dernier taux connu. Ces valeurs ne servent que si le dispositif n'a JAMAIS
 * réussi à joindre la BCE — un démarrage à froid pendant une panne. Elles existent pour qu'une
 * inscription ne puisse jamais échouer faute de taux, ce qui reste la règle qui prime.
 */
export const FALLBACK_RATES: Record<VoucherCurrency, number> = {
  EUR: 1,
  USD: 1.1542,
  CAD: 1.6156,
  CHF: 0.9346,
  GBP: 0.85705,
}

/**
 * ⛔ `symbol` ET NON `narrowSymbol`, et ce n'est pas un détail de goût.
 *
 * `narrowSymbol` réduit USD et CAD au même « $ » en français, allemand, espagnol et
 * néerlandais, et donne « $20 » en anglais pour un montant canadien. C'est précisément
 * l'ambiguïté que le dispositif refuse : le bon canadien vaut 20 $ CA, pas 20 $ US, et les deux
 * partagent un catalogue.
 *
 * `symbol` garde la distinction partout — « 20 $CA » en français, « CA$20 » en anglais,
 * « 20 CA$ » en allemand. Le prix à payer est de la verbosité par endroits (« 13 £GB » en
 * français, « 20 CAD » en espagnol) : c'est CLDR qui en décide, et un montant verbeux se lit,
 * là où un montant ambigu se lit faux.
 */
const CURRENCY_DISPLAY = 'symbol' as const

/** Une chaîne quelconque est-elle une devise que le dispositif sait servir ? */
export function isVoucherCurrency(value: unknown): value is VoucherCurrency {
  return (VOUCHER_CURRENCIES as readonly string[]).includes(String(value ?? '').toUpperCase())
}

/**
 * Devise du bon : `currency` d'abord, le pays en repli, l'euro en dernier recours.
 *
 * Jamais d'échec : une devise inconnue (le thème évoluera, un marché s'ouvrira) doit produire
 * un bon en euros, pas une inscription refusée.
 */
export function resolveCurrency(currency?: unknown, country?: unknown): VoucherCurrency {
  const asked = String(currency ?? '')
    .trim()
    .toUpperCase()
  if (isVoucherCurrency(asked)) return asked as VoucherCurrency

  const iso = String(country ?? '')
    .trim()
    .toUpperCase()
  if (COUNTRY_CURRENCY[iso]) return COUNTRY_CURRENCY[iso]

  return DEFAULT_CURRENCY
}

/** L'offre affichée pour une devise. */
export function offerFor(currency: VoucherCurrency): VoucherOffer {
  return VOUCHER_OFFERS[currency] ?? VOUCHER_OFFERS.EUR
}

/**
 * Montant EN EUROS à poser sur le code pour que le client voie au moins sa cible ronde.
 *
 *     montant_EUR = cible / taux × 1,02, arrondi au centime SUPÉRIEUR.
 *
 * L'arrondi au centime supérieur va dans le même sens que la marge : jamais un centime de
 * moins que promis.
 */
export function amountInEur(target: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return target
  return Math.ceil((target / rate) * (1 + FX_SAFETY_MARGIN) * 100) / 100
}

/**
 * Seuil EN EUROS à poser sur le code pour qu'un panier atteignant le seuil annoncé passe.
 *
 *     seuil_EUR = seuil_annoncé / taux × 0,98, arrondi au centime INFÉRIEUR.
 *
 * Sens inverse du montant, et pour la même raison : on préfère laisser passer un panier
 * légèrement en dessous du seuil affiché plutôt que refuser quelqu'un qui croyait l'atteindre.
 */
export function thresholdInEur(target: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return target
  return Math.floor((target / rate) * (1 - FX_SAFETY_MARGIN) * 100) / 100
}

/** Les deux montants EN EUROS effectivement posés sur le code, pour une devise et un taux. */
export function eurAmountsFor(
  currency: VoucherCurrency,
  rate: number
): { amount: number; threshold: number } {
  const offer = offerFor(currency)
  // L'euro est la devise de la boutique : aucune conversion, aucune marge, aucun taux à
  // interroger. Les valeurs affichées SONT les valeurs posées.
  if (currency === 'EUR') return { amount: offer.amount, threshold: offer.threshold }
  return {
    amount: amountInEur(offer.amount, rate),
    threshold: thresholdInEur(offer.threshold, rate),
  }
}

/**
 * LE SEUL ENDROIT OÙ UN MONTANT DEVIENT DU TEXTE — bon, seuil, seuil de bascule, prix produit.
 *
 * ⛔ AUCUNE RÈGLE DE FORMATAGE ÉCRITE À LA MAIN. La place du symbole, l'espace qui le sépare du
 * nombre, le séparateur décimal et la forme du symbole lui-même changent d'une langue à
 * l'autre : « 15 € » en français, « €15 » en anglais, « € 15 » en néerlandais. Node embarque
 * les données CLDR, qui connaissent déjà les 25 combinaisons servies ici et qui se mettent à
 * jour toutes seules. Une table maison de 25 cas serait fausse quelque part dès le premier
 * jour, et le resterait pour toujours.
 *
 * Les DÉCIMALES suivent le montant, pas une constante : les bons sont ronds par construction
 * (15 €, 20 $ CA) et s'écrivent sans centimes, alors qu'un prix d'œuvre à 62,50 € en a besoin.
 * Arrondir un prix produit à l'unité afficherait un prix que le paiement contredit.
 */
export function moneyLabel(amount: number, currency: string, locale: NewsletterLocale): string {
  if (!Number.isFinite(amount) || !currency) return ''
  try {
    return new Intl.NumberFormat(intlTag(locale), {
      style: 'currency',
      currency,
      currencyDisplay: CURRENCY_DISPLAY,
      // Les deux bornes ensemble, et à la même valeur. Avec un minimum à 0, 62,50 € s'écrivait
      // « 62,5 € » — une forme qu'aucune boutique n'affiche, et qui fait douter du prix.
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount)
  } catch {
    // Devise inconnue d'ICU, ou données de locale absentes : on n'échoue pas un e-mail pour
    // une mise en forme. La forme de repli reste lisible et non ambiguë.
    return `${amount} ${currency}`
  }
}
