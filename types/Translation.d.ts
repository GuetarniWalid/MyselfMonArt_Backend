import type { ProductToTranslate } from './Product'

export type LanguageCode = 'es' | 'en' | 'de'

export interface Translatable {}

export type TranslatableContent = Partial<ProductToTranslate>

export interface TranslationsRegister {
  resourceId: string
  translations: TranslationInput[]
}

export interface TranslationInput {
  key: string
  locale: LanguageCode
  translatableContentDigest: string
  value: string
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
