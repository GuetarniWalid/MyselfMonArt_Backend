import type { Resource } from 'Types/Resource'
import Collection from './Collection'
import Discount from './Discount'
import Metafield from './Metafield'
import Metaobject from './Metaobject'
import Page from './Page'
import Product from './Product'
import Publications from './Publications'
import Shipping from './Shipping'
import Translator from './Translator'
import Variant from './Variant'
import Webhook from './Webhook'

export default class Shopify {
  public collection: Collection
  public discount: Discount
  public metafield: Metafield
  public metaobject: Metaobject
  public page: Page
  public product: Product
  public publications: Publications
  public shipping: Shipping
  public variant: Variant
  public webhook: Webhook

  constructor() {
    this.collection = new Collection()
    this.discount = new Discount()
    this.metafield = new Metafield()
    this.metaobject = new Metaobject()
    this.page = new Page()
    this.product = new Product()
    this.publications = new Publications()
    this.shipping = new Shipping()
    this.variant = new Variant()
    this.webhook = new Webhook()
  }

  public translator(resource: Resource) {
    return new Translator(resource)
  }
}
