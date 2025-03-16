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

export interface CollectionToTranslate extends Translatable {
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
