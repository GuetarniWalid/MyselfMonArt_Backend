import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import CreateProductValidator from 'App/Validators/CreateProductValidator'
import SearchPaintingData from 'App/Domain/Product/SearchPaintingData'
import Shopify from 'App/Services/Shopify/index'
import UpdateProductMetafieldValidator from 'App/Validators/UpdateProductMetafieldValidator'
import UpdateProductTapestryValidator from 'App/Validators/UpdateProductTapestryValidator'
import Tapestry from 'App/Models/Tapestry'

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

  public async updateTapestry({ request }: HttpContextContract) {
    try {
      const product = await request.validate(UpdateProductTapestryValidator)
      const tapestryModel = await Tapestry.first()
      const priceM2 = tapestryModel!.price
      const priceCm2 = priceM2 / 10000
      product.variant.price = (product.cm2 * priceCm2).toFixed(1)

      const shopify = new Shopify()
      const variantData = await shopify.product.updateTapestryVariant(product)
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
