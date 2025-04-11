import type { ModelToTranslate } from 'Types/Model'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'
export default class TranslateProduct extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(4, 15)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate Models')

    const shopify = new Shopify()
    const contentToTranslate = (await shopify
      .translator('model')
      .getOutdatedTranslations()) as ModelToTranslate[]

    const chatGPT = new ChatGPT()

    for (const content of contentToTranslate) {
      const modelTranslated = await chatGPT.translate(content, 'model', 'en')
      const responses = await shopify.translator('model').updateTranslation({
        resourceToTranslate: content,
        resourceTranslated: modelTranslated,
        isoCode: 'en',
      })
      responses.forEach((response) => {
        if (response.translationsRegister.userErrors.length > 0) {
          console.log('🚨 Error => ', response.translationsRegister.userErrors)
        } else {
          console.log('✅ Translation updated')
        }
      })
    }
    console.log('============================')
    console.log('✅ Models translations updated')

    logTaskBoundary(false, 'Translate Models')
  }
}
