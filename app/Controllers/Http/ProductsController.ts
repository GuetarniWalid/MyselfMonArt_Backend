import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import ProductValidator from 'App/Validators/ProductValidator'
import Shopify from '../../../services/shopify'

export default class ProductsController {
  public async create({ request }: HttpContextContract) {
    const product = await request.validate(ProductValidator)
    product.published_scope = 'web'
    product.variants.forEach((variant) => {
      variant.price = '10.00'
    })

    //    [{"option1":"First","price":"10.00","sku":"123"},{"option1":"Second","price":"20.00","sku":"123"}]

    try {
      const shopify = new Shopify('product')
      const data = await shopify.createProduct(product)
      console.log('🚀 ~ data:', data)
      // const data = await shopify.createProduct(product)
      return data
    } catch (error) {
      console.log('🚀 ~ error:', error)
      return error
    }
  }
}
