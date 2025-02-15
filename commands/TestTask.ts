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
    this.logger.info('Handled')
    const shopify = new Shopify()
    const productsToTranslate = await shopify.translation.getOutdatedTranslations('product')

    const chatGPT = new ChatGPT()
    // TODO: Add a loop to translate all products
    const productTranslated = await chatGPT.translate(productsToTranslate[0], 'product', 'en')
    const responses = await shopify.translation.updateTranslation({
      resourceToTranslate: productsToTranslate[0],
      resourceTranslated: productTranslated,
      resource: 'product',
      isoCode: 'en',
    })
    responses.forEach((response) => {
      this.logger.info(response)
    })
    this.logger.info('translations updated')
  }
}
