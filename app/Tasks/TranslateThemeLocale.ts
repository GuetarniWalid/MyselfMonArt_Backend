import type { LanguageCode, RegionCode } from 'Types/Translation'
import type { StaticSectionToTranslate } from 'Types/StaticSection'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import TranslationSkipCacheService from 'App/Services/TranslationSkipCache'
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

    // NB: no separate 'en'+'UK' pass. These are theme UI strings (buttons, aria-labels,
    // section copy) — a UK market override would be byte-identical to base English, so the
    // UK market is already served by the base 'en' translation via Shopify's locale
    // fallback. A distinct British-English variant isn't worth ~335 duplicate entries.
    await this.translateTo('en')
    await this.translateTo('es')
    await this.translateTo('de')
    // await this.translateTo('nl') // NL: backfill manuel (translate:manual) pour éviter le coût GPT — réactiver pour l'auto-heal une fois le backfill fait

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

          if ((isValueMatch || isInvalidLocale) && !cachedThisRound) {
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
