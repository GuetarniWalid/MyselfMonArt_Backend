import type { LanguageCode } from 'Types/Translation'
import type { StaticSectionToTranslate } from 'Types/StaticSection'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class TranslateStaticSection extends BaseTask {
  // Theme locales whose stale media overrides we keep in sync. The default locale
  // (French) is the source and is never overridden.
  private static readonly MEDIA_CLEANUP_LOCALES: LanguageCode[] = ['en', 'es', 'de', 'nl']

  public static get schedule() {
    return CronTimeV2.everyDayAt(4, 30)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate Static Sections')

    const shopify = new Shopify()
    const contentToTranslate = (await shopify
      .translator('static_section')
      .getOutdatedTranslations()) as StaticSectionToTranslate[]

    console.log('🚀 ~ static sections to translate length:', contentToTranslate.length)
    const chatGPT = new ChatGPT()

    let failures = 0
    for (const content of contentToTranslate) {
      try {
        console.log('============================')
        console.log(`🚀 ~ Translating static section key="${content.key}"`)
        const themeTranslated = await chatGPT.translate(content, 'static_section', 'en')
        const responses = await shopify.translator('static_section').updateTranslation({
          resourceToTranslate: content,
          resourceTranslated: themeTranslated,
          isoCode: 'en',
        })
        for (const response of responses) {
          if (response.translationsRegister.userErrors.length > 0) {
            console.log('🚨 Error => ', response.translationsRegister.userErrors)
          } else {
            console.log('✅ Translation updated')
          }
        }
      } catch (error) {
        failures++
        const message = (error as Error)?.message ?? String(error)
        console.error(
          `🚨 Skipping static section key="${content.key}" — translation failed: ${message}`
        )
      }
    }

    console.log('============================')
    if (failures > 0) {
      console.log(
        `⚠️  Static Sections translations finished with ${failures} skipped item(s) on ${contentToTranslate.length} total`
      )
    } else {
      console.log('✅ Static Sections translations updated')
    }

    await this.cleanStaleMediaOverrides(shopify)

    logTaskBoundary(false, 'Translate Static Sections')
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
