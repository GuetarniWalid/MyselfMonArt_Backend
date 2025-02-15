import Discount from './Discount'
import Product from './Product'
import Variant from './Variant'
import Shipping from './Shipping'
import Translation from './Translator'
import Webhook from './Webhook'

export default class Shopify {
  public product: Product
  public variant: Variant
  public shipping: Shipping
  public discount: Discount
  public translation: Translation
  public webhook: Webhook

  constructor() {
    this.product = new Product()
    this.variant = new Variant()
    this.shipping = new Shipping()
    this.discount = new Discount()
    this.translation = new Translation()
    this.webhook = new Webhook()
  }
}
