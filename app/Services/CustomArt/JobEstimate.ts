import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'

/**
 * Estimation GLOBALE (tous utilisateurs, jamais par-navigateur) de la durée d'une
 * génération CustomArt, pour caler la barre de progression du studio (`estimatedMs`).
 *
 * Principe : on mesure la durée réelle création -> ready de chaque job passé ready
 * AUTOMATIQUEMENT (le worker écrit `ready_duration_ms`), puis on calcule une médiane
 * glissante par `productType` sur les WINDOW derniers jobs ready. On prend un percentile
 * (p75, pas la moyenne brute — robuste aux outliers) et on borne le tout à [MIN, MAX].
 *
 * Sont EXCLUS de fait : échecs, manual_review et résultats attachés à la main par
 * l'artiste — ces jobs n'ont jamais de `ready_duration_ms` (seul le passage ready
 * automatique du worker le pose). Avant d'avoir assez d'échantillons (cold start /
 * nouveau productType) on renvoie DEFAULT_MS.
 *
 * Cache mémoire (CACHE_TTL_MS) par productType : GET /jobs/:uuid est pollé toutes les 2 s,
 * inutile de ré-agréger à chaque appel. L'estimation ne doit JAMAIS faire échouer une
 * création de job : toute erreur DB retombe silencieusement sur DEFAULT_MS.
 */

// Fenêtre glissante : les N derniers jobs ready d'un productType (cible 50–100).
const WINDOW = 75
// Percentile retenu : p75 (médiane conservatrice) — la barre n'atteint 100 % qu'en fin
// réelle pour ~3 jobs sur 4, ce qui évite le « coincé à 99 % » d'une estimation trop basse.
const PERCENTILE = 75
// Borne de bon sens (demande produit) : on ne renvoie jamais hors de [8 s, 120 s].
const MIN_MS = 8_000
const MAX_MS = 120_000
// Estimation par défaut tant qu'on n'a pas MIN_SAMPLES durées réelles (cold start).
const DEFAULT_MS = 45_000
// En deçà de ce nombre d'échantillons, la stat n'est pas fiable -> DEFAULT_MS.
const MIN_SAMPLES = 5
// TTL du cache mémoire par productType.
const CACHE_TTL_MS = 60_000

/** Bucket par défaut quand le studio n'envoie pas de productType. */
export const DEFAULT_PRODUCT_TYPE = 'default'

const cache = new Map<string, { ms: number; at: number }>()

/** Normalise le productType reçu du front vers une clé de bucket stable (jamais vide). */
export function normalizeProductType(raw?: string | null): string {
  const v = (raw || '').trim().toLowerCase()
  return v ? v.slice(0, 40) : DEFAULT_PRODUCT_TYPE
}

/** Borne + arrondit une durée (ms) dans [MIN_MS, MAX_MS] -> entier renvoyé au front. */
export function clampEstimate(ms: number): number {
  return Math.round(Math.min(MAX_MS, Math.max(MIN_MS, ms)))
}

/** Percentile (nearest-rank) d'un tableau trié croissant. */
function percentile(sortedAsc: number[], p: number): number {
  const rank = Math.ceil((p / 100) * sortedAsc.length)
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, rank - 1))
  return sortedAsc[idx]
}

export default class JobEstimate {
  /**
   * `estimatedMs` (entier, borné) pour un productType : p75 glissant des durées réelles
   * création -> ready, ou DEFAULT_MS si l'échantillon est insuffisant / en cas d'erreur.
   */
  public static async forProductType(productType?: string | null): Promise<number> {
    const key = normalizeProductType(productType)

    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.ms

    let ms = DEFAULT_MS
    try {
      const rows = await Database.from('custom_art_jobs')
        .where('product_type', key)
        .where('status', 'ready')
        .whereNotNull('ready_duration_ms')
        .orderBy('id', 'desc')
        .limit(WINDOW)
        .select('ready_duration_ms')

      const durations = rows
        .map((r) => Number(r.ready_duration_ms))
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b)

      if (durations.length >= MIN_SAMPLES) {
        ms = percentile(durations, PERCENTILE)
      }
    } catch (error) {
      // Best-effort : une estimation indisponible ne doit jamais bloquer la création/le
      // polling d'un job. On retombe sur le défaut (déjà dans `ms`).
      Logger.warn('custom-art estimate %s: %s', key, (error as any)?.message || error)
    }

    const estimate = clampEstimate(ms)
    cache.set(key, { ms: estimate, at: Date.now() })
    return estimate
  }
}
