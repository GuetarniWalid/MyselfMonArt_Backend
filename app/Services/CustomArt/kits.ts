/**
 * Helpers vues des références maillot — port TS de scripts/bench/lib/kits.mjs.
 * Convention de nommage des fichiers/URLs de réfs : suffixe -front = vue de FACE
 * (blason, sponsor), -back = vue de DOS (placement nom/numéro). Les fichiers sans
 * suffixe (uploads admin libres) sont annoncés comme « vue non précisée ».
 */

export type KitView = 'front' | 'back' | null

/** Vue d'une réf maillot déduite du suffixe du fichier (URL ou chemin). */
export function kitView(file: string): KitView {
  const base = String(file).toLowerCase().split('?')[0]
  if (/-back\.[a-z0-9]+$/.test(base)) return 'back'
  if (/-front\.[a-z0-9]+$/.test(base)) return 'front'
  return null
}

/** Libellé FR de la vue pour les prompts du juge. */
export function kitViewLabelFr(file: string): string {
  const view = kitView(file)
  if (view === 'back') return 'vue de DOS (référence du placement nom/numéro)'
  if (view === 'front') return 'vue de FACE (référence du blason et du sponsor)'
  return 'vue non précisée'
}
