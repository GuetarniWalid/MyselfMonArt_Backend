import { ProductToTranslate } from './Product'

export type LanguageCode = 'es' | 'en' | 'de'

export interface Translatable {}

export type TranslatableContent = ProductToTranslate

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
