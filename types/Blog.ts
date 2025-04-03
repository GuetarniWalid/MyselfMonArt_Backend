export interface BlogWithOutdatedTranslations {
  id: string
  handle: string
  title: string
  translations: {
    key: string
    locale: string
    value: string
    outdated: boolean
    updatedAt: string
  }[]
}

export interface BlogToTranslate {
  id: string
  handle: string
  title: string
}

export interface BlogToTranslateFormatted {
  handle: string
  title: string
}

export interface Blog {
  id: string
  handle: string
  title: string
}
