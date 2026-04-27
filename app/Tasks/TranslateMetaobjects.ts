import type { LanguageCode, RegionCode } from 'Types/Translation'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import TranslationSkipCacheService from 'App/Services/TranslationSkipCache'
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
    const skipCache = new TranslationSkipCacheService()
    const metaobjectsToTranslate = await shopify
      .translator('metaobject')
      .getOutdatedTranslations(locale, region)
    console.log('🚀 ~ metaobjects to translate length:', metaobjectsToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const metaobject of metaobjectsToTranslate) {
      console.log('============================')
      console.log('🚀 ~ Id metaobject to translate => ', metaobject.id)
      console.log('🚀 ~ Type => ', metaobject.type)

      const cacheKey = {
        resourceId: metaobject.id,
        resourceType: 'metaobject',
        locale,
        region,
        fieldKey: metaobject.field.key,
      }
      const sourceContent = metaobject.field.jsonValue
      if (await skipCache.shouldSkip(cacheKey, sourceContent)) {
        console.log('⏭️  Skip from cache (previously rejected by Shopify, source unchanged)')
        console.log('============================')
        continue
      }

      const metaobjectTranslated = await chatGPT.translate(metaobject, 'metaobject', locale, region)
      const responses = await shopify.translator('metaobject').updateTranslation({
        resourceToTranslate: metaobject,
        resourceTranslated: metaobjectTranslated,
        isoCode: locale,
        region,
      })
      let cachedThisRound = false
      for (const response of responses) {
        const userErrors = response.translationsRegister.userErrors
        if (userErrors.length > 0) {
          console.log('🚨 Error => ', userErrors)
          const looksLikeValueMatch = userErrors.some(
            (e: { message?: string }) =>
              typeof e.message === 'string' &&
              e.message.toLowerCase().includes('value cannot match original content')
          )
          if (looksLikeValueMatch && !cachedThisRound) {
            await skipCache.markFailed(
              cacheKey,
              sourceContent,
              userErrors[0]?.message ?? 'Value cannot match original content'
            )
            cachedThisRound = true
            console.log('🧊 Cached as skip — will not retry until source changes')
          }
        } else {
          console.log('✅ Translation updated')
        }
      }
      console.log('============================')
    }
    console.log(`✅ Metaobjects translations updated to ${locale}${region ? `-${region}` : ''}`)
  }
}
