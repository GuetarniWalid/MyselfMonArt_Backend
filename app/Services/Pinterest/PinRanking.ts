import type { PinterestPinMetricValues } from 'Types/Pinterest'

/** Le minimum nécessaire pour départager deux pins concurrents. */
export interface RankablePin {
  id: string
  metrics: PinterestPinMetricValues
  createdAt: number
}

/**
 * Critères de conservation, dans l'ordre. Les vues d'abord, puis l'engagement :
 * c'est la règle demandée — on supprime le pin le moins vu et le moins aimé.
 */
const CRITERIA: Array<keyof PinterestPinMetricValues> = [
  'impression',
  'reaction',
  'save',
  'pin_click',
]

/**
 * Le plus performant d'abord. À égalité parfaite sur tous les critères, le pin
 * le PLUS ANCIEN l'emporte : il est mieux établi et mieux indexé qu'un doublon
 * publié après lui.
 *
 * Une métrique absente vaut zéro — un pin dont Pinterest ne renvoie aucune
 * statistique ne doit jamais gagner face à un pin qui en a.
 */
export function byPerformanceDesc(a: RankablePin, b: RankablePin): number {
  for (const key of CRITERIA) {
    const diff = (b.metrics[key] ?? 0) - (a.metrics[key] ?? 0)
    if (diff !== 0) return diff
  }
  return a.createdAt - b.createdAt
}

/** Trie une copie : le pin à conserver en tête, les perdants ensuite. */
export function rankByPerformance<T extends RankablePin>(entries: T[]): T[] {
  return [...entries].sort(byPerformanceDesc)
}

/** Résumé lisible des chiffres qui ont décidé de la suppression. */
export function describeMetrics(metrics: PinterestPinMetricValues): string {
  return [
    `${metrics.impression ?? 0} vues`,
    `${metrics.reaction ?? 0} j'aime`,
    `${metrics.save ?? 0} enreg.`,
    `${metrics.pin_click ?? 0} clics`,
  ].join(', ')
}
