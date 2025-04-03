import type { Resource } from 'Types/Resource'
import Discount from './Discount'
import Product from './Product'
import Variant from './Variant'
import Shipping from './Shipping'
import Webhook from './Webhook'
import Translator from './Translator'

export default class Shopify {
  public product: Product
  public variant: Variant
  public shipping: Shipping
  public discount: Discount
  public webhook: Webhook

  constructor() {
    this.product = new Product()
    this.variant = new Variant()
    this.shipping = new Shipping()
    this.discount = new Discount()
    this.webhook = new Webhook()
  }

  public translator(resource: Resource) {
    return new Translator(resource)
  }
}
