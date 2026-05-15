import type { StaticSectionToTranslate } from 'Types/StaticSection'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class TranslateStaticSection extends BaseTask {
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

    console.log('🚀 ~ static sections to translate length:', contentToTranslate.length)
    const chatGPT = new ChatGPT()

    let failures = 0
    for (const content of contentToTranslate) {
      try {
        console.log('============================')
        console.log(`🚀 ~ Translating static section key="${content.key}"`)
        const themeTranslated = await chatGPT.translate(content, 'static_section', 'en')
        const responses = await shopify.translator('static_section').updateTranslation({
          resourceToTranslate: content,
          resourceTranslated: themeTranslated,
          isoCode: 'en',
        })
        for (const response of responses) {
          if (response.translationsRegister.userErrors.length > 0) {
            console.log('🚨 Error => ', response.translationsRegister.userErrors)
          } else {
            console.log('✅ Translation updated')
          }
        }
      } catch (error) {
        failures++
        const message = (error as Error)?.message ?? String(error)
        console.error(
          `🚨 Skipping static section key="${content.key}" — translation failed: ${message}`
        )
      }
    }

    console.log('============================')
    if (failures > 0) {
      console.log(
        `⚠️  Static Sections translations finished with ${failures} skipped item(s) on ${contentToTranslate.length} total`
      )
    } else {
      console.log('✅ Static Sections translations updated')
    }

    logTaskBoundary(false, 'Translate Static Sections')
  }
}
