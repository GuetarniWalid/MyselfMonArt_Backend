import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import CreateProductValidator from 'App/Validators/CreateProductValidator'
import SearchPaintingData from '../../../services/SearchPaintingData'
import Shopify from '../../../services/Shopify/index'
import UpdateProductValidator from 'App/Validators/UpdateProductValidator'
import UpdateProductMetafieldValidator from 'App/Validators/UpdateProductMetafieldValidator'

export default class ProductsController {
  public async create({ request }: HttpContextContract) {
    try {
      const product = await request.validate(CreateProductValidator)
      product.published_scope = 'web'

      const options = product.variants[0].title.split('/')
      const paintingPrice = await new SearchPaintingData(product.ratio, options).getPaintingPrice()

      product.variants[0].price = paintingPrice

      const shopify = new Shopify()
      const productCreated = await shopify.product.create(product)
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

      const shopify = new Shopify()
      const variantData = await shopify.product.updateVariant(product)
      return variantData
    } catch (error) {
      return error
    }
  }

  public async updateMetafieldLikesCount({ request }: HttpContextContract) {
    try {
      const product = await request.validate(UpdateProductMetafieldValidator)
      const shopify = new Shopify()
      const newCount = await shopify.product.updateMetafieldLikesCount(product)
      return newCount
    } catch (error) {
      return error
    }
  }
}
