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
