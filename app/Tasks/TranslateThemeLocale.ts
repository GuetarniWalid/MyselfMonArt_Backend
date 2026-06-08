import type { LanguageCode, RegionCode } from 'Types/Translation'
import type { StaticSectionToTranslate } from 'Types/StaticSection'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import TranslationSkipCacheService from 'App/Services/TranslationSkipCache'
import { localePassesFor } from 'App/Services/i18n'
import { logTaskBoundary } from 'App/Utils/Logs'

/**
 * Translates the theme's CUSTOM locale-content strings (the `t:` keys in locales/*.json —
 * buttons, aria-labels, section copy, etc.) into every published language. Mirrors
 * TranslateMetaobjects: per-locale loop, skip-cache for language-invariant strings, and a
 * graceful bail when a locale isn't enabled on the shop yet (so adding German later just
 * works on the next run without burning GPT calls before then).
 *
 * Only the theme's own keys are translated; `shopify.*` / `customer_accounts.*` are skipped
 * upstream (Shopify ships official translations for those).
 */
export default class TranslateThemeLocale extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(4, 45)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate theme locale content')

    // Theme UI strings (buttons, aria-labels, section copy). No market pass: 'theme_locale'
    // isn't market-scoped in config/i18n, so a UK override (byte-identical to base English)
    // is never emitted — the UK market is served by base 'en' via Shopify's locale fallback.
    for (const { locale } of localePassesFor('theme_locale')) {
      await this.translateTo(locale)
    }

    logTaskBoundary(false, 'Translate theme locale content')
  }

  private async translateTo(locale: LanguageCode, region?: RegionCode) {
    const label = `${locale}${region ? `-${region}` : ''}`
    const shopify = new Shopify()
    const skipCache = new TranslationSkipCacheService()
    const chatGPT = new ChatGPT()

    const items = (await shopify
      .translator('static_section')
      .getOutdatedThemeLocaleContent(locale, region)) as StaticSectionToTranslate[]
    console.log(`🚀 ~ [${label}] theme locale strings to translate:`, items.length)

    let localeNotSupportedByShop = false
    // The "locale not enabled" signal only surfaces on a push error. If a locale is
    // disabled AND its leading keys are all language-invariant (so they value-skip before
    // ever pushing), we'd keep translating without learning the locale is off. Cap the
    // number of consecutive translate-but-never-push iterations to bound that waste.
    let translatedWithoutPush = 0
    const MAX_TRANSLATED_WITHOUT_PUSH = 10

    for (const item of items) {
      const cacheKey = {
        resourceId: item.id,
        resourceType: 'theme_locale',
        locale,
        region,
        fieldKey: item.key,
      }

      if (await skipCache.shouldSkip(cacheKey, item.value)) {
        continue
      }

      try {
        const translated = (await chatGPT.translate(
          item,
          'static_section',
          locale,
          region
        )) as StaticSectionToTranslate

        // If the model returns the source unchanged (language-invariant string like a
        // brand name or "FAQ"), Shopify would reject value===original and the key would
        // stay outdated forever — cache it so we don't retry until the source changes.
        if (translated.value === item.value) {
          await skipCache.markFailed(cacheKey, item.value, 'Translation equals source content')
          translatedWithoutPush++
          if (translatedWithoutPush >= MAX_TRANSLATED_WITHOUT_PUSH) {
            console.log(
              `⏸️  [${label}] ${MAX_TRANSLATED_WITHOUT_PUSH} consecutive language-invariant keys ` +
                `with no push — pausing this locale for now (it may not be enabled yet); next run resumes.`
            )
            break
          }
          continue
        }
        translatedWithoutPush = 0

        const responses = await shopify.translator('static_section').updateTranslation({
          resourceToTranslate: item,
          resourceTranslated: translated,
          isoCode: locale,
          region,
        })

        let cachedThisRound = false
        for (const response of responses) {
          const userErrors = response.translationsRegister.userErrors
          if (userErrors.length === 0) continue

          console.log(`🚨 [${label}] ${item.key} =>`, userErrors)
          const messages = userErrors
            .map((e: { message?: string }) => (typeof e.message === 'string' ? e.message : ''))
            .join(' | ')
            .toLowerCase()
          const isValueMatch = messages.includes('value cannot match original content')
          const isInvalidLocale = messages.includes('locale is not a valid locale for the shop')

          // Only cache a genuine value-echo rejection. A transient "locale not enabled"
          // error must NOT poison the cache (shouldSkip only re-checks the source hash, so
          // the key would never be retried once the locale is re-enabled). isInvalidLocale
          // just bails the locale below; the next run retries.
          if (isValueMatch && !cachedThisRound) {
            await skipCache.markFailed(cacheKey, item.value, userErrors[0]?.message ?? 'rejected')
            cachedThisRound = true
          }
          if (isInvalidLocale) {
            localeNotSupportedByShop = true
            console.log(
              `⛔ Locale "${label}" is not enabled on this shop — stopping this locale. ` +
                `Enable it in Shopify Admin > Settings > Languages (the run will pick it up next time).`
            )
            break
          }
        }
      } catch (error) {
        console.error(`🚨 [${label}] failed "${item.key}": ${(error as Error)?.message}`)
      }

      if (localeNotSupportedByShop) break
    }

    console.log(
      localeNotSupportedByShop
        ? `⏹️  [${label}] skipped (locale not enabled on shop)`
        : `✅ [${label}] theme locale content updated`
    )
  }
}
