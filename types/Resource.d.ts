export type Resource =
  | 'product'
  | 'collection'
  | 'article'
  | 'blog'
  | 'page'
  | 'model'
  | 'static_section'

export type ResourceSEO = {
  title: string
  description: string
}

export type ResourceMedia = {
  id: string
  alts: string[]
}

export type ResourceImage = {
  id: string
  altText: string
}
