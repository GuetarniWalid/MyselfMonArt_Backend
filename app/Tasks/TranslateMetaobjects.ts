import type { LanguageCode, RegionCode } from 'Types/Translation'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import TranslationSkipCacheService from 'App/Services/TranslationSkipCache'
import { lookupOptionValue } from 'App/Services/Shopify/Translator/optionValueDictionary'
import { localePassesFor } from 'App/Services/i18n'
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

    for (const { locale, region } of localePassesFor('metaobject')) {
      await this.translateTo(locale, region)
    }

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
    let localeNotSupportedByShop = false

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

      // Border/frame swatch names (painting_option.name) resolve through the shared canonical
      // dictionary so they stay byte-identical to the product option-value translations —
      // otherwise the theme's swatch match (`border.name == value`) breaks and the swatch
      // disappears. Everything else still goes through ChatGPT. See optionValueDictionary.ts.
      const canonicalName =
        metaobject.type === 'painting_option' && metaobject.field.key === 'name'
          ? lookupOptionValue(metaobject.field.jsonValue as string, locale)
          : undefined
      const metaobjectTranslated = canonicalName
        ? { ...metaobject, field: { ...metaobject.field, jsonValue: canonicalName } }
        : await chatGPT.translate(metaobject, 'metaobject', locale, region)

      // Pre-Shopify check: if the model returned a translation equal to the source
      // (typical when content is already in the target language, e.g. "Bronze" → "Bronze"),
      // Utils.createTranslationEntry would silently drop it and Shopify would never get notified,
      // so the metaobject would stay outdated forever. Cache it here.
      const translatedValue = (metaobjectTranslated as { field?: { jsonValue?: unknown } })?.field
        ?.jsonValue
      if (translatedValue !== undefined && translatedValue === sourceContent) {
        await skipCache.markFailed(cacheKey, sourceContent, 'Translation equals source content')
        console.log('🧊 Cached as skip — translation equals source, no Shopify call needed')
        console.log('============================')
        continue
      }

      const responses = await shopify.translator('metaobject').updateTranslation({
        resourceToTranslate: metaobject,
        resourceTranslated: metaobjectTranslated,
        isoCode: locale,
        region,
      })
      let cachedThisRound = false
      for (const response of responses) {
        const userErrors = response.translationsRegister.userErrors
        if (userErrors.length === 0) {
          console.log('✅ Translation updated')
          continue
        }
        console.log('🚨 Error => ', userErrors)

        const messages = userErrors
          .map((e: { message?: string }) => (typeof e.message === 'string' ? e.message : ''))
          .join(' | ')
          .toLowerCase()

        const isValueMatch = messages.includes('value cannot match original content')
        const isInvalidLocale = messages.includes('locale is not a valid locale for the shop')

        // Only cache a genuine value-echo rejection. A transient "locale not enabled"
        // error must NOT poison the cache: it stores the current source hash, and since
        // shouldSkip only re-checks the source hash, the content would never be retried
        // once the locale is re-enabled (FR frozen for good). isInvalidLocale just bails
        // the locale below; the next run retries.
        if (isValueMatch && !cachedThisRound) {
          await skipCache.markFailed(cacheKey, sourceContent, userErrors[0]?.message ?? 'rejected')
          cachedThisRound = true
          console.log('🧊 Cached as skip — will not retry until source changes')
        }

        // The shop hasn't enabled this locale at all. Every following item in this loop
        // will hit the same error: bail out of the whole locale instead of burning ~480
        // gpt-5 calls for nothing.
        if (isInvalidLocale) {
          localeNotSupportedByShop = true
          console.log(
            `⛔ Locale "${locale}${region ? `-${region}` : ''}" is not enabled on this Shopify shop. ` +
              `Stopping the rest of this run for that locale. Enable it in Shopify Admin > Settings > Languages, ` +
              `or remove the corresponding translateTo() call from TranslateMetaobjects.handle().`
          )
          break
        }
      }
      console.log('============================')
      if (localeNotSupportedByShop) break
    }

    if (localeNotSupportedByShop) {
      console.log(
        `⏹️  Skipped remaining metaobjects for ${locale}${region ? `-${region}` : ''} (locale not supported by shop)`
      )
    } else {
      console.log(`✅ Metaobjects translations updated to ${locale}${region ? `-${region}` : ''}`)
    }
  }
}
