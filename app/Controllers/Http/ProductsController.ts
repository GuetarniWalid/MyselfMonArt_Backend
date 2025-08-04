import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Shopify from 'App/Services/Shopify/index'
import UpdateProductMetafieldValidator from 'App/Validators/UpdateProductMetafieldValidator'

export default class ProductsController {
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
