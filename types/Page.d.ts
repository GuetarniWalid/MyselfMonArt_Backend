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

export interface PageToTranslate extends Translatable {
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
}
