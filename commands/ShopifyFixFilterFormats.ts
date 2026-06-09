import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
import { FORMAT_DICTIONARY, lookupFormat } from 'App/Services/Shopify/Translator/formatDictionary'
import { ACTIVE_LOCALES } from 'App/Services/i18n'
import type { MetaobjectToTranslate } from 'Types/Metaobject'

/**
 * One-off / idempotent backfill: force-register the canonical de/es/nl translations for the
 * FORMAT (orientation) filter values — the `etiquette` field of the `format` metaobjects
 * (filter.p.m.painting.layout). These were never in the metaobject translator allow-list so
 * they stayed (partly) French on es/nl/de. translationsRegister overwrites; safe to re-run.
 *
 *   node ace shopify:fix_filter_formats --dry-run   # list format labels + targets
 *   node ace shopify:fix_filter_formats             # overwrite es/de/nl for dictionary formats
 */
export default class ShopifyFixFilterFormats extends BaseCommand {
  public static commandName = 'shopify:fix_filter_formats'
  public static description =
    'Force-register canonical es/de/nl translations for the format/orientation filter values (Carré/Paysage/Portrait)'

  public static settings = { loadApp: true, stayAlive: false }

  @flags.boolean({ description: 'List format labels and targets without writing anything' })
  public dryRun: boolean

  public async run() {
    const shopify = new Shopify()
    const metaobjects = await shopify.metaobject.getAll('format')
    this.logger.info(`Fetched ${metaobjects.length} format metaobjects`)

    const targets: { id: string; label: string }[] = []
    for (const m of metaobjects) {
      const label = (m.fields?.find((f) => f.key === 'etiquette')?.value ?? '').trim()
      if (!label) continue
      if (FORMAT_DICTIONARY[label]) {
        targets.push({ id: m.id, label })
      } else {
        this.logger.warning(`Format etiquette NOT in dictionary (stays as-is): "${label}"`)
      }
    }

    this.logger.info(
      `${targets.length} dictionary-managed formats: ${targets.map((t) => t.label).join(', ') || '(none)'}`
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
        const value = lookupFormat(t.label, locale)
        if (!value) continue
        const resourceToTranslate = {
          id: t.id,
          type: 'format',
          field: { key: 'etiquette', jsonValue: t.label },
        } as unknown as MetaobjectToTranslate
        const resourceTranslated = {
          id: t.id,
          type: 'format',
          field: { key: 'etiquette', jsonValue: value },
        } as unknown as MetaobjectToTranslate
        try {
          const responses = await shopify
            .translator('metaobject')
            .updateTranslation({ resourceToTranslate, resourceTranslated, isoCode: locale })
          const errs = responses.flatMap((r) => r.translationsRegister.userErrors)
          const registered = responses.flatMap((r) => r.translationsRegister.translations ?? [])
          if (errs.length) {
            this.logger.error(`[${locale}] "${t.label}" → "${value}": ${errs.map((e) => e.message).join('; ')}`)
            fail++
          } else if (registered.length === 0) {
            this.logger.error(`[${locale}] "${t.label}" → "${value}": NO-OP (digest mismatch / value == source)`)
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
