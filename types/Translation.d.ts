import type { ProductToTranslate } from './Product'

export type LanguageCode = 'en' | 'es' | 'de' | 'fr' | 'nl'
/**
 * Shopify Market regions that get a distinct, market-scoped translation pass.
 * Single-member today: only the UK market (English) differs from base English.
 * To add a region (e.g. 'US'): add its Market gid to Utils.marketMap AND wire it into
 * config/i18n MARKET_REGION_BY_LOCALE — keep all three in sync. getMarketId() throws on
 * any region missing from marketMap, so a half-wired region fails loud rather than emitting
 * 'gid://shopify/Market/undefined'.
 */
export type RegionCode = 'UK'

export type TranslatableContent = Partial<ProductToTranslate>

export interface TranslationsRegister {
  resourceId: string
  translations: TranslationInput[]
}

export interface TranslationInput {
  key: string
  locale: LanguageCode | `${LanguageCode}-${RegionCode}`
  translatableContentDigest: string
  value: string
  marketId?: string
}

export interface MetaobjectTranslation {
  translatableResource: {
    translations: {
      key: string
      locale: LanguageCode
      value: string
      outdated: boolean
      updatedAt: string
    }[]
  }
}
