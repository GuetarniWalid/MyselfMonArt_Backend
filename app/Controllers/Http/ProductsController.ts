import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import ProductValidator from 'App/Validators/ProductValidator'
import SearchPaintingData from '../../../services/SearchPaintingData'
import Shopify from '../../../services/Shopify'

export default class ProductsController {
  public async create({ request }: HttpContextContract) {
    try {
      const product = await request.validate(ProductValidator)
      product.published_scope = 'web'

      const options = product.variants[0].option1.split('/')
      const paintingPrice = await new SearchPaintingData(product.ratio, options).getPaintingPrice()

      product.variants[0].price = paintingPrice

      const shopify = new Shopify('product')
      const productCreated = await shopify.createProduct(product)
      return productCreated
    } catch (error) {
      return error
    }
  }
}
