export type CreateProduct = {
  title: string
  descriptionHtml: string
  handle: string
  productType: string
  tags: string[]
  seo?: {
    title: string
    description: string
  }
  media?: {
    src: string
    alt: string
  }[]
  metafields: {
    namespace: string
    key: string
    value: string
    type: string
  }[]
  templateSuffix?: 'painting' | 'tapestry'
}

export type Image = {
  src: string
  filename: string
  alt: string
  position: number
  product_id?: number
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

export interface ProductToTranslate {
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
  option1Name: string
  option2Name: string
  option3Name: string
}

export interface Product {
  id: string
  title: string
  description: string
  handle: string
  productType: string
  media: {
    nodes: {
      alt: string
      mediaContentType: string
      image?: {
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
        value: string
        type: string
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
  onlineStoreUrl: string
  options: {
    id: string
    name: string
    values: string[]
  }[]
  seo: {
    title: string
    description: string
  }
  tags: string[]
  templateSuffix: string | null
  translations: {
    key: string
    locale: string
    value: string
    outdated: boolean
    updatedAt: string
  }[]
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

export interface ProductByTag {
  id: string
  paintingOptionsMetafields: {
    nodes: Array<{
      id: string
      namespace: string
      key: string
      type: string
      references: {
        edges: Array<{
          node: {
            id: string
          }
        }>
      }
    }>
  }
  options: {
    id: string
    name: string
    values: string[]
  }[]
  variants: {
    nodes: Array<{
      id: string
      price: string
      selectedOptions: {
        name: string
        value: string
      }[]
    }>
  }
}

export interface ProductById {
  id: string
  title: string
  description: string
  handle: string
  hasOnlyDefaultVariant: boolean
  tags: string[]
  templateSuffix: string | null
  media: {
    nodes: {
      alt: string
      image?: {
        width: number
        height: number
      }
    }[]
  }
  altTextsMetaObject: {
    value: string
  }
  metafields: {
    edges: {
      node: {
        namespace: string
        key: string
        reference?: {
          id?: string
          type?: string
          field?: {
            key: string
            jsonValue: string
          }
        }
      }
    }[]
  }
  paintingOptionsMetafields: {
    nodes: {
      id: string
      namespace: string
      key: string
      type: string
      references: {
        edges: {
          node: {
            id: string
          }
        }[]
      }
    }[]
  }
  options: {
    id: string
    name: string
    optionValues: {
      id: string
      name: string
    }[]
  }[]
  translations: {
    key: string
    locale: string
    value: string
    outdated: boolean
    updatedAt: string
  }[]
  variants: {
    nodes: {
      id: string
      price: string
      selectedOptions: {
        name: string
        value: string
      }[]
      title: string
    }[]
  }
}
