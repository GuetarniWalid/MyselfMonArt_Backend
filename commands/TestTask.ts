import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
import UpdateProductPaintingValidator from 'App/Validators/UpdateProductPaintingValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import SearchPaintingData from 'App/Domain/Product/SearchPaintingData'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test task logic implementation'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const request = {
      type: 'painting',
      productId: 9525330608475,
      ratio: 'portrait',
      variant: {
        title: '75x100 cm/Toile/ Sans fixation/ Chassis de 2cm/Bordure blanche/Sans cadre',
      },
    }

    try {
      const product = await validator.validate({
        schema: new UpdateProductPaintingValidator().schema,
        data: request,
      })
      const options = product.variant.title.split('/')
      const paintingPrice = await new SearchPaintingData(product.ratio, options).getPaintingPrice()
      product.variant.price = paintingPrice

      const shopify = new Shopify()
      const variantData = await shopify.product.updateVariant(product)
      console.log('🚀 ~ variantData:', variantData)
    } catch (error) {
      console.log('🚀 ~ error:', error)
    }
  }
}
