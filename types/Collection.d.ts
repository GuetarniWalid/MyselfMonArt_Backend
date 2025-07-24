export interface CollectionWithOutdatedTranslations {
  id: string
  title: string
  descriptionHtml: string
  handle: string
  altTextsMetaObject: {
    reference?: {
      id: string
      field: {
        jsonValue: string[]
      }
    }
  }
  seo: {
    title: string
    description: string
  }
  translations: {
    key: string
    locale: string
    value: string
    outdated: boolean
    updatedAt: string
  }[]
}

export interface CollectionToTranslate {
  id: string
  title: string
  descriptionHtml: string
  handle: string
  seo: {
    title: string
    description: string
  }
  image: {
    id: string
    altText: string
  }
}

export interface CollectionToTranslateFormatted {
  title: string
  descriptionHtml: string
  handle: string
  metaTitle: string
  metaDescription: string
  imageAltText: string
}

export interface Collection {
  id: string
  title: string
  description: string
  handle: string
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
  translations: {
    key: string
    locale: string
    value: string
    outdated: boolean
    updatedAt: string
  }[]
  seo: {
    title: string
    description: string
  }
}
