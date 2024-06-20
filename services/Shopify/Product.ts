import Authentication from './Authentication'
import Metafield from './Metafield'
import Variant from './Variant'

export default class Product extends Authentication {
  constructor() {
    super()
  }

  public async create(product: CreateProduct) {
    const response = await this.client.request({
      method: 'POST',
      url: 'products.json',
      data: { product },
    })
    const productCreated = response.data.product as ProductCreated
    return {
      variantID: productCreated.variants[0].id,
    }
  }

  public async updateVariant(product: UpdateProduct) {
    const variant = new Variant()
    return variant.update(product)
  }

  public async updateMetafieldLikesCount({
    productId,
    action,
  }: {
    productId: number
    action: 'increment' | 'decrement'
  }) {
    const metafield = new Metafield('products', productId)
    const newCount =
      action === 'increment'
        ? await metafield.increment('likes', 'number')
        : await metafield.decrement('likes', 'number')
    return newCount
  }
}
