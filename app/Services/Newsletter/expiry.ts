import { DateTime } from 'luxon'
import {
  VOUCHER_END_HOUR_UTC,
  VOUCHER_END_MINUTE_UTC,
  VOUCHER_END_SECOND_UTC,
  VOUCHER_TIMEZONE,
  VOUCHER_VALIDITY_DAYS,
} from './config'
import type { NewsletterLocale } from './config'

/**
 * LA FENÊTRE DE VALIDITÉ DU BON — module PUR (luxon seul), pour que les tests dorés puissent
 * le charger sans monter l'application.
 *
 * Deux instants distincts vivent ici, et les confondre est le bug que ce fichier existe pour
 * empêcher :
 *
 *   • LA DATE ANNONCÉE — une DATE, sans heure, calculée en Europe/Paris. C'est la seule chose
 *     que le client lit : « valable jusqu'au 13 août ». Inscription le 6 août → 13 août.
 *   • L'INSTANT DE FIN (`endsAt`) posé chez Shopify — 11:59:59 UTC le LENDEMAIN de la date
 *     annoncée. Un jour de plus, volontairement.
 *
 * ⛔ POURQUOI CE DÉCALAGE D'UN JOUR, ET POURQUOI IL NE FAUT PAS LE SUPPRIMER.
 *
 * Le bon est ouvert aux États-Unis, au Canada, à la Suisse et au Royaume-Uni. Une expiration
 * calée sur 23 h 59 heure de Paris tuerait le code à 14 h 59 l'après-midi pour un client de Los
 * Angeles, alors que le message lui annonce « jusqu'au 13 août inclus ». 11:59:59 UTC, c'est la
 * fin de la journée annoncée dans le dernier fuseau habité de la planète (UTC−12) : la promesse
 * devient vraie de Honolulu à Helsinki. En Europe le bon vit quelques heures de plus que
 * strictement annoncé — une sur-promesse inoffensive, jamais l'inverse.
 *
 * ⚠️ Et la date annoncée se calcule en Europe/Paris, JAMAIS en « UTC+2 » figé : la France
 * repasse à UTC+1 fin octobre. Un décalage codé en dur ferait dériver la date annoncée d'un
 * jour tout l'hiver, sur les inscriptions du soir. `plus({ days })` sur un instant zoné est
 * calendaire : luxon fait ce travail correctement, à condition qu'on lui donne le fuseau.
 */

export interface VoucherWindow {
  /** Date ANNONCÉE au client, `YYYY-MM-DD` en Europe/Paris. La seule qu'il lira. */
  announcedDate: string
  /** Instant de fin posé chez Shopify, en ISO 8601 UTC. */
  endsAtIso: string
  /** Le même, en secondes epoch — c'est lui qui décide (gardes d'avant-envoi, ré-inscription). */
  endsTs: number
}

/**
 * Calcule la fenêtre à partir de l'instant d'inscription.
 *
 * `validityDays` n'est ouvert que pour les tests : en production, c'est
 * `VOUCHER_VALIDITY_DAYS`, et il est LIÉ au calendrier de la séquence (cf. `config.ts`).
 */
export function voucherWindow(
  signupAt: DateTime,
  validityDays: number = VOUCHER_VALIDITY_DAYS
): VoucherWindow {
  const announced = signupAt.setZone(VOUCHER_TIMEZONE).plus({ days: validityDays })
  const announcedDate = announced.toFormat('yyyy-MM-dd')

  const endsAt = DateTime.fromObject(
    { year: announced.year, month: announced.month, day: announced.day },
    { zone: 'utc' }
  )
    .plus({ days: 1 })
    .set({
      hour: VOUCHER_END_HOUR_UTC,
      minute: VOUCHER_END_MINUTE_UTC,
      second: VOUCHER_END_SECOND_UTC,
      millisecond: 0,
    })

  return {
    announcedDate,
    endsAtIso: endsAt.toISO({ suppressMilliseconds: true })!,
    endsTs: Math.floor(endsAt.toSeconds()),
  }
}

/**
 * Chemin inverse — retrouve la date annoncée à partir de l'instant de fin.
 *
 * Sert aux lignes créées AVANT cette correction (bon de 14 jours, fin à l'heure de création) :
 * elles n'ont pas de date annoncée stockée, et il ne faut ni les recalculer à faux ni afficher
 * une date vide dans un e-mail déjà programmé.
 */
export function announcedDateFromEnd(endsTs: number): string {
  return DateTime.fromSeconds(endsTs, { zone: 'utc' })
    .minus({ days: 1 })
    .setZone(VOUCHER_TIMEZONE)
    .toFormat('yyyy-MM-dd')
}

/** Étiquette BCP 47 pour la mise en forme des dates et des nombres. */
export function intlTag(locale: NewsletterLocale): string {
  return { fr: 'fr-FR', en: 'en-GB', de: 'de-DE', es: 'es-ES', nl: 'nl-NL' }[locale] ?? 'fr-FR'
}

/**
 * Met en forme la date annoncée dans la langue du destinataire : « 13 août 2026 »,
 * « 13. August 2026 ».
 *
 * ⛔ JAMAIS D'HEURE. « 23 h 59 » ne serait vrai qu'à Paris, et le bon est ouvert à cinq
 * fuseaux. Une date nue est la seule promesse tenable partout.
 *
 * La date est ancrée à MIDI UTC avant d'être formatée, et formatée EN UTC : `2026-08-13`
 * interprété à minuit puis rendu dans un fuseau négatif afficherait le 12 août. Midi met deux
 * fuseaux horaires complets de marge de chaque côté, et le rendu en UTC ferme la question.
 */
export function formatAnnouncedDate(announcedDate: string, locale: NewsletterLocale): string {
  const at = Date.parse(`${announcedDate}T12:00:00Z`)
  if (!Number.isFinite(at)) return announcedDate
  try {
    return new Intl.DateTimeFormat(intlTag(locale), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(at))
  } catch {
    return announcedDate
  }
}

/**
 * Date annoncée rendue en ISO 8601 pour la RÉPONSE HTTP à l'encart (`expires_at`).
 *
 * Fin de la journée annoncée en Europe/Paris. Ce n'est pas l'instant de fin réel du bon (qui
 * court plus longtemps, cf. l'en-tête) : c'est la date annoncée, encodée de la façon la plus
 * robuste pour un thème qui la relira avec `new Date(...)`. À 23:59:59+02:00, tous les marchés
 * de la boutique — de UTC−8 (Los Angeles) à UTC+2 — affichent bien la date annoncée. Un instant
 * pris en début de journée, lui, reculerait d'un jour dès le premier fuseau négatif.
 */
export function announcedIso(announcedDate: string): string {
  const end = DateTime.fromISO(`${announcedDate}T23:59:59`, { zone: VOUCHER_TIMEZONE })
  return end.isValid ? end.toISO({ suppressMilliseconds: true })! : announcedDate
}
