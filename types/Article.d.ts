export interface ArticleWithOutdatedTranslations {
  id: string
  body: string
  handle: string
  summary: string
  title: string
  altTextsMetaObject: {
    reference?: {
      id: string
      field: {
        jsonValue: string[]
      }
    }
  }
  translations: {
    key: string
    locale: string
    value: string
    outdated: boolean
    updatedAt: string
  }[]
}

export interface ArticleToTranslate extends Translatable {
  id: string
  body: string
  handle: string
  summary: string
  title: string
  image: {
    id: string
    altText: string
  }
}

export interface ArticleToTranslateFormatted {
  body: string
  handle: string
  imageAltText: string
  summary: string
  title: string
}

export interface Article {
  id: string
  body: string
  handle: string
  summary: string
  title: string
  image: {
    id: string
    altText: string | null
  }
  metafields: {
    edges: {
      node: {
        namespace: string
        key: string
        reference?: {
          id?: string
          title?: string
          field?: {
            key: string
            jsonValue: string[]
          }
        }
      }
    }[]
  }
}
