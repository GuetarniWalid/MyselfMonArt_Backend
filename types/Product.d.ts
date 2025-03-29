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

export interface ProductWithOutdatedTranslations {
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
  options: {
    id: string
    name: string
    optionValues: {
      id: string
      name: string
      translations: {
        key: string
        locale: string
        value: string
        outdated: boolean
        updatedAt: string
      }[]
    }[]
    translations: {
      key: string
      locale: string
      value: string
      outdated: boolean
      updatedAt: string
    }[]
  }[]
  productType: string
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

export interface Media {
  nodes: {
    id: string
    alt: string
  }[]
}

export interface ProductToTranslate extends Translatable {
  id: string
  title: string
  descriptionHtml: string
  handle: string
  productType: string
  options: {
    id: string
    name?: string
    optionValues: {
      id: string
      name: string
    }[]
  }[]
  seo: {
    title: string
    description: string
  }
  media: {
    id: string
    alts: string[]
  }
}

export interface ProductToTranslateFormatted {
  title: string
  descriptionHtml: string
  handle: string
  productType: string
  metaTitle: string
  metaDescription: string
  mediaAltTexts: string[]
  optionName: string
}

export interface Product {
  id: string
  title: string
  description: string
  handle: string
  media: {
    nodes: {
      alt: string
      mediaContentType: string
      image: {
        height: number
        width: number
        url: string
      }
    }[]
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
            value: string
          }
        }
      }
    }[]
  }
  options: {
    id: string
    name: string
    values: string[]
  }[]
  seo: {
    title: string
    description: string
  }
  templateSuffix: string | null
  vendor: string
}

export interface ProductUpdate {
  title?: string
  descriptionHtml?: string
  handle?: string
  productType?: string
  vendor?: string
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  seo?: {
    title?: string
    description?: string
  }
  options?: {
    name: string
  }[]
  tags?: string[]
  variants?: {
    id?: string
    price?: string
    compareAtPrice?: string
    barcode?: string
    sku?: string
    weight?: number
    weightUnit?: 'KILOGRAMS' | 'GRAMS' | 'POUNDS' | 'OUNCES'
    inventoryQuantity?: number
    inventoryPolicy?: 'DENY' | 'CONTINUE'
    inventoryManagement?: 'SHOPIFY' | 'NOT_MANAGED'
    requiresShipping?: boolean
    taxable?: boolean
  }[]
  metafields?: {
    namespace: string
    key: string
    value: string
    type: string
  }[]
}
