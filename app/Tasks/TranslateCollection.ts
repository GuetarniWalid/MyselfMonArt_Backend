import type { CollectionToTranslate } from 'Types/Collection'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import LinkLocalizer from 'App/Services/LinkLocalizer'
import Shopify from 'App/Services/Shopify'
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

    const shopify = new Shopify()
    const collectionsToTranslate = await shopify.translator('collection').getOutdatedTranslations()
    console.log('🚀 ~ collections to translate length:', collectionsToTranslate.length)
    const chatGPT = new ChatGPT()
    const linkLocalizer = new LinkLocalizer('en')

    for (const collection of collectionsToTranslate) {
      console.log('============================')
      console.log('Id collection to translate => ', collection.id)
      const collectionTranslated = (await chatGPT.translate(
        collection,
        'collection',
        'en'
      )) as Partial<CollectionToTranslate>

      // Rewrite any in-description links so they point at the English equivalent page
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

      const responses = await shopify.translator('collection').updateTranslation({
        resourceToTranslate: collection,
        resourceTranslated: collectionTranslated,
        isoCode: 'en',
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
    console.log('✅ Collections translations updated')

    logTaskBoundary(false, 'Translate collection')
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
}
