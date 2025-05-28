import { BaseCommand } from '@adonisjs/core/build/standalone'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test task logic implementation'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Translate product')

    const shopify = new Shopify()
    const productsToTranslate = await shopify.translator('product').getOutdatedTranslations()
    console.log('🚀 ~ products to translate length:', productsToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const product of productsToTranslate) {
      console.log('🚀 ~ Id product to translate => ', product.id)
      const productTranslated = await chatGPT.translate(product, 'product', 'en')
      const responses = await shopify.translator('product').updateTranslation({
        resourceToTranslate: product,
        resourceTranslated: productTranslated,
        isoCode: 'en',
      })
      responses.forEach((response) => {
        if (response.translationsRegister.userErrors.length > 0) {
          console.log('🚨 Error => ', response.translationsRegister.userErrors)
        } else {
          console.log('✅ Translation updated')
        }
      })
      console.log('============================')
    }
    console.log('✅ Products translations updated')

    logTaskBoundary(false, 'Translate product')
  }
}
