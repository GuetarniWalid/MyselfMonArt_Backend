export interface PageWithOutdatedTranslations {
  id: string
  title: string
  body: string
  handle: string
  translations: {
    key: string
    locale: string
    value: string
    outdated: boolean
    updatedAt: string
  }[]
}

export interface PageToTranslate {
  id: string
  title: string
  body: string
  handle: string
}

export interface PageToTranslateFormatted {
  title: string
  body: string
  handle: string
}

export interface Page {
  id: string
  title: string
  body: string
  handle: string
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
}
