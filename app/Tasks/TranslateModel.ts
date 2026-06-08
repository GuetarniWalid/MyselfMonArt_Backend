import type { LanguageCode } from 'Types/Translation'
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

    await this.translateTo('en')
    await this.translateTo('de')
    await this.translateTo('es')
    // await this.translateTo('nl')

    logTaskBoundary(false, 'Translate Models')
  }

  private async translateTo(locale: LanguageCode) {
    const shopify = new Shopify()
    const contentToTranslate = (await shopify
      .translator('model')
      .getOutdatedTranslations(locale)) as ModelToTranslate[]

    const chatGPT = new ChatGPT()

    for (const content of contentToTranslate) {
      // Skip ALL media items: translating a theme image uploads a duplicate file per
      // locale (~20s each, bloats the media library). The nightly cron stays text-only;
      // the visible image is identical across locales anyway, only its alt text differs.
      if (content.file) continue

      const modelTranslated = await chatGPT.translate(content, 'model', locale)
      const responses = await shopify.translator('model').updateTranslation({
        resourceToTranslate: content,
        resourceTranslated: modelTranslated,
        isoCode: locale,
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
    console.log(`✅ Models translations updated to ${locale}`)
  }
}
