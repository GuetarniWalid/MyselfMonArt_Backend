import { BaseCommand } from '@adonisjs/core/build/standalone'
import type { ModelToTranslate } from 'Types/Model'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test task logic implementation'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Translate Models')

    const shopify = new Shopify()
    const contentToTranslate = (await shopify
      .translator('model')
      .getOutdatedTranslations()) as ModelToTranslate[]

    const chatGPT = new ChatGPT()

    for (const content of contentToTranslate) {
      if (content.file && !content.file.alt) continue

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
