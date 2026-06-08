import type { LanguageCode, RegionCode } from 'Types/Translation'

/**
 * SINGLE SOURCE OF TRUTH for the storefront's i18n target matrix.
 *
 * Before this module, every Translate* task hardcoded its own list of `translateTo(...)`
 * calls. That drifted: TranslateStaticSection only pushed 'en', `nl` was commented out in
 * ~8 separate files, and the UK market pass existed only for some resources. Adding or
 * removing a language meant editing N files and silently created coverage holes
 * (the 2026-06-08 i18n audit). Tasks now derive their passes from here instead.
 */

export type LocalePass = { locale: LanguageCode; region?: RegionCode }

/** French is the source language of the store — never a translation target. */
export const SOURCE_LOCALE: LanguageCode = 'fr'

/**
 * The published target languages. Add/remove one here and every Translate* task picks it
 * up on its next run. NL re-enabled 2026-06-08 (was backfill-only via translate:manual).
 *
 * NB: a locale must also be enabled in Shopify Admin > Settings > Languages. If it isn't,
 * the tasks bail gracefully on the "locale is not a valid locale for the shop" error
 * (without poisoning the skip cache) and resume automatically once it's enabled.
 */
export const ACTIVE_LOCALES: readonly LanguageCode[] = ['en', 'es', 'de', 'nl']

/**
 * Market regions that need a distinct, market-scoped translation pass, keyed by base
 * locale. Today only the UK market (English) can differ from base English. Keep the gid
 * in sync with Utils.marketMap.
 */
export const MARKET_REGION_BY_LOCALE: Partial<Record<LanguageCode, RegionCode>> = {
  en: 'UK',
}

/**
 * Resources whose translations genuinely differ per market, so they get the extra
 * market-scoped pass (e.g. `en-UK`). For every other resource a market override would be
 * byte-identical to the base language and is already served by Shopify's locale fallback —
 * paying for a market pass there just duplicates entries. Today only product option values
 * and metaobject swatches vary by market.
 */
const MARKET_SCOPED_RESOURCES: ReadonlySet<string> = new Set(['product', 'metaobject'])

/**
 * The ordered locale passes a given resource type must be translated to. This is THE place
 * that decides "which languages get translated" — tasks must not hardcode their own lists.
 *
 * @param resource logical resource key, e.g. 'product', 'collection', 'theme_locale', 'link'
 */
export function localePassesFor(resource: string): LocalePass[] {
  const passes: LocalePass[] = []
  for (const locale of ACTIVE_LOCALES) {
    passes.push({ locale })
    const region = MARKET_REGION_BY_LOCALE[locale]
    if (region && MARKET_SCOPED_RESOURCES.has(resource)) {
      passes.push({ locale, region })
    }
  }
  return passes
}

/** Whether a string is one of the configured, active target languages. */
export function isActiveLocale(locale: string): locale is LanguageCode {
  return (ACTIVE_LOCALES as readonly string[]).includes(locale)
}
