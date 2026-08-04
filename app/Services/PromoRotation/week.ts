import { DateTime } from 'luxon'

/**
 * Le rythme de la rotation (§4 du brief) — la décision la plus importante du dispositif.
 *
 *   Rotation (fenêtre d'AFFICHAGE) ....... 7 jours
 *   Validité du code (endsAt Shopify) .... 14 jours
 *   Recouvrement ......................... 7 jours
 *
 * La validité DOIT dépasser la fenêtre d'affichage. Les pages boutique sont mises en cache
 * et Shopify ne documente ni TTL ni API de purge : un visiteur peut recevoir une page en
 * cache portant le code de la semaine précédente. Avec 7 jours de recouvrement, ce code
 * fonctionne encore au checkout. Le pire cas devient « code un peu ancien mais valide »
 * au lieu de « code refusé » — c'est-à-dire une vente perdue.
 *
 * Corollaire : on ne désactive JAMAIS le code de la semaine précédente en publiant le
 * nouveau. Il expire tout seul (cf. le ménage à J+30 dans PromoRotation/index.ts).
 */
export const VALIDITY_DAYS = 14

/** Fuseau de repli si Shopify ne répond pas — la boutique est française. */
export const FALLBACK_TIMEZONE = 'Europe/Paris'

export interface PromoWindow {
  /** Semaine ISO, ex. "2026-W32". */
  isoWeek: string
  /** Lundi 00:00:00, heure boutique. */
  startsAt: DateTime
  /** Dimanche J+13 à 23:59:59, heure boutique (DST géré par Luxon). */
  endsAt: DateTime
}

/**
 * Semaine ISO courante, calculée à l'heure de la BOUTIQUE (et non celle du serveur) :
 * c'est elle qui décide du basculement, un lundi à minuit heure de Paris.
 */
export function currentIsoWeek(timezone: string, now: DateTime = DateTime.now()): string {
  const local = now.setZone(timezone)
  return formatIsoWeek(local.weekYear, local.weekNumber)
}

export function formatIsoWeek(weekYear: number, weekNumber: number): string {
  return `${weekYear}-W${String(weekNumber).padStart(2, '0')}`
}

/**
 * Fenêtre de validité d'une semaine ISO donnée. Purement déterministe : la même semaine
 * produit toujours exactement les mêmes bornes, ce qui rend le payload de création
 * rejouable à l'identique.
 *
 * `startsAt` est le lundi de la semaine, même si le cron démarre en milieu de semaine :
 * une remise dont la date de début est passée est simplement active tout de suite.
 *
 * Sur l'heure d'été : `startsAt`/`endsAt` sont des INSTANTS ABSOLUS. Envoyer 23:59:59Z
 * pour une boutique parisienne ferait expirer la remise une à deux heures trop tard, et
 * l'écart change deux fois par an. On travaille donc en heure locale de la boutique et on
 * laisse Luxon (déjà utilisé partout dans le projet, et adossé à la base IANA) résoudre le
 * décalage réel du jour concerné — pas d'arithmétique de fuseau à la main, pas de
 * `Temporal` (absent avant Node 26), pas de dépendance supplémentaire.
 */
export function windowForWeek(isoWeek: string, timezone: string): PromoWindow {
  const match = /^(\d{4})-W(\d{2})$/.exec(isoWeek)
  if (!match) throw new Error(`Semaine ISO invalide : ${isoWeek}`)

  const startsAt = DateTime.fromObject(
    { weekYear: Number(match[1]), weekNumber: Number(match[2]), weekday: 1 },
    { zone: timezone }
  ).startOf('day')

  if (!startsAt.isValid) throw new Error(`Semaine ISO invalide : ${isoWeek}`)

  const endsAt = startsAt
    .plus({ days: VALIDITY_DAYS - 1 })
    .set({ hour: 23, minute: 59, second: 59, millisecond: 0 })

  return { isoWeek, startsAt, endsAt }
}

/**
 * Les deux valeurs publiées (`promo.ends_at` pour l'AFFICHAGE, `promo.ends_ts` pour la
 * COMPARAISON) dérivent d'un instant UNIQUE, donc décrivent le même moment à la seconde.
 * C'est tout l'intérêt d'avoir deux métachamps : une date nue est interprétée à minuit UTC
 * par Liquid, ce qui décalait l'extinction selon l'heure d'été.
 */
export function renderEnds(instant: DateTime, timezone: string) {
  const local = instant.setZone(timezone)
  return {
    // ISO 8601 avec décalage, ex. "2026-08-16T23:59:59+02:00"
    endsAt: local.toISO({ suppressMilliseconds: true })!,
    endsTs: Math.floor(local.toSeconds()),
  }
}
