import { BaseCommand } from '@adonisjs/core/build/standalone'
import ChatGPT from 'App/Services/ChatGPT'
import { logTaskBoundary } from 'App/Utils/Logs'
import Shopify from 'App/Services/Shopify'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test task logic implementation'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Translate article')

    const shopify = new Shopify()
    const articlesToTranslate = await shopify.translator('article').getOutdatedTranslations()
    console.log('🚀 ~ articles to translate length:', articlesToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const article of articlesToTranslate) {
      console.log('============================')
      console.log('Id article to translate => ', article.id)
      const articleTranslated = await chatGPT.translate(article, 'article', 'en')
      const responses = await shopify.translator('article').updateTranslation({
        resourceToTranslate: article,
        resourceTranslated: articleTranslated,
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
    console.log('✅ Articles translations updated')

    logTaskBoundary(false, 'Translate article')
  }
}
