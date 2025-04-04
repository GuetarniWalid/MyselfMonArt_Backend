import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class TranslatePage extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(4, 0)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate page')

    const shopify = new Shopify()
    const pagesToTranslate = await shopify.translator('page').getOutdatedTranslations()
    console.log('🚀 ~ pages to translate length:', pagesToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const page of pagesToTranslate) {
      console.log('============================')
      console.log('Id page to translate => ', page.id)
      const pageTranslated = await chatGPT.translate(page, 'page', 'en')
      const responses = await shopify.translator('page').updateTranslation({
        resourceToTranslate: page,
        resourceTranslated: pageTranslated,
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
    console.log('✅ Pages translations updated')

    logTaskBoundary(false, 'Translate page')
  }
}
