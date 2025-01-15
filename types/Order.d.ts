export type Order = {
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
