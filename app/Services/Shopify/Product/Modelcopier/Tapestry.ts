import { Product, ProductById } from 'Types/Product'
import Shopify from '../..'
import ModelCopier from './index'

export default class TapestryCopier extends ModelCopier {
  /**
   * Main entry point - uses differential update system
   * Replaces legacy full recreation approach
   */
  public async copyModelDataOnProduct(product: ProductById) {
    const model = await this.getTapestryModel()
    if (!model) return

    await this.updateProductDifferentially(product, model)
  }

  public isModelProduct(product: ProductById | Product): boolean {
    return product.tags.some((tag) => ['tapestry model'].includes(tag))
  }

  public canProcessProductCreate(product: ProductById | Product): boolean {
    if (!product) return false
    if (this.isModelProduct(product)) return false
    if (product.artworkTypeMetafield?.value !== 'tapestry') return false
    return true
  }

  public async getTapestryModel() {
    const shopify = new Shopify()
    const model = await shopify.product.getProductByTag('tapestry model')
    return model
  }

  public getTagFromProduct(product: ProductById | Product) {
    const productHasTapestryTag = product.tags.some((tag) => ['tapestry model'].includes(tag))
    return productHasTapestryTag ? 'tapestry model' : null
  }

  public getRelatedProducts(products: Product[]) {
    return products.filter((p) => {
      const isModel = this.isModelProduct(p)
      if (isModel) return false

      return p.artworkTypeMetafield?.value === 'tapestry'
    })
  }
}
