import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import { promises as fs } from 'fs'
import { join } from 'path'
import Shopify from 'App/Services/Shopify'
import LinkLocalizer from 'App/Services/LinkLocalizer'
import type { LanguageCode } from 'Types/Translation'

/**
 * One-off i18n backfill for the "cocon poster" chantier. Fills the two gaps the standard
 * translation automation does NOT cover:
 *
 *   1. THEME CONTENT in JSON templates (OnlineStoreThemeJsonTemplate) — the homepage
 *      `posters_home` section, the two new FAQ entries, and the tableau-salon carousel
 *      label. The nightly TranslateStaticSection only pulls SettingsDataSections, never
 *      JSON templates, so these strings would stay French forever on en/es/de/nl.
 *      (The mega-menu "Posters & Affiches" tab lives in SettingsDataSections and is also
 *      backfilled here so the whole poster chrome ships in one pass.)
 *
 *   2. custom.cocon_links metafield (JSON [{url,label}]) on the poster + tableau
 *      collections — no translator models it, so both the labels (French) and the URLs
 *      (French handle, no locale prefix) render untranslated on the localized storefronts.
 *
 * Claude-as-translator transport, mirroring translate:manual: `dump` writes the source
 * strings needing translation; a human/Claude fills tmp/cocon-poster/translations.<locale>.json;
 * `apply <locale>` registers them via translationsRegister. Idempotent: the fetched source
 * digest is used, and any value === source is skipped (Shopify rejects those anyway).
 *
 *   node ace i18n:cocon-poster dump
 *   node ace i18n:cocon-poster apply en --dry-run
 *   node ace i18n:cocon-poster apply en
 */

const STORE_HOST = 'https://www.myselfmonart.com'
const MEGA_MENU_VALUES = new Set(['Posters & Affiches', 'Par Pièce', 'Par Thème', 'Par Couleur'])

type ThemeItem = { resourceId: string; key: string; value: string; digest: string }
type CoconItem = { handle: string; resourceId: string; key: 'value'; value: string; digest: string }
type Source = { theme: ThemeItem[]; cocon: CoconItem[] }

export default class TranslateCoconPoster extends BaseCommand {
  public static commandName = 'i18n:cocon-poster'
  public static description =
    'Backfill translations for the cocon-poster theme JSON templates + cocon_links metafields.'

  @args.string({ description: 'dump | apply' })
  public action: string

  @args.string({ description: 'locale for apply: en|es|de|nl', required: false })
  public locale: string

  @flags.boolean({ description: 'Preview registrations without writing to Shopify' })
  public dryRun: boolean

  @flags.string({ description: 'Restrict apply to one phase: theme | cocon' })
  public only: string

  public static settings = { loadApp: true, stayAlive: false }

  private dir = 'tmp/cocon-poster'
  private _fetch: ((q: string, v?: Record<string, any>, cost?: number) => Promise<any>) | null =
    null

  /** Rate-limited, retrying Shopify GraphQL transport (borrowed from a translator's pull modeler). */
  private gql(query: string, variables: Record<string, any> = {}, cost = 50): Promise<any> {
    if (!this._fetch) {
      const handler: any = (new Shopify().translator('collection') as any).resourceHandler
      const modeler = handler.pullDataModeler
      this._fetch = modeler.fetchGraphQL.bind(modeler)
    }
    return this._fetch!(query, variables, cost)
  }

  public async run() {
    await fs.mkdir(this.dir, { recursive: true })
    if (this.action === 'dump') return this.dump()
    if (this.action === 'apply') return this.apply()
    this.logger.error(`Unknown action "${this.action}". Use: dump | apply`)
  }

  // ---------------------------------------------------------------------------
  // DUMP
  // ---------------------------------------------------------------------------
  private async dump() {
    const theme = [...(await this.dumpJsonTemplates()), ...(await this.dumpMegaMenu())]
    const cocon = await this.dumpCocon()
    const source: Source = { theme, cocon }
    const file = join(this.dir, 'source.json')
    await fs.writeFile(file, JSON.stringify(source, null, 2))
    this.logger.info(`✅ DUMP → ${file}`)
    this.logger.info(`   theme JSON/section strings: ${theme.length}`)
    this.logger.info(`   cocon_links collections:    ${cocon.length}`)

    // Emit the unique source strings to translate, so the translator file is easy to fill.
    const uniqThemeValues = [...new Set(theme.map((t) => t.value))]
    const uniqLabels = [
      ...new Set(cocon.flatMap((c) => this.parseLinks(c.value).map((l) => l.label))),
    ]
    await fs.writeFile(
      join(this.dir, 'strings.json'),
      JSON.stringify({ themeValues: uniqThemeValues, coconLabels: uniqLabels }, null, 2)
    )
    this.logger.info(
      `   unique theme strings: ${uniqThemeValues.length} · unique cocon labels: ${uniqLabels.length} → ${join(this.dir, 'strings.json')}`
    )
  }

  private async getMainThemeId(): Promise<string> {
    const d = await this.gql(`query { themes(first:1, roles:[MAIN]) { nodes { id } } }`)
    return d.themes.nodes[0].id.split('/').at(-1)
  }

  /** Homepage posters_home + the two new FAQ entries + the tableau-salon carousel label. */
  private async dumpJsonTemplates(): Promise<ThemeItem[]> {
    const out: ThemeItem[] = []
    let cursor: string | null = null
    let hasNext = true
    while (hasNext) {
      const d = await this.gql(
        `query($cursor:String){
          translatableResources(first:25, resourceType: ONLINE_STORE_THEME_JSON_TEMPLATE, after:$cursor){
            edges { cursor node { resourceId translatableContent { key value digest } } }
            pageInfo { hasNextPage }
          }
        }`,
        { cursor }
      )
      for (const e of d.translatableResources.edges) {
        const rid: string = e.node.resourceId
        const isIndex = /\/index\?/.test(rid)
        const isSalon = /tableau-salon/.test(rid)
        if (!isIndex && !isSalon) continue
        for (const c of e.node.translatableContent) {
          if (typeof c.value !== 'string' || !c.value.trim()) continue
          if (c.value.trim().toLowerCase().startsWith('shopify://')) continue
          const inScope = isIndex
            ? /\.posters_home\./.test(c.key) ||
              /\.faq\.faq_format\./.test(c.key) ||
              /\.faq\.faq_bascule\./.test(c.key)
            : /related_carousel\.hub_label/.test(c.key)
          if (!inScope) continue
          out.push({ resourceId: rid, key: c.key, value: c.value, digest: c.digest })
        }
      }
      hasNext = d.translatableResources.pageInfo.hasNextPage
      cursor = d.translatableResources.edges.length
        ? d.translatableResources.edges.at(-1).cursor
        : null
      if (!cursor) hasNext = false
    }
    return out
  }

  /** The 4 new "Posters & Affiches" mega-menu labels (SettingsDataSections, still untranslated). */
  private async dumpMegaMenu(): Promise<ThemeItem[]> {
    const themeId = await this.getMainThemeId()
    const rid = `gid://shopify/OnlineStoreThemeSettingsDataSections/${themeId}`
    const d = await this.gql(
      `query($ids:[ID!]!){
        translatableResourcesByIds(first:1, resourceIds:$ids){
          edges { node {
            resourceId
            translatableContent { key value digest }
            translations(locale:"en") { key outdated }
          } }
        }
      }`,
      { ids: [rid] }
    )
    const node = d.translatableResourcesByIds.edges[0]?.node
    if (!node) return []
    const enByKey = new Map<string, any>(node.translations.map((t: any) => [t.key, t]))
    const out: ThemeItem[] = []
    for (const c of node.translatableContent) {
      if (!MEGA_MENU_VALUES.has(c.value)) continue
      if (!/tw-header/.test(c.key)) continue
      const en = enByKey.get(c.key)
      // Only the NEW poster tab labels lack an EN translation; the "Nos Tableaux" tab
      // (same words, different keys) already has one and is left untouched.
      if (en && !en.outdated) continue
      out.push({ resourceId: node.resourceId, key: c.key, value: c.value, digest: c.digest })
    }
    return out
  }

  /** cocon_links metafields on every poster + tableau collection that has one. */
  private async dumpCocon(): Promise<CoconItem[]> {
    const cols: { handle: string; metafieldId: string; value: string }[] = []
    let cursor: string | null = null
    let hasNext = true
    while (hasNext) {
      const d = await this.gql(
        `query($cursor:String){
          collections(first:100, after:$cursor){
            edges { cursor node { handle metafield(namespace:"custom", key:"cocon_links"){ id value } } }
            pageInfo { hasNextPage }
          }
        }`,
        { cursor }
      )
      for (const e of d.collections.edges) {
        const h: string = e.node.handle
        const mf = e.node.metafield
        if (!mf?.value) continue
        if (!(/^posters-affiches|^affiches-poster|poster/.test(h) || /^tableau/.test(h))) continue
        cols.push({ handle: h, metafieldId: mf.id, value: mf.value })
      }
      hasNext = d.collections.pageInfo.hasNextPage
      cursor = d.collections.edges.length ? d.collections.edges.at(-1).cursor : null
      if (!cursor) hasNext = false
    }

    // Bulk-fetch the authoritative source digests for the metafield resources.
    const digestById = new Map<string, string>()
    for (let i = 0; i < cols.length; i += 100) {
      const ids = cols.slice(i, i + 100).map((c) => c.metafieldId)
      const d = await this.gql(
        `query($ids:[ID!]!){ translatableResourcesByIds(first:100, resourceIds:$ids){
          edges { node { resourceId translatableContent { key digest } } } } }`,
        { ids }
      )
      for (const e of d.translatableResourcesByIds.edges) {
        const val = e.node.translatableContent.find((c: any) => c.key === 'value')
        if (val?.digest) digestById.set(e.node.resourceId, val.digest)
      }
    }

    const out: CoconItem[] = []
    for (const c of cols) {
      const digest = digestById.get(c.metafieldId)
      if (!digest) {
        this.logger.warning(`⚠️  no digest for cocon_links on ${c.handle} — skipped`)
        continue
      }
      out.push({
        handle: c.handle,
        resourceId: c.metafieldId,
        key: 'value',
        value: c.value,
        digest,
      })
    }
    return out
  }

  // ---------------------------------------------------------------------------
  // APPLY
  // ---------------------------------------------------------------------------
  private async apply() {
    const locale = this.locale as LanguageCode
    if (!['en', 'es', 'de', 'nl'].includes(locale)) {
      this.logger.error(`apply needs a locale: en|es|de|nl (got "${this.locale}")`)
      return
    }
    const source: Source = JSON.parse(await fs.readFile(join(this.dir, 'source.json'), 'utf8'))
    const trans = JSON.parse(
      await fs.readFile(join(this.dir, `translations.${locale}.json`), 'utf8')
    ) as { theme: Record<string, string>; labels: Record<string, string> }

    this.logger.info(
      this.dryRun ? `🟡 DRY RUN — apply ${locale} (no writes)` : `🔴 APPLY ${locale} — writing`
    )

    if (this.only !== 'cocon') await this.applyTheme(source, trans.theme, locale)
    if (this.only !== 'theme') await this.applyCocon(source, trans.labels, locale)
  }

  private async applyTheme(source: Source, map: Record<string, string>, locale: LanguageCode) {
    // Group translations by resource so each resource registers in one mutation.
    const byResource = new Map<string, { key: string; value: string; digest: string }[]>()
    let missing = 0
    let echoed = 0
    for (const item of source.theme) {
      const translated = map[item.value]
      if (translated == null || translated === '') {
        missing++
        this.logger.warning(`  ✎ missing theme translation: "${item.value.slice(0, 60)}"`)
        continue
      }
      if (translated === item.value) {
        echoed++
        continue
      }
      const list = byResource.get(item.resourceId) ?? []
      list.push({ key: item.key, value: translated, digest: item.digest })
      byResource.set(item.resourceId, list)
    }

    let ok = 0
    let failed = 0
    for (const [resourceId, entries] of byResource) {
      const translations = entries.map((e) => ({
        key: e.key,
        locale,
        translatableContentDigest: e.digest,
        value: e.value,
      }))
      if (this.dryRun) {
        this.logger.info(`  [dry] ${resourceId} ← ${translations.length} theme key(s)`)
        ok += translations.length
        continue
      }
      const errs = await this.register(resourceId, translations)
      if (errs.length) {
        failed += translations.length
        this.logger.error(`  🚨 ${resourceId}: ${JSON.stringify(errs)}`)
      } else {
        ok += translations.length
      }
    }
    this.logger.info(
      `  THEME[${locale}] registered=${ok} failed=${failed} skipped(echo)=${echoed} missing=${missing}`
    )
  }

  private async applyCocon(source: Source, labels: Record<string, string>, locale: LanguageCode) {
    const ll = new LinkLocalizer(locale)
    let ok = 0
    let failed = 0
    let unchanged = 0
    const missingLabels = new Set<string>()

    for (const item of source.cocon) {
      const links = this.parseLinks(item.value)
      if (!links.length) continue
      const next: { url: string; label: string }[] = []
      for (const link of links) {
        const label = labels[link.label]
        if (label == null || label === '') missingLabels.add(link.label)
        next.push({ url: await this.localizeRel(ll, link.url), label: label || link.label })
      }
      const value = JSON.stringify(next)
      if (value === item.value) {
        unchanged++
        continue
      }
      if (this.dryRun) {
        ok++
        if (ok <= 3) this.logger.info(`  [dry] ${item.handle} ←\n     ${value}`)
        continue
      }
      const errs = await this.register(item.resourceId, [
        { key: 'value', locale, translatableContentDigest: item.digest, value },
      ])
      if (errs.length) {
        failed++
        this.logger.error(`  🚨 ${item.handle}: ${JSON.stringify(errs)}`)
      } else {
        ok++
      }
    }
    if (missingLabels.size) {
      this.logger.warning(
        `  ✎ ${missingLabels.size} cocon label(s) had no translation (kept source): ` +
          [...missingLabels].slice(0, 8).join(' | ')
      )
    }
    this.logger.info(`  COCON[${locale}] registered=${ok} failed=${failed} unchanged=${unchanged}`)
  }

  /** Localizes a cocon link URL to `/{locale}/…{translated-handle}`, relative. Keeps source if unresolved. */
  private async localizeRel(ll: LinkLocalizer, url: string): Promise<string> {
    try {
      const abs = await ll.localizeUrl(url)
      if (!abs) return url
      return abs.startsWith(STORE_HOST) ? abs.slice(STORE_HOST.length) : abs
    } catch {
      return url
    }
  }

  private parseLinks(value: string): { url: string; label: string }[] {
    try {
      const arr = JSON.parse(value)
      return Array.isArray(arr)
        ? arr.filter((l) => l && typeof l === 'object' && typeof l.label === 'string')
        : []
    } catch {
      return []
    }
  }

  private async register(
    resourceId: string,
    translations: {
      key: string
      locale: string
      translatableContentDigest: string
      value: string
    }[]
  ): Promise<any[]> {
    const d = await this.gql(
      `mutation($resourceId:ID!, $translations:[TranslationInput!]!){
        translationsRegister(resourceId:$resourceId, translations:$translations){
          userErrors { field message }
        }
      }`,
      { resourceId, translations }
    )
    return d?.translationsRegister?.userErrors ?? []
  }
}
