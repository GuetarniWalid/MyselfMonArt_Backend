import type { LanguageCode } from 'Types/Translation'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { localePassesFor } from 'App/Services/i18n'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class TranslateArticle extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(3, 0)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate article')

    for (const { locale } of localePassesFor('article')) {
      await this.translateTo(locale)
    }

    logTaskBoundary(false, 'Translate article')
  }

  private async translateTo(locale: LanguageCode) {
    const shopify = new Shopify()
    const articlesToTranslate = await shopify.translator('article').getOutdatedTranslations(locale)
    console.log('🚀 ~ articles to translate length:', articlesToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const article of articlesToTranslate) {
      console.log('============================')
      console.log('Id article to translate => ', article.id)
      const articleTranslated = await chatGPT.translate(article, 'article', locale)
      const responses = await shopify.translator('article').updateTranslation({
        resourceToTranslate: article,
        resourceTranslated: articleTranslated,
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
    console.log(`✅ Articles translations updated to ${locale}`)
  }
}
