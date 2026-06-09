import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
import {
  COLOR_PATTERN_DICTIONARY,
  lookupColorPattern,
} from 'App/Services/Shopify/Translator/colorPatternDictionary'
import { ACTIVE_LOCALES } from 'App/Services/i18n'
import type { MetaobjectToTranslate } from 'Types/Metaobject'

/**
 * One-off / idempotent backfill: force-register the canonical de/es/nl translations for the
 * COMPOUND color-pattern filter values (see colorPatternDictionary.ts). These metaobjects
 * carry a French "echo" translation (ChatGPT returned the source unchanged), so Shopify
 * reports them as not-outdated and the nightly TranslateMetaobjects cron skips them forever.
 * translationsRegister overwrites, so re-running is safe.
 *
 *   node ace shopify:fix_filter_colors --dry-run   # list color labels + targets, write nothing
 *   node ace shopify:fix_filter_colors             # overwrite es/de/nl for dictionary colors
 */
export default class ShopifyFixFilterColors extends BaseCommand {
  public static commandName = 'shopify:fix_filter_colors'
  public static description =
    'Force-register canonical es/de/nl translations for compound color-pattern filter values (overwrites the ChatGPT echo the cron cannot fix)'

  public static settings = { loadApp: true, stayAlive: false }

  @flags.boolean({ description: 'List color labels and targets without writing anything' })
  public dryRun: boolean

  public async run() {
    const shopify = new Shopify()
    const metaobjects = await shopify.metaobject.getAll('shopify--color-pattern')
    this.logger.info(`Fetched ${metaobjects.length} shopify--color-pattern metaobjects`)

    const targets: { id: string; label: string }[] = []
    for (const m of metaobjects) {
      const label = (m.fields?.find((f) => f.key === 'label')?.value ?? '').trim()
      if (!label) continue
      if (COLOR_PATTERN_DICTIONARY[label]) {
        targets.push({ id: m.id, label })
      } else if (/[/&]/.test(label) || /multicolor/i.test(label)) {
        this.logger.warning(`Compound color NOT in dictionary (stays echo): "${label}"`)
      }
    }

    this.logger.info(
      `${targets.length} dictionary-managed colors: ${targets.map((t) => t.label).join(', ') || '(none)'}`
    )

    if (this.dryRun) {
      this.logger.info('Dry run — nothing written.')
      return
    }

    const locales = ACTIVE_LOCALES.filter((l) => l !== 'en')
    let ok = 0
    let fail = 0
    for (const t of targets) {
      for (const locale of locales) {
        const value = lookupColorPattern(t.label, locale)
        if (!value) continue
        const resourceToTranslate = {
          id: t.id,
          type: 'shopify--color-pattern',
          field: { key: 'label', jsonValue: t.label },
        } as unknown as MetaobjectToTranslate
        const resourceTranslated = {
          id: t.id,
          type: 'shopify--color-pattern',
          field: { key: 'label', jsonValue: value },
        } as unknown as MetaobjectToTranslate
        try {
          const responses = await shopify
            .translator('metaobject')
            .updateTranslation({ resourceToTranslate, resourceTranslated, isoCode: locale })
          const errs = responses.flatMap((r) => r.translationsRegister.userErrors)
          if (errs.length) {
            this.logger.error(`[${locale}] "${t.label}" → "${value}": ${errs.map((e) => e.message).join('; ')}`)
            fail++
          } else {
            this.logger.success(`[${locale}] "${t.label}" → "${value}"`)
            ok++
          }
        } catch (error) {
          this.logger.error(`[${locale}] "${t.label}": ${error?.message ?? error}`)
          fail++
        }
      }
    }
    this.logger.info(`Done. ${ok} registered, ${fail} failed.`)
  }
}
