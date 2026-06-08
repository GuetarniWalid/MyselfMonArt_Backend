import type { LanguageCode } from 'Types/Translation'
import type { StaticSectionToTranslate } from 'Types/StaticSection'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import TranslationSkipCacheService from 'App/Services/TranslationSkipCache'
import { ACTIVE_LOCALES, localePassesFor } from 'App/Services/i18n'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class TranslateStaticSection extends BaseTask {
  // Theme locales whose stale media overrides we keep in sync. The default locale
  // (French) is the source and is never overridden.
  private static readonly MEDIA_CLEANUP_LOCALES: readonly LanguageCode[] = ACTIVE_LOCALES

  public static get schedule() {
    return CronTimeV2.everyDayAt(4, 30)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate Static Sections')

    // Section-setting text (titles/subtitles/buttons saved in the theme editor) must be
    // translated into EVERY active language. This task used to push 'en' ONLY — so es/de/nl
    // section copy was never translated (2026-06-08 i18n audit). It now derives its locales
    // from config/i18n like the other tasks, with a skip cache and a graceful bail when a
    // locale isn't enabled on the shop yet.
    for (const { locale } of localePassesFor('static_section')) {
      await this.translateTo(locale)
    }

    await this.cleanStaleMediaOverrides(new Shopify())

    logTaskBoundary(false, 'Translate Static Sections')
  }

  private async translateTo(locale: LanguageCode) {
    const shopify = new Shopify()
    const skipCache = new TranslationSkipCacheService()
    const chatGPT = new ChatGPT()

    const items = (await shopify
      .translator('static_section')
      .getOutdatedTranslations(locale)) as StaticSectionToTranslate[]
    console.log(`🚀 ~ [${locale}] static section settings to translate:`, items.length)

    let localeNotSupportedByShop = false
    let failures = 0

    for (const item of items) {
      const cacheKey = {
        resourceId: item.id,
        resourceType: 'static_section',
        locale,
        fieldKey: item.key,
      }

      if (await skipCache.shouldSkip(cacheKey, item.value)) {
        continue
      }

      try {
        const translated = (await chatGPT.translate(
          item,
          'static_section',
          locale
        )) as StaticSectionToTranslate

        // Language-invariant value (brand name, "FAQ", a lone placeholder): Shopify rejects
        // value===source so it would stay outdated forever — cache until the source changes.
        if (translated.value === item.value) {
          await skipCache.markFailed(cacheKey, item.value, 'Translation equals source content')
          continue
        }

        const responses = await shopify.translator('static_section').updateTranslation({
          resourceToTranslate: item,
          resourceTranslated: translated,
          isoCode: locale,
        })

        let cachedThisRound = false
        for (const response of responses) {
          const userErrors = response.translationsRegister.userErrors
          if (userErrors.length === 0) continue

          console.log(`🚨 [${locale}] ${item.key} =>`, userErrors)
          const messages = userErrors
            .map((e: { message?: string }) => (typeof e.message === 'string' ? e.message : ''))
            .join(' | ')
            .toLowerCase()
          const isValueMatch = messages.includes('value cannot match original content')
          const isInvalidLocale = messages.includes('locale is not a valid locale for the shop')

          // Only cache a genuine value-echo. Never poison the cache on a transient
          // "locale not enabled" error (it would freeze the key until the source changes).
          if (isValueMatch && !cachedThisRound) {
            await skipCache.markFailed(cacheKey, item.value, userErrors[0]?.message ?? 'rejected')
            cachedThisRound = true
          }
          if (isInvalidLocale) {
            localeNotSupportedByShop = true
            console.log(
              `⛔ Locale "${locale}" is not enabled on this shop — stopping this locale. ` +
                `Enable it in Shopify Admin > Settings > Languages (next run picks it up).`
            )
            break
          }
        }
      } catch (error) {
        failures++
        console.error(
          `🚨 [${locale}] static section key="${item.key}" failed: ${(error as Error)?.message ?? String(error)}`
        )
      }

      if (localeNotSupportedByShop) break
    }

    console.log(
      localeNotSupportedByShop
        ? `⏹️  [${locale}] static sections skipped (locale not enabled on shop)`
        : `✅ [${locale}] static sections updated${failures ? ` (${failures} failed)` : ''}`
    )
  }

  /**
   * Theme section-setting SVG icons (e.g. the "What makes the difference" badges) are
   * graphics, not copy: they must be identical in every locale. A per-locale override
   * is always wrong — once the source artwork changes, the override goes stale and the
   * translated storefront keeps rendering the old icon. We purge any such override so
   * the storefront inherits the source. Running this daily makes the fix self-healing.
   */
  private async cleanStaleMediaOverrides(shopify: Shopify) {
    console.log('============================')
    console.log('🧹 Cleaning stale theme media (SVG) overrides')

    for (const locale of TranslateStaticSection.MEDIA_CLEANUP_LOCALES) {
      try {
        const overrides = await shopify
          .translator('static_section')
          .getStaleThemeMediaOverrides(locale)
        if (overrides.length === 0) {
          console.log(`✅ [${locale}] no stale media overrides`)
          continue
        }

        // Group keys per resource so each resource is cleaned in one mutation batch.
        const byResource = new Map<string, string[]>()
        for (const { resourceId, key } of overrides) {
          const keys = byResource.get(resourceId) ?? []
          keys.push(key)
          byResource.set(resourceId, keys)
        }

        let removed = 0
        for (const [resourceId, translationKeys] of byResource) {
          const responses = await shopify.translator('static_section').removeTranslations({
            resourceId,
            translationKeys,
            locale,
          })
          const userErrors = responses.flatMap((r: any) => r.translationsRemove?.userErrors ?? [])
          if (userErrors.length > 0) {
            console.log(`🚨 [${locale}] ${resourceId} =>`, userErrors)
          } else {
            removed += translationKeys.length
          }
        }
        console.log(`✅ [${locale}] removed ${removed} stale media override(s)`)
      } catch (error) {
        const message = (error as Error)?.message ?? String(error)
        console.error(`🚨 [${locale}] media override cleanup failed: ${message}`)
      }
    }
  }
}
