import Product from './Product'

export default class Shopify {
  public product: Product

  constructor() {
    this.product = new Product()
  }
}
