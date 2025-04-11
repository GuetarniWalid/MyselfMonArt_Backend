import type { TranslatableContent, Translation } from './Theme'

export interface StaticSectionToTranslate {
  id: string
  key: string
  value: string
}

export interface StaticSectionResponse {
  translatableResourcesByIds: {
    edges: {
      node: {
        resourceId: string
        translatableContent: TranslatableContent[]
        translations: Translation[]
      }
    }[]
  }
}
