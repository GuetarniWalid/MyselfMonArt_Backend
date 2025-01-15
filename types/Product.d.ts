declare type CreateProduct = {
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

declare type Image = {
  src: string
  filename: string
  alt: string
  position: number
  product_id?: number
}

declare type ProductCreated = {
  id: number
  variants: [
    {
      id: number
    },
  ]
}

declare type Ratio = 'square' | 'portrait' | 'landscape' | 'personalized portrait'

declare type UpdateProductPainting = {
  type: 'painting'
  productId: number
  ratio: Ratio
  variant: {
    title: string
    price?: string
  }
}

declare type UpdateProductTapestry = {
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
