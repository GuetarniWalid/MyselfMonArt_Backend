import type { LanguageCode } from 'Types/Translation'

/**
 * Canonical de/es/nl translations for the FORMAT (orientation) filter VALUES.
 *
 * Storefront faceted filters render the `format` metaobject `etiquette` field
 * (filter.p.m.painting.layout → single metaobject_reference of type "format"). The three
 * orientation labels are a closed, well-known set, so pin them here for a deterministic,
 * byte-stable translation instead of relying on ChatGPT (which left them partly French on
 * es/nl/de). Mirrors colorPatternDictionary / OPTION_VALUE_DICTIONARY.
 *
 * Only the `etiquette` field is translated; the sibling `format` field is the lowercase URL
 * slug (carré/paysage/portrait) and must stay as-is. en is handled by English.ts.
 */
export const FORMAT_DICTIONARY: Record<string, Partial<Record<LanguageCode, string>>> = {
  Carré: { de: 'Quadratisch', es: 'Cuadrado', nl: 'Vierkant' },
  Paysage: { de: 'Querformat', es: 'Paisaje', nl: 'Liggend' },
  Portrait: { de: 'Hochformat', es: 'Retrato', nl: 'Staand' },
}

/**
 * Returns the canonical translation for a format `etiquette` value in the given locale, or
 * undefined when the value isn't a dictionary-managed orientation (caller falls back to its
 * normal path).
 */
export function lookupFormat(etiquette: string, locale: LanguageCode): string | undefined {
  if (typeof etiquette !== 'string') return undefined
  return FORMAT_DICTIONARY[etiquette.trim()]?.[locale]
}
