import { BaseTask /*, CronTimeV2 */ } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'

export default class TranslateProduct extends BaseTask {
  public static get schedule() {
    // Never trigger - using an invalid cron expression
    return '0 0 31 2 *' // February 31st (which doesn't exist)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
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
