export type CreateProduct = {
  title: string
  body_html?: string
  vendor?: string
  product_type?: string
  status: 'draft' | 'active' | 'archived'
  tags?: string
  handle?: string
  published_scope?: 'global' | 'web'
  variants?: Variant[]
  images: Image[]
}

export type Image = {
  src: string
  filename: string
  alt: string
  position: number
  product_id?: number
}

export type ProductCreated = {
  id: number
  variants: [
    {
      id: number
    },
  ]
}

export type Ratio = 'square' | 'portrait' | 'landscape' | 'personalized portrait'

export type UpdateProductPainting = {
  type: 'painting'
  productId: number
  ratio: Ratio
  variant: {
    title: string
    price?: string
  }
}

export type UpdateProductTapestry = {
  type: 'tapestry'
  productId: number
  variant: {
    title: string
    price?: string
  }
  cm2: number
}

export interface ProductToTranslate {
  title: string
  descriptionHtml: string
  handle: string
  productType: string
  seo: {
    title: string
    description: string
  }
  media: {
    nodes: {
      image: {
        alt: string
      }
    }[]
  }
}

export interface ProductToTranslateFormatted {
  title: string
  descriptionHtml: string
  handle: string
  productType: string
  metaTitle: string
  metaDescription: string
  imageAltTexts: string[]
}
