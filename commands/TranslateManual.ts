import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import { promises as fs } from 'fs'
import { join } from 'path'
import Shopify from 'App/Services/Shopify'
import LinkLocalizer from 'App/Services/LinkLocalizer'
import type { LanguageCode, RegionCode } from 'Types/Translation'
import type { Resource } from 'Types/Resource'

/**
 * Claude-as-translator transport. Lets the translation work be done by Claude (covered by the
 * subscription) instead of the paid ChatGPT crons, while reusing the backend's tested
 * pull (source fields + digests) and push (translationsRegister) paths.
 *
 *   1. node ace translate:manual dump <resource> <locale>     # read-only: writes the source fields needing translation
 *   2. (Claude reads tmp/translate/<tag>.source.json, writes tmp/translate/<tag>.translated.json)
 *   3. node ace translate:manual apply <resource> <locale>    # writes the translations to Shopify
 *
 * The translated file mirrors the source shape exactly (same ids/keys), with translatable
 * string values replaced. updateTranslation computes the digest from the SOURCE value and
 * skips any value === source, so it is safe to re-run.
 */
export default class TranslateManual extends BaseCommand {
  public static commandName = 'translate:manual'
  public static description =
    'Dump source fields needing translation, or apply Claude-provided translations to Shopify (no GPT cost).'

  @args.string({ description: 'dump | apply' })
  public action: string

  @args.string({ description: 'resource: product|collection|page|blog|article|model' })
  public resource: string

  @args.string({ description: 'locale: de|es|en' })
  public locale: string

  @flags.string({ description: 'Override source/translated file directory tag' })
  public tag: string

  @flags.string({ description: 'Region code (e.g. UK)' })
  public region: string

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  private dir = 'tmp/translate'

  public async run() {
    const resource = this.resource
    const locale = this.locale as LanguageCode
    const region = (this.region as RegionCode) || undefined
    const tag = this.tag || `${this.resource}-${this.locale}${region ? `-${region}` : ''}`
    await fs.mkdir(this.dir, { recursive: true })
    const sourceFile = join(this.dir, `${tag}.source.json`)
    const translatedFile = join(this.dir, `${tag}.translated.json`)

    if (this.action === 'dump') {
      await this.dump(resource, locale, region, sourceFile, tag)
      return
    }
    if (this.action === 'apply') {
      await this.apply(resource, locale, region, sourceFile, translatedFile, tag)
      return
    }
    console.error(`❌ Unknown action "${this.action}". Use: dump | apply`)
  }

  private async dump(
    resource: string,
    locale: LanguageCode,
    region: RegionCode | undefined,
    sourceFile: string,
    tag: string
  ) {
    const shopify = new Shopify()
    console.info(`📥 Pulling outdated/missing translations for ${tag} ...`)
    // theme_locale = OnlineStoreThemeLocaleContent (t: UI strings); theme_settings =
    // OnlineStoreThemeSettingsDataSections (per-section setting overrides). Both push via
    // the static_section handler but pull through different methods.
    const items = (
      resource === 'theme_locale'
        ? await shopify.translator('static_section').getOutdatedThemeLocaleContent(locale, region)
        : await shopify
            .translator(resource === 'theme_settings' ? 'static_section' : (resource as Resource))
            .getOutdatedTranslations(locale, region)
    ) as any[]
    await fs.writeFile(
      sourceFile,
      JSON.stringify({ resource, locale, region: region || null, items }, null, 2)
    )
    console.info(`✅ DUMP ${tag}: ${items.length} item(s) → ${sourceFile}`)
    const preview = items.slice(0, 3).map((it) => ({
      id: it.id,
      fields: Object.keys(it).filter((k) => k !== 'id'),
    }))
    console.info(JSON.stringify(preview, null, 2))
  }

  private async apply(
    resource: string,
    locale: LanguageCode,
    region: RegionCode | undefined,
    sourceFile: string,
    translatedFile: string,
    tag: string
  ) {
    const shopify = new Shopify()
    const pushResource = (
      resource === 'theme_locale' || resource === 'theme_settings' ? 'static_section' : resource
    ) as Resource
    const source = JSON.parse(await fs.readFile(sourceFile, 'utf8'))
    const translated = JSON.parse(await fs.readFile(translatedFile, 'utf8'))
    // Most resources are keyed by id; the `model` resource shares ONE theme gid across all
    // items, so match by `key` when present.
    const matchKey = (x: any) => (x && x.key != null ? x.key : x.id)
    const transByKey = new Map<string, any>()
    for (const t of translated.items) transByKey.set(matchKey(t), t)

    const linkLocalizer = pushResource === 'collection' ? new LinkLocalizer(locale) : null

    const results = { total: 0, ok: 0, failed: 0, skipped: 0, errors: [] as string[] }
    for (const src of source.items) {
      const tr = transByKey.get(matchKey(src))
      if (!tr) {
        results.skipped++
        console.warn(`⏭️  No translation provided for ${src.id}`)
        continue
      }
      results.total++
      try {
        if (linkLocalizer) await this.localizeCollectionLinks(tr, linkLocalizer)
        const responses = await shopify.translator(pushResource).updateTranslation({
          resourceToTranslate: src,
          resourceTranslated: tr,
          isoCode: locale,
          region,
        })
        let hasErr = false
        for (const r of responses) {
          const ue = r.translationsRegister.userErrors
          if (ue.length) {
            hasErr = true
            ue.forEach((e: any) => console.error(`❌ ${src.id}: ${e.message}`))
          }
        }
        if (hasErr) {
          results.failed++
          results.errors.push(src.id)
        } else {
          results.ok++
          console.info(`✅ ${src.id}`)
        }
      } catch (e: any) {
        results.failed++
        results.errors.push(src.id)
        console.error(`❌ ${src.id}: ${e.message}`)
      }
    }
    console.info(
      `\n📊 APPLY ${tag}: total=${results.total} ok=${results.ok} failed=${results.failed} no-translation=${results.skipped}`
    )
    if (results.errors.length) console.error(`Failed ids: ${results.errors.join(', ')}`)
  }

  private async localizeCollectionLinks(tr: any, ll: LinkLocalizer) {
    if (tr.descriptionHtml) tr.descriptionHtml = await ll.localizeHtml(tr.descriptionHtml)
    if (tr.intro?.value) tr.intro.value = await ll.localizeHtml(tr.intro.value)
    if (tr.guide?.value) tr.guide.value = await ll.localizeHtml(tr.guide.value)
    if (tr.faq?.value) tr.faq.value = await this.localizeFaqLinks(tr.faq.value, ll)
  }

  private async localizeFaqLinks(faqValue: string, ll: LinkLocalizer) {
    try {
      const items = JSON.parse(faqValue)
      if (!Array.isArray(items)) return faqValue
      const out = [] as any[]
      for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          out.push(item)
          continue
        }
        const next = { ...item }
        if (typeof item.a === 'string') next.a = await ll.localizeHtml(item.a)
        out.push(next)
      }
      return JSON.stringify(out)
    } catch {
      return faqValue
    }
  }
}
