import type { StaticSectionToTranslate } from 'Types/StaticSection'
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
