import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import LinkLocalizer from 'App/Services/LinkLocalizer'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'

/**
 * One-shot backfill: re-localizes the links inside the ALREADY-registered English
 * `body_html` translations of every published collection. The nightly translation
 * task only revisits a collection when Shopify flags it outdated, so existing English
 * descriptions whose links still point at French pages would never be corrected on
 * their own — this command fixes them in place.
 *
 * Dry-run by default; pass --execute to actually register the corrected translations.
 */
export default class BackfillCollectionLinks extends BaseCommand {
  public static commandName = 'backfill:collection-links'
  public static description = 'Re-localize links in existing EN collection descriptions'
  public static settings = { loadApp: true, stayAlive: false }

  @flags.boolean({ description: 'Actually write the corrected translations to Shopify' })
  public execute: boolean

  public async run() {
    logTaskBoundary(true, 'Backfill collection links')
    const dry = !this.execute
    console.info(dry ? '🟡 DRY RUN (no writes). Pass --execute to apply.\n' : '🔴 EXECUTE MODE — writing to Shopify.\n')

    const shopify = new Shopify()
    const auth: any = (shopify.translator('collection') as any).resourceHandler.pullDataModeler
    const localizer = new LinkLocalizer('en')

    const collections = await this.fetchPublishedCollections(auth)
    console.info(`Scanning ${collections.length} published collections...\n`)

    let changed = 0
    let written = 0

    for (const col of collections) {
      const tr = await auth.fetchGraphQL(
        `query($id: ID!) {
          translatableResource(resourceId: $id) {
            translatableContent { key value digest }
            translations(locale: "en") { key value outdated }
          }
        }`,
        { id: col.id }
      )
      const content = tr.translatableResource?.translatableContent || []
      const translations = tr.translatableResource?.translations || []
      const src = content.find((c: any) => c.key === 'body_html')
      const enBody = translations.find((t: any) => t.key === 'body_html')
      if (!src?.digest || !enBody?.value) continue

      // Don't touch a genuinely-outdated translation: re-registering against the
      // current source digest would clear its `outdated` flag and freeze stale prose
      // that the nightly translator would otherwise re-translate. Leave it for them.
      if (enBody.outdated) {
        console.info(`⏭️  ${col.title} (${col.handle}) — body_html outdated; left for the nightly translator`)
        continue
      }

      const localized = await localizer.localizeHtml(enBody.value)
      if (localized === enBody.value) continue

      changed++
      const diffs = this.diffLinks(enBody.value, localized)
      console.info(`▸ ${col.title} (${col.handle}) — ${diffs.length} link(s) rewritten`)
      diffs.forEach((d) => console.info(`    ${d.from}\n      -> ${d.to}`))

      if (!dry) {
        const res = await auth.fetchGraphQL(
          `mutation($resourceId: ID!, $translations: [TranslationInput!]!) {
            translationsRegister(resourceId: $resourceId, translations: $translations) {
              userErrors { field message }
            }
          }`,
          {
            resourceId: col.id,
            translations: [
              {
                key: 'body_html',
                locale: 'en',
                translatableContentDigest: src.digest,
                value: localized,
              },
            ],
          }
        )
        const errs = res.translationsRegister?.userErrors || []
        if (errs.length) {
          console.error(`   🚨 ${JSON.stringify(errs)}`)
        } else {
          written++
          console.info('   ✅ registered')
        }
      }
      console.info('')
    }

    console.info(`\n===== Summary =====`)
    console.info(`  collections with links to fix: ${changed}`)
    console.info(dry ? `  (dry run — nothing written)` : `  written: ${written}`)
    logTaskBoundary(false, 'Backfill collection links')
  }

  private diffLinks(before: string, after: string) {
    const re = /\bhref\s*=\s*"([^"]*)"/gi
    const b = [...before.matchAll(re)].map((m) => m[1])
    const a = [...after.matchAll(re)].map((m) => m[1])
    const diffs: { from: string; to: string }[] = []
    for (let i = 0; i < Math.min(b.length, a.length); i++) {
      if (b[i] !== a[i]) diffs.push({ from: b[i], to: a[i] })
    }
    return diffs
  }

  private async fetchPublishedCollections(auth: any) {
    const out: any[] = []
    let cursor: string | null = null
    let hasNext = true
    while (hasNext) {
      const data = await auth.fetchGraphQL(
        `query($cursor: String) {
          collections(first: 50, after: $cursor, query: "published_status:published") {
            edges { cursor node { id title handle } }
            pageInfo { hasNextPage }
          }
        }`,
        { cursor }
      )
      const edges = data.collections.edges
      for (const e of edges) out.push(e.node)
      hasNext = data.collections.pageInfo.hasNextPage
      if (hasNext && edges.length) cursor = edges[edges.length - 1].cursor
      else hasNext = false
    }
    return out
  }
}
