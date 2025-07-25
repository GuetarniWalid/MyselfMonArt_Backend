import type { ProductToTranslate } from './Product'

export type LanguageCode = 'en' | 'es' | 'de' | 'fr'
export type RegionCode = 'UK' | 'US'

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
