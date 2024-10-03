import Discount from './Discount'
import Product from './Product'
import Shipping from './Shipping'

export default class Shopify {
  public product: Product
  public shipping: Shipping
  public discount: Discount

  constructor() {
    this.product = new Product()
    this.shipping = new Shipping()
    this.discount = new Discount()
  }
}
