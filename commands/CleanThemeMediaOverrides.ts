import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
import type { LanguageCode } from 'Types/Translation'

/**
 * One-off remediation: remove stale theme section-setting media (SVG) overrides so the
 * translated storefront inherits the source artwork. Shares the exact code path used by
 * the daily TranslateStaticSection cron (getStaleThemeMediaOverrides + removeTranslations).
 *
 * Defaults to a dry run. Pass --apply to actually remove.
 */
export default class CleanThemeMediaOverrides extends BaseCommand {
  public static commandName = 'clean:theme_media_overrides'
  public static description = 'Remove stale theme SVG/media translation overrides'

  @flags.string({ description: 'Comma-separated locales (default en,es,de,nl)' })
  public locales: string

  @flags.string({ description: 'Only act on keys whose resourceId contains this substring' })
  public filter: string

  @flags.boolean({ description: 'Actually remove overrides (otherwise dry run)' })
  public apply: boolean

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const locales = (this.locales || 'en,es,de,nl')
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean) as LanguageCode[]

    const shopify = new Shopify()
    console.info(`Mode: ${this.apply ? '✅ APPLY (removing)' : '🔍 DRY RUN'}`)
    console.info(`Locales: ${locales.join(', ')}`)
    if (this.filter) console.info(`Filter: resourceId contains "${this.filter}"`)
    console.info('')

    for (const locale of locales) {
      let overrides = await shopify.translator('static_section').getStaleThemeMediaOverrides(locale)
      if (this.filter) {
        overrides = overrides.filter((o) => o.resourceId.includes(this.filter))
      }

      console.info(`=== [${locale}] ${overrides.length} stale media override(s) ===`)
      const byResource = new Map<string, string[]>()
      for (const { resourceId, key } of overrides) {
        const keys = byResource.get(resourceId) ?? []
        keys.push(key)
        byResource.set(resourceId, keys)
      }
      for (const [resourceId, keys] of byResource) {
        console.info(`  ${resourceId}  (${keys.length} key(s))`)
      }

      if (!this.apply || overrides.length === 0) {
        console.info('')
        continue
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
          console.error(`  🚨 ${resourceId} =>`, userErrors)
        } else {
          removed += translationKeys.length
        }
      }
      console.info(`  ✅ removed ${removed} override(s)\n`)
    }
  }
}
