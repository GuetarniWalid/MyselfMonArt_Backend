import type { LanguageCode, RegionCode } from 'Types/Translation'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class TranslateMetaobjects extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(4, 0)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate metaobjects')

    await this.translateTo('en')
    await this.translateTo('en', 'UK')
    await this.translateTo('es')
    await this.translateTo('de')

    logTaskBoundary(false, 'Translate metaobjects')
  }

  private async translateTo(locale: LanguageCode, region?: RegionCode) {
    const shopify = new Shopify()
    const metaobjectsToTranslate = await shopify
      .translator('metaobject')
      .getOutdatedTranslations(locale, region)
    console.log('🚀 ~ metaobjects to translate length:', metaobjectsToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const metaobject of metaobjectsToTranslate) {
      console.log('============================')
      console.log('🚀 ~ Id metaobject to translate => ', metaobject.id)
      console.log('🚀 ~ Type => ', metaobject.type)
      const metaobjectTranslated = await chatGPT.translate(metaobject, 'metaobject', locale, region)
      const responses = await shopify.translator('metaobject').updateTranslation({
        resourceToTranslate: metaobject,
        resourceTranslated: metaobjectTranslated,
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
    console.log(`✅ Metaobjects translations updated to ${locale}${region ? `-${region}` : ''}`)
  }
}
