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

declare type UpdateProduct = {
  productId: number
  ratio: 'square' | 'portrait' | 'landscape'
  nbOfOptions: number
  variant: {
    title: string
    price?: string
  }
}

declare type Variant = {
  title: string
  price?: string
}

declare type Image = {
  src: string
  filename: string
  alt: string
  position: number
  product_id?: number
}

declare type Order = {
  email: string
  financial_status: string
  fulfillment_status: string
  send_receipt: boolean
  send_fulfillment_receipt: boolean
  line_items: LineItem[]
}

declare type LineItem = {
  title: number
  quantity: number
  price: number
}

declare type PaintingVariantsWithoutChildren = {
  name: string
  price: number
  technicalName: string | number
  technicalType: string
}

declare type PaintingVariantsWithChildrenChildren = {
  name: string
  price: number
  children: PaintingVariantsWithChildren[]
  technicalName: string
  technicalType: string
}

declare type PaintingVariantsWithChildren = {
  name: string
  price: number
  children: PaintingVariantsWithoutChildren[][]
  technicalName: string
  technicalType: string
}

declare type PaintingJson = PaintingVariantsWithChildrenChildren[]

declare type ProductCreated = {
  id: number
  variants: [
    {
      id: number
    },
  ]
}
