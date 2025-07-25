import type { LanguageCode, RegionCode } from 'Types/Translation'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'
export default class TranslateProduct extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(3, 30)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate product')

    await this.translateTo('en')
    await this.translateTo('en', 'UK')

    logTaskBoundary(false, 'Translate product')
  }

  private async translateTo(locale: LanguageCode, region?: RegionCode) {
    const shopify = new Shopify()
    const productsToTranslate = await shopify
      .translator('product')
      .getOutdatedTranslations(locale, region)
    console.log('🚀 ~ products to translate length:', productsToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const product of productsToTranslate) {
      console.log('============================')
      console.log('🚀 ~ Id product to translate => ', product.id)
      const productTranslated = await chatGPT.translate(product, 'product', locale, region)
      const responses = await shopify.translator('product').updateTranslation({
        resourceToTranslate: product,
        resourceTranslated: productTranslated,
        isoCode: locale,
        region,
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
    console.log(`✅ Products translations updated to ${locale}${region ? `-${region}` : ''}`)
  }
}
