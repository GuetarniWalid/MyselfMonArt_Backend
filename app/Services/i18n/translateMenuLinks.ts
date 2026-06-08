import type { LanguageCode } from 'Types/Translation'
import type { StaticSectionToTranslate } from 'Types/StaticSection'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import TranslationSkipCacheService from 'App/Services/TranslationSkipCache'
import { localePassesFor } from 'App/Services/i18n'

/**
 * Translates every menu link title (Shopify LINK resource) into all active locales.
 * Shared by the nightly TranslateMenu task and the one-off `translate:menus` command.
 *
 * Menu titles are short UI strings, so they go through the existing 'static_section'
 * ChatGPT translator (its prompt already covers theme menus). Link URLs are localized
 * natively by Shopify — only titles are translated here. Mirrors the other tasks:
 * skip-cache for language-invariant echoes, graceful bail when a locale isn't enabled.
 */
export async function translateMenuLinks(): Promise<void> {
  for (const { locale } of localePassesFor('link')) {
    await translateMenuLinksTo(locale)
  }
}

async function translateMenuLinksTo(locale: LanguageCode): Promise<void> {
  const shopify = new Shopify()
  const skipCache = new TranslationSkipCacheService()
  const chatGPT = new ChatGPT()

  const items = (await shopify
    .translator('link')
    .getOutdatedTranslations(locale)) as StaticSectionToTranslate[]
  console.log(`🚀 ~ [${locale}] menu links to translate:`, items.length)

  let localeNotSupportedByShop = false

  for (const item of items) {
    const cacheKey = {
      resourceId: item.id,
      resourceType: 'link',
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

      // Language-invariant title (a brand name, "FAQ", …): Shopify rejects value===source,
      // so it would stay outdated forever — cache it until the source title changes.
      if (translated.value === item.value) {
        await skipCache.markFailed(cacheKey, item.value, 'Translation equals source content')
        continue
      }

      const responses = await shopify.translator('link').updateTranslation({
        resourceToTranslate: item,
        resourceTranslated: translated,
        isoCode: locale,
      })

      let cachedThisRound = false
      for (const response of responses) {
        const userErrors = response.translationsRegister.userErrors
        if (userErrors.length === 0) {
          console.log(`✅ [${locale}] "${item.value}" → "${translated.value}"`)
          continue
        }

        console.log(`🚨 [${locale}] ${item.id} =>`, userErrors)
        const messages = userErrors
          .map((e: { message?: string }) => (typeof e.message === 'string' ? e.message : ''))
          .join(' | ')
          .toLowerCase()
        const isValueMatch = messages.includes('value cannot match original content')
        const isInvalidLocale = messages.includes('locale is not a valid locale for the shop')

        // Only cache a genuine value-echo. Never poison the cache on a transient
        // "locale not enabled" error (it would freeze the title until the source changes).
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
      console.error(
        `🚨 [${locale}] menu link "${item.value}" failed: ${(error as Error)?.message ?? String(error)}`
      )
    }

    if (localeNotSupportedByShop) break
  }

  console.log(
    localeNotSupportedByShop
      ? `⏹️  [${locale}] menu links skipped (locale not enabled on shop)`
      : `✅ [${locale}] menu links updated`
  )
}
