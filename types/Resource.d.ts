export type Resource = 'product' | 'collection' | 'article'

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
