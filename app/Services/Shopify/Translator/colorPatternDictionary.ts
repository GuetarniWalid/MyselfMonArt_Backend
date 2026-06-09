import type { LanguageCode } from 'Types/Translation'

/**
 * Canonical de/es/nl translations for COMPOUND color-pattern filter VALUES.
 *
 * Storefront faceted filters render the `shopify--color-pattern` metaobject `label`
 * (filter.v.t.shopify.color-pattern). Simple color names ("Noir", "Bleu", …) translate
 * fine through ChatGPT, but the COMPOUND values that carry a "/" or "&" separator
 * ("Doré / Or", "Noir & Blanc") were echoed back unchanged by the model and registered
 * as French "translations" — so they stay French on es/nl/de and the cron never retries
 * them (Shopify reports them as not-outdated). Pinning them here makes the metaobject
 * translator resolve a deterministic value instead of echoing, exactly like the
 * border/frame OPTION_VALUE_DICTIONARY does for swatches.
 *
 * en is intentionally absent: English values are handled by the English.ts dictionary.
 * Only list values that ChatGPT cannot translate reliably (compound / brand-like). Add
 * new compound color finishes here.
 */
export const COLOR_PATTERN_DICTIONARY: Record<string, Partial<Record<LanguageCode, string>>> = {
  'Noir & Blanc': { de: 'Schwarz-Weiß', es: 'Blanco y negro', nl: 'Zwart-wit' },
  'Beige / Crème': { de: 'Beige / Creme', es: 'Beige / Crema', nl: 'Beige / Crème' },
  'Jaune / Ocre': { de: 'Gelb / Ocker', es: 'Amarillo / Ocre', nl: 'Geel / Oker' },
  'Doré / Or': { de: 'Gold', es: 'Dorado / Oro', nl: 'Goud' },
  'Marron / Terre': { de: 'Braun / Erdtöne', es: 'Marrón / Tierra', nl: 'Bruin / Aarde' },
  Multicolore: { de: 'Mehrfarbig', es: 'Multicolor', nl: 'Veelkleurig' },
}

/**
 * Returns the canonical translation for a color-pattern label in the given locale, or
 * undefined when the value isn't a dictionary-managed compound color (caller should fall
 * back to its normal path — ChatGPT for simple colors).
 */
export function lookupColorPattern(label: string, locale: LanguageCode): string | undefined {
  if (typeof label !== 'string') return undefined
  return COLOR_PATTERN_DICTIONARY[label.trim()]?.[locale]
}
