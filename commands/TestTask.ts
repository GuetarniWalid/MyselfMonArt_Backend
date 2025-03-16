import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
// import UpdateProductPaintingValidator from 'App/Validators/UpdateProductPaintingValidator'
// import { validator } from '@ioc:Adonis/Core/Validator'
// import SearchPaintingData from 'App/Domain/Product/SearchPaintingData'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test task logic implementation'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()
    const collectionsToTranslate = await shopify.translation.getOutdatedTranslations('collection')
    console.log('🚀 ~ collectionsToTranslate:', collectionsToTranslate)

    return
    // console.log('products to translate length:', productsToTranslate.length)
    // const chatGPT = new ChatGPT()

    // for (const product of productsToTranslate) {
    //   console.log('============================')
    //   console.log('Id product to translate => ', product.id)
    //   const productTranslated = await chatGPT.translate(product, 'product', 'en')
    //   const responses = await shopify.translation.updateTranslation({
    //     resourceToTranslate: product,
    //     resourceTranslated: productTranslated,
    //     resource: 'product',
    //     isoCode: 'en',
    //   })
    //   responses.forEach((response) => {
    //     if (response.translationsRegister.userErrors.length > 0) {
    //       console.log('error => ', response.translationsRegister.userErrors)
    //     } else {
    //       console.log('translation updated')
    //     }
    //   })
    //   console.log('============================')
    // }
    // this.logger.info('translations updated')
  }
}
