import type { CollectionToTranslate } from 'Types/Collection'
import type { LanguageCode } from 'Types/Translation'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import LinkLocalizer from 'App/Services/LinkLocalizer'
import Shopify from 'App/Services/Shopify'
import { localePassesFor } from 'App/Services/i18n'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class TranslateCollection extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(3, 15)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate collection')

    for (const { locale } of localePassesFor('collection')) {
      await this.translateTo(locale)
    }

    logTaskBoundary(false, 'Translate collection')
  }

  private async translateTo(locale: LanguageCode) {
    const shopify = new Shopify()
    const collectionsToTranslate = await shopify
      .translator('collection')
      .getOutdatedTranslations(locale)
    console.log('🚀 ~ collections to translate length:', collectionsToTranslate.length)
    const chatGPT = new ChatGPT()
    const linkLocalizer = new LinkLocalizer(locale)

    for (const collection of collectionsToTranslate) {
      console.log('============================')
      console.log('Id collection to translate => ', collection.id)
      const collectionTranslated = (await chatGPT.translate(
        collection,
        'collection',
        locale
      )) as Partial<CollectionToTranslate>

      // Rewrite any in-description links so they point at the locale-equivalent page
      // (locale prefix + translated handle) instead of the French source page.
      if (collectionTranslated.descriptionHtml) {
        collectionTranslated.descriptionHtml = await linkLocalizer.localizeHtml(
          collectionTranslated.descriptionHtml
        )
      }
      if (collectionTranslated.intro?.value) {
        collectionTranslated.intro.value = await linkLocalizer.localizeHtml(
          collectionTranslated.intro.value
        )
      }
      if (collectionTranslated.guide?.value) {
        collectionTranslated.guide.value = await linkLocalizer.localizeHtml(
          collectionTranslated.guide.value
        )
      }
      // The FAQ is a JSON array of { q, a }; localize links inside each HTML answer,
      // leaving the JSON structure intact.
      if (collectionTranslated.faq?.value) {
        collectionTranslated.faq.value = await this.localizeFaqLinks(
          collectionTranslated.faq.value,
          linkLocalizer
        )
      }
      // cocon_links is a JSON array of { url, label }; the label is already translated,
      // now point each url at the locale-equivalent page (locale prefix + translated handle).
      if (collectionTranslated.cocon?.value) {
        collectionTranslated.cocon.value = await this.localizeCoconLinks(
          collectionTranslated.cocon.value,
          linkLocalizer
        )
      }

      const responses = await shopify.translator('collection').updateTranslation({
        resourceToTranslate: collection,
        resourceTranslated: collectionTranslated,
        isoCode: locale,
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
    console.log(`✅ Collections translations updated to ${locale}`)
  }

  /**
   * Localizes links inside a FAQ JSON value (array of { q, a }) by rewriting hrefs in
   * each HTML answer. Returns the original string unchanged if it can't be parsed.
   */
  private async localizeFaqLinks(faqValue: string, linkLocalizer: LinkLocalizer) {
    try {
      const items = JSON.parse(faqValue)
      if (!Array.isArray(items)) return faqValue
      const localized = [] as any[]
      for (const item of items) {
        // Pass non-object entries through verbatim.
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          localized.push(item)
          continue
        }
        const next = { ...item }
        if (typeof item.a === 'string') next.a = await linkLocalizer.localizeHtml(item.a)
        localized.push(next)
      }
      return JSON.stringify(localized)
    } catch {
      return faqValue
    }
  }

  /**
   * Localizes the `url` of each cocon_links entry (JSON array of { url, label }) to the
   * locale-equivalent path (locale prefix + translated handle), leaving the JSON structure
   * and translated labels intact. Unresolvable links (external, already localized, unknown
   * handle) keep their source url. Returns the input unchanged if it isn't a valid array.
   */
  private async localizeCoconLinks(coconValue: string, linkLocalizer: LinkLocalizer) {
    try {
      const items = JSON.parse(coconValue)
      if (!Array.isArray(items)) return coconValue
      const localized = [] as any[]
      for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          localized.push(item)
          continue
        }
        const next = { ...item }
        if (typeof item.url === 'string') {
          next.url = await this.localizeUrlRelative(item.url, linkLocalizer)
        }
        localized.push(next)
      }
      return JSON.stringify(localized)
    } catch {
      return coconValue
    }
  }

  /** localizeUrl returns an absolute storefront URL; cocon_links store relative paths, so strip the host. */
  private async localizeUrlRelative(url: string, linkLocalizer: LinkLocalizer): Promise<string> {
    try {
      const absolute = await linkLocalizer.localizeUrl(url)
      if (!absolute) return url
      return absolute.replace('https://www.myselfmonart.com', '')
    } catch {
      return url
    }
  }
}
