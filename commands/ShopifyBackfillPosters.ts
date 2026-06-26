import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
import ProductPublisher from 'App/Services/Claude/ProductPublisher'

/**
 * Backfill: create ONE poster product per existing PAINTING.
 *
 * Strategy (decided with the owner):
 * - Images: REUSE the painting's media[0] (white-bg) + media[1] (artwork) verbatim — no
 *   generation (the theme shows the same gallery for every variant, so poster mockups would
 *   cost money for zero visual payoff).
 * - Text: AI-REGENERATE title/description/SEO/tags with productType='poster' (the painting's
 *   text says "tableau/toile" which is wrong for a poster). Fresh ProductPublisher per painting
 *   (its image-analysis cache is per-instance).
 * - Status: created ACTIVE + published on all channels (owner choice).
 *
 * This command is CREATION-ONLY and mirrors the publisher: it creates the product, sets
 * category (from the ratio model) + artwork.type='poster' + publishes. The products/create
 * WEBHOOK then enriches it (copies the poster model → 7 variants + painting_options.frames_poster);
 * RepairIncompleteArtworks heals anything the daily 1,000-variant cap defers. So `--limit` caps
 * how many posters are created per run (≈7 variants each → keep under the shared daily budget).
 *
 * Idempotent + resumable: writes `link.poster` (product_reference) on the painting right after
 * creation; a re-run skips any painting that already has it. Square paintings are skipped (no
 * square poster model by design).
 *
 *   node ace shopify:backfill_posters --dry-run
 *   node ace shopify:backfill_posters 10532980523355            # test one painting
 *   node ace shopify:backfill_posters --limit=100 --spacing=20
 */

interface PaintingNode {
  id: string
  title: string
  tags: string[]
  artworkTypeMetafield?: { value: string } | null
  media: { nodes: Array<{ image?: { width: number; height: number; url: string } | null }> }
  metafields: {
    edges: Array<{
      node: { namespace: string; key: string; value: string; reference?: { title?: string } | null }
    }>
  }
  collections: { nodes: Array<{ title: string }> }
}

export default class ShopifyBackfillPosters extends BaseCommand {
  public static commandName = 'shopify:backfill_posters'
  public static description =
    'Create one poster per painting (reuse image, AI-regenerated poster text); webhook enriches variants'

  public static settings = { loadApp: true, stayAlive: false }

  @args.spread({
    description: 'Optional painting IDs to process (test mode); default = all eligible paintings',
    required: false,
  })
  public productIds: string[]

  @flags.number({ description: 'Max posters to create this run (default 100)' })
  public limit: number

  @flags.number({ description: 'Seconds between paintings (default 20)' })
  public spacing: number

  @flags.boolean({ description: 'Classify only — no AI, no writes' })
  public dryRun: boolean

  private static readonly MODEL_TAGS = ['portrait model', 'paysage model', 'square model']

  public async run() {
    const shopify = new Shopify()
    const limit = this.limit ?? 100
    const spacingMs = (this.spacing ?? 20) * 1000

    this.logger.info('Loading all products…')
    const all = (await shopify.product.getAll(false)) as unknown as PaintingNode[]

    let paintings = all.filter(
      (p) =>
        p.artworkTypeMetafield?.value === 'painting' &&
        !(p.tags || []).some((t) => ShopifyBackfillPosters.MODEL_TAGS.includes(t))
    )
    if (this.productIds?.length) {
      const wanted = new Set(
        this.productIds.map((id) => (id.startsWith('gid://') ? id : `gid://shopify/Product/${id}`))
      )
      paintings = paintings.filter((p) => wanted.has(p.id))
    }
    this.logger.info(
      `${paintings.length} candidate painting(s); limit=${limit}, spacing=${spacingMs / 1000}s, dryRun=${!!this.dryRun}`
    )

    const c = { created: 0, existing: 0, square: 0, badMedia: 0, errors: 0 }
    const modelCache = new Map<string, any>()
    let allTags: string[] | null = null

    for (const painting of paintings) {
      if (c.created >= limit) {
        this.logger.info(`Reached --limit ${limit}; stopping (re-run tomorrow to continue).`)
        break
      }

      // Idempotency — already has a poster?
      const hasPoster = painting.metafields.edges.some(
        (e) => e.node.namespace === 'link' && e.node.key === 'poster' && e.node.value
      )
      if (hasPoster) {
        c.existing++
        continue
      }

      // Media: need media[0] and media[1] (artwork, with dimensions for ratio).
      const node0 = painting.media.nodes[0]?.image
      const node1 = painting.media.nodes[1]?.image
      if (!node0?.url || !node1?.url || !node1.width || !node1.height) {
        c.badMedia++
        this.logger.warning(`[${painting.id}] missing media[0]/[1] image — skip`)
        continue
      }

      // Square paintings get no poster (no square poster model by design).
      const ratio = node1.width / node1.height
      if (Math.abs(ratio - 1) < 0.01) {
        c.square++
        continue
      }

      if (this.dryRun) {
        c.created++
        this.logger.info(`[would create] ${painting.title}`)
        continue
      }

      try {
        if (!allTags) allTags = (await shopify.product.getTagsAndProductTypes()).tags
        await this.createPoster(shopify, painting, node0, node1, ratio, allTags, modelCache)
        c.created++
      } catch (error: any) {
        c.errors++
        this.logger.error(`[${painting.id}] ${error?.message ?? error}`)
      }

      if (c.created < limit) await new Promise((r) => setTimeout(r, spacingMs))
    }

    this.logger.info(
      `Done. Created:${c.created} | Skipped(existing):${c.existing} | Skipped(square):${c.square} | Skipped(bad-media):${c.badMedia} | Errors:${c.errors}`
    )
  }

  private async createPoster(
    shopify: Shopify,
    painting: PaintingNode,
    node0: { url: string },
    node1: { url: string },
    ratio: number,
    allTags: string[],
    modelCache: Map<string, any>
  ) {
    // Fresh AI instance per painting (its image-analysis cache is per-instance).
    const ai = new ProductPublisher()
    const artUrl = this.withWidth(node1.url, 1024)
    const collectionTitle =
      painting.collections.nodes[0]?.title ??
      painting.metafields.edges.find(
        (e) => e.node.namespace === 'link' && e.node.key === 'mother_collection'
      )?.node.reference?.title ??
      ''

    // AI: poster-appropriate text (productType='poster'). Description first (drives title/SEO).
    const descriptionHtml = await ai.generateHtmlDescription(artUrl, collectionTitle, 'poster')
    const [tags, alt, seo] = await Promise.all([
      ai.suggestTags(allTags, artUrl, collectionTitle, 'poster'),
      ai.generateAlt(artUrl, collectionTitle, 'poster'),
      ai.generateTitleAndSeo(descriptionHtml, collectionTitle, 'poster'),
    ])

    const motherCollection = painting.metafields.edges.find(
      (e) => e.node.namespace === 'link' && e.node.key === 'mother_collection'
    )?.node.value
    const metafields: Array<{ namespace: string; key: string; value: string; type: string }> = [
      { namespace: 'likes', key: 'number', value: '0', type: 'number_integer' },
      { namespace: 'title', key: 'short', value: seo.shortTitle, type: 'single_line_text_field' },
    ]
    if (motherCollection) {
      metafields.unshift({
        namespace: 'link',
        key: 'mother_collection',
        value: motherCollection,
        type: 'collection_reference',
      })
    }

    // Create (reuse the painting's two images; the webhook will add variants).
    const poster: any = await shopify.product.create({
      title: seo.title,
      descriptionHtml,
      handle: '',
      productType: 'poster',
      tags,
      seo: { title: seo.metaTitle, description: seo.metaDescription },
      media: [
        { src: node0.url, alt: alt.alt },
        { src: node1.url, alt: alt.alt },
      ],
      templateSuffix: 'poster',
      metafields,
    })

    // Mark the painting done IMMEDIATELY (idempotency: a re-run won't duplicate this poster).
    await shopify.metafield.update(painting.id, 'link', 'poster', poster.id, 'product_reference')

    // Category from the ratio model (required before artwork.type), then artwork.type, then publish.
    const tag = shopify.product.getTagByRatio(ratio)
    let model = modelCache.get(tag)
    if (!model) {
      model = await shopify.product.getProductByTag(tag, 'poster')
      modelCache.set(tag, model)
    }
    if (model?.category?.id) {
      await shopify.category.setProductCategory(poster.id, model.category.id)
    }
    await shopify.metafield.update(poster.id, 'artwork', 'type', 'poster')
    await shopify.publications.publishProductOnAll(poster.id)

    this.logger.success(`[created] ${seo.title} -> ${poster.id} (webhook will add variants)`)
  }

  private withWidth(url: string, w: number): string {
    return url.includes('?') ? `${url}&width=${w}` : `${url}?width=${w}`
  }
}
