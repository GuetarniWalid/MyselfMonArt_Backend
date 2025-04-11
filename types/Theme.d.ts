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
