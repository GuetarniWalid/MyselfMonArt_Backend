import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'

export default class TranslateProduct extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(3, 30)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    const shopify = new Shopify()
    const productsToTranslate = await shopify.translation.getOutdatedTranslations('product')
    console.log('🚀 ~ products to translate length:', productsToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const product of productsToTranslate) {
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
