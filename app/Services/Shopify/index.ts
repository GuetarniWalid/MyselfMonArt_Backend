import type { Resource } from 'Types/Resource'
import Discount from './Discount'
import Metafield from './Metafield'
import Metaobject from './Metaobject'
import Product from './Product'
import Shipping from './Shipping'
import Translator from './Translator'
import Variant from './Variant'
import Webhook from './Webhook'

export default class Shopify {
  public discount: Discount
  public metafield: Metafield
  public metaobject: Metaobject
  public product: Product
  public shipping: Shipping
  public variant: Variant
  public webhook: Webhook

  constructor() {
    this.discount = new Discount()
    this.metafield = new Metafield()
    this.metaobject = new Metaobject()
    this.product = new Product()
    this.shipping = new Shipping()
    this.variant = new Variant()
    this.webhook = new Webhook()
  }

  public translator(resource: Resource) {
    return new Translator(resource)
  }
}
