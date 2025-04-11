export interface TranslatableContent {
  key: string
  value: string
  locale: string
}

export interface Translation {
  key: string
  locale: string
  value: string
  outdated: boolean
}

export interface FileDataQueryResponse {
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

export interface ThemeWithOutdatedTranslation {
  key: string
  value: string
}
export type ThemeWithOutdatedTranslations = ThemeWithOutdatedTranslation[]

export interface ThemeWithFiles {
  id: string
  name: string
  files: {
    pageInfo: {
      hasNextPage: boolean
      endCursor: string
    }
    edges: {
      cursor: string
      node: {
        filename: string
      }
    }[]
  }
}

export interface Theme {
  id: string
}

export interface ThemeToTranslate {
  id: string
  key: string
  value: string
}
