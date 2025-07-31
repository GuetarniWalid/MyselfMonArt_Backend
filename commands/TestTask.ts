import { BaseCommand } from '@adonisjs/core/build/standalone'
import { logTaskBoundary } from 'App/Utils/Logs'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { LanguageCode, RegionCode } from 'Types/Translation'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test task'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Translate product')

    await this.translateTo('en')
    await this.translateTo('en', 'UK')

    logTaskBoundary(false, 'Translate product')
  }

  private async translateTo(locale: LanguageCode, region?: RegionCode) {
    const shopify = new Shopify()
    const productsToTranslate = await shopify
      .translator('product')
      .getOutdatedTranslations(locale, region)
    console.log('🚀 ~ products to translate length:', productsToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const product of productsToTranslate) {
      console.log('============================')
      console.log('🚀 ~ Id product to translate => ', product.id)
      const productTranslated = await chatGPT.translate(product, 'product', locale, region)
      const responses = await shopify.translator('product').updateTranslation({
        resourceToTranslate: product,
        resourceTranslated: productTranslated,
        isoCode: locale,
        region,
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
    console.log(`✅ Products translations updated to ${locale}${region ? `-${region}` : ''}`)
  }
}
