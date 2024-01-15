declare type Product = {
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

declare type Variant = {
  option1: string
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
