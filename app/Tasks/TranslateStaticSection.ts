import type { StaticSectionToTranslate } from 'Types/StaticSection'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'
export default class TranslateProduct extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(4, 30)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate Static Sections')

    const shopify = new Shopify()
    const contentToTranslate = (await shopify
      .translator('static_section')
      .getOutdatedTranslations()) as StaticSectionToTranslate[]

    const chatGPT = new ChatGPT()

    for (const content of contentToTranslate) {
      const themeTranslated = await chatGPT.translate(content, 'static_section', 'en')
      const responses = await shopify.translator('static_section').updateTranslation({
        resourceToTranslate: content,
        resourceTranslated: themeTranslated,
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
    console.log('✅ Static Sections translations updated')

    logTaskBoundary(false, 'Translate Static Sections')
  }
}
