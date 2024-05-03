import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import CreateProductValidator from 'App/Validators/CreateProductValidator'
import SearchPaintingData from '../../../services/SearchPaintingData'
import Shopify from '../../../services/Shopify'
import UpdateProductValidator from 'App/Validators/UpdateProductValidator'

export default class ProductsController {
  public async create({ request }: HttpContextContract) {
    try {
      const product = await request.validate(CreateProductValidator)
      product.published_scope = 'web'

      const options = product.variants[0].title.split('/')
      const paintingPrice = await new SearchPaintingData(product.ratio, options).getPaintingPrice()

      product.variants[0].price = paintingPrice

      const shopify = new Shopify('product')
      const productCreated = await shopify.createProduct(product)
      return productCreated
    } catch (error) {
      return error
    }
  }

  public async update({ request }: HttpContextContract) {
    try {
      const product = await request.validate(UpdateProductValidator)
      const options = product.variant.title.split('/')
      const paintingPrice = await new SearchPaintingData(product.ratio, options).getPaintingPrice()
      product.variant.price = paintingPrice

      const shopify = new Shopify('product')
      const variantData = await shopify.updateProductVariant(product)
      return variantData
    } catch (error) {
      return error
    }
  }
}
