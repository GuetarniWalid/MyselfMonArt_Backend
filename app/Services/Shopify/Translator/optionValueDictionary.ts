import type { LanguageCode } from 'Types/Translation'

/**
 * Canonical de/es/nl translations for the BORDER & FRAME product option VALUES.
 *
 * These exact strings appear in TWO independent places that the storefront theme then
 * compares to render the variant swatch image
 * (snippets/painting-variant-picker.liquid → `{% if border.name == value %}`):
 *   1. the product's option value  (translated by ProductTranslator)
 *   2. the `painting_option` swatch metaobject `name`  (translated by TranslateMetaobjects)
 *
 * If those two were translated independently via ChatGPT they would drift (e.g. one
 * "Weißer Rand", the other "Weiße Umrandung") and the swatch would silently disappear,
 * making borders/frames unselectable on every non-French locale. Both translators MUST
 * resolve these values through this single map so the two sides stay byte-identical.
 *
 * en is intentionally absent: English option values are handled by the English.ts dictionary.
 * Size values are language-neutral and need no entry. Add new border/frame finishes here.
 */
export const OPTION_VALUE_DICTIONARY: Record<string, Partial<Record<LanguageCode, string>>> = {
  'Bordure blanche': { de: 'Weißer Rand', es: 'Borde blanco', nl: 'Witte rand' },
  'Bordure noire': { de: 'Schwarzer Rand', es: 'Borde negro', nl: 'Zwarte rand' },
  'Bordure étirée': { de: 'Gedehnter Rand', es: 'Borde estirado', nl: 'Uitgerekte rand' },
  'Bordure miroir': { de: 'Spiegelrand', es: 'Borde espejo', nl: 'Spiegelrand' },
  'Bordure pliée': { de: 'Gefalteter Rand', es: 'Borde plegado', nl: 'Gevouwen rand' },
  'Sans cadre': { de: 'Ohne Rahmen', es: 'Sin marco', nl: 'Zonder lijst' },
  'Avec cadre': { de: 'Mit Rahmen', es: 'Con marco', nl: 'Met lijst' },
  'Cadre blanc': { de: 'Weißer Rahmen', es: 'Marco blanco', nl: 'Witte lijst' },
  'Cadre noir Mat': { de: 'Mattschwarzer Rahmen', es: 'Marco negro mate', nl: 'Matzwarte lijst' },
  'Cadre argent ancien': {
    de: 'Antiksilberner Rahmen',
    es: 'Marco plata envejecida',
    nl: 'Antiek zilveren lijst',
  },
  'Cadre chêne clair': {
    de: 'Rahmen aus heller Eiche',
    es: 'Marco roble claro',
    nl: 'Lichte eikenhouten lijst',
  },
  'Cadre noyer': { de: 'Nussbaumrahmen', es: 'Marco nogal', nl: 'Notenhouten lijst' },
}

/**
 * Returns the canonical translation for an option value in the given locale, or undefined
 * when the value isn't a dictionary-managed border/frame (caller should fall back to its
 * normal path — English.ts dictionary or ChatGPT).
 */
export function lookupOptionValue(name: string, locale: LanguageCode): string | undefined {
  if (typeof name !== 'string') return undefined
  return OPTION_VALUE_DICTIONARY[name.trim()]?.[locale]
}
