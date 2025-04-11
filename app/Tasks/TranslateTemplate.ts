import type { ThemeToTranslate } from 'Types/Theme'
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
      .translator('theme')
      .getOutdatedTranslations()) as ThemeToTranslate[]

    const chatGPT = new ChatGPT()

    for (const content of contentToTranslate) {
      const themeTranslated = await chatGPT.translate(content, 'theme', 'en')
      const responses = await shopify.translator('theme').updateTranslation({
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
    console.log('✅ Themes translations updated')

    logTaskBoundary(false, 'Translate Models')
  }
}
