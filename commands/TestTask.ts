import { BaseCommand } from '@adonisjs/core/build/standalone'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test task logic implementation'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()
    const productsToTranslate = await shopify.translation.getOutdatedTranslations('product')
    console.log('🚀 ~ products to translate length:', productsToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const product of productsToTranslate.slice(0, 60)) {
      console.log('============================')
      console.log('🚀 ~ Id product to translate => ', product.id)
      const productTranslated = await chatGPT.translate(product, 'product', 'en')
      const responses = await shopify.translation.updateTranslation({
        resourceToTranslate: product,
        resourceTranslated: productTranslated,
        resource: 'product',
        isoCode: 'en',
      })
      responses.forEach((response) => {
        if (response.translationsRegister.userErrors.length > 0) {
          console.log('🚀 ~ error => ', response.translationsRegister.userErrors)
        } else {
          console.log('🚀 ~ translation updated')
        }
      })
      console.log('============================')
    }
    console.log('🚀 ~ translations updated')
  }
}
