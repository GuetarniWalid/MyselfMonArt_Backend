import { BaseCommand } from '@adonisjs/core/build/standalone'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'
import { MetaobjectToTranslate } from 'Types/Metaobject'

export default class ShopifyTranslatePaintingOptions extends BaseCommand {
  public static commandName = 'shopify:translate_painting_options'
  public static description = 'Translate painting options'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Translate Painting Option Metaobjects')

    const shopify = new Shopify()
    const contentToTranslate = (await shopify
      .translator('metaobject')
      .getOutdatedTranslations()) as MetaobjectToTranslate[]

    const chatGPT = new ChatGPT()

    for (const content of contentToTranslate) {
      const metaobjectTranslated = await chatGPT.translate(content, 'metaobject', 'en', 'UK')
      const responses = await shopify.translator('metaobject').updateTranslation({
        resourceToTranslate: content,
        resourceTranslated: metaobjectTranslated,
        isoCode: 'en',
        region: 'UK',
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
    console.log('✅ Metaobjects translations updated')

    logTaskBoundary(false, 'Translate Painting Option Metaobjects')
  }
}
