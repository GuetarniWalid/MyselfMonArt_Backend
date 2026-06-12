import Logger from '@ioc:Adonis/Core/Logger'
import Variant from 'App/Services/Shopify/Variant'
import type { CustomArtFormat } from 'App/Models/CustomArtJob'

/**
 * Table de correspondance variante Shopify -> { format, frame } du studio CustomArt.
 *
 * Contrat front (revue J1) : le POST /jobs envoie `variantId` comme SOURCE DE VÉRITÉ
 * (la variante choisie sur la fiche produit porte déjà format + finition) ; les champs
 * explicites format/frame restent acceptés en secours si la résolution échoue.
 *
 * Dérivation depuis les options de la variante (produit M8 : 2 formats x 6 finitions) :
 * - format : option dont la valeur contient 30x40 / 60x80 (tolérant : espaces, ×, cm) ;
 * - frame  : valeur de l'autre option (finition), slugifiée — « Sans cadre » -> 'none'.
 *
 * Cache mémoire 10 min : le mapping d'une variante est stable, inutile d'interroger
 * Shopify à chaque création de job.
 */

export interface VariantMappingResult {
  format: CustomArtFormat
  frame: string
}

const CACHE_TTL_MS = 10 * 60 * 1000
const cache = new Map<string, { value: VariantMappingResult | null; at: number }>()

const FORMAT_PATTERNS: Array<{ re: RegExp; format: CustomArtFormat }> = [
  { re: /30\s*[x×*]\s*40/i, format: '30x40' },
  { re: /60\s*[x×*]\s*80/i, format: '60x80' },
]

/** Slug d'une valeur d'option de finition : minuscules, sans accents, tirets. */
function slugifyFrame(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function detectFormat(value: string): CustomArtFormat | null {
  for (const { re, format } of FORMAT_PATTERNS) {
    if (re.test(value)) return format
  }
  return null
}

export default class CustomArtVariantMapping {
  /**
   * Résout une variante en { format, frame }. Retourne null si la variante est
   * introuvable ou si ses options ne permettent pas de dériver le format (l'appelant
   * retombe alors sur les champs explicites du POST).
   */
  public static async resolve(variantId: string): Promise<VariantMappingResult | null> {
    const id = CustomArtVariantMapping.numericId(variantId)
    if (!id) return null

    const cached = cache.get(id)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value

    let value: VariantMappingResult | null = null
    try {
      const variant = await new Variant().getVariantWithOptions(id)
      value = CustomArtVariantMapping.fromOptions(variant)
      if (!value) {
        Logger.warn(
          'custom-art variant-mapping: options non résolues pour variantId=%s (titre="%s")',
          id,
          variant?.title || 'introuvable'
        )
      }
    } catch (error) {
      // Shopify indisponible : on n'écrit PAS le cache (nouvel essai au prochain job),
      // l'appelant retombe sur les champs explicites.
      Logger.warn(
        'custom-art variant-mapping: échec Shopify variantId=%s: %s',
        id,
        (error as any)?.message || error
      )
      return null
    }

    cache.set(id, { value, at: Date.now() })
    return value
  }

  /** Accepte un id numérique ou un gid Shopify complet ; retourne l'id numérique. */
  private static numericId(variantId: string): string | null {
    const raw = String(variantId || '').trim()
    const match = raw.match(/^(?:gid:\/\/shopify\/ProductVariant\/)?(\d{1,20})$/)
    return match ? match[1] : null
  }

  /** Dérive { format, frame } des selectedOptions (et du titre en dernier recours). */
  private static fromOptions(variant: any): VariantMappingResult | null {
    if (!variant) return null
    const options: Array<{ name: string; value: string }> = variant.selectedOptions || []

    let format: CustomArtFormat | null = null
    let frame: string | null = null

    for (const option of options) {
      const value = String(option.value || '')
      const detected = detectFormat(value)
      if (detected && !format) {
        format = detected
        continue
      }
      // L'option qui ne porte pas le format = la finition cadre
      if (frame === null && value.trim()) {
        frame = /sans\s*cadre/i.test(value) ? 'none' : slugifyFrame(value)
      }
    }

    // Dernier recours : certains produits portent tout dans le titre « 30x40 / Chêne »
    if (!format && variant.title) {
      format = detectFormat(String(variant.title))
    }

    if (!format) return null
    return { format, frame: frame || 'none' }
  }
}
