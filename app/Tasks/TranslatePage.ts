import type { LanguageCode } from 'Types/Translation'
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

    await this.translateTo('en')
    await this.translateTo('de')
    await this.translateTo('es')
    // await this.translateTo('nl') // NL: backfill manuel (translate:manual) pour éviter le coût GPT — réactiver pour l'auto-heal une fois le backfill fait

    logTaskBoundary(false, 'Translate page')
  }

  private async translateTo(locale: LanguageCode) {
    const shopify = new Shopify()
    const pagesToTranslate = await shopify.translator('page').getOutdatedTranslations(locale)
    console.log('🚀 ~ pages to translate length:', pagesToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const page of pagesToTranslate) {
      console.log('============================')
      console.log('Id page to translate => ', page.id)
      const pageTranslated = await chatGPT.translate(page, 'page', locale)
      const responses = await shopify.translator('page').updateTranslation({
        resourceToTranslate: page,
        resourceTranslated: pageTranslated,
        isoCode: locale,
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
    console.log(`✅ Pages translations updated to ${locale}`)
  }
}
