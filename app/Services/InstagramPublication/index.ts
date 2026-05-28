import { DateTime } from 'luxon'
import type { InstagramPostFormat } from 'Types/Instagram'
import type { Product as ShopifyProduct } from 'Types/Product'
import Instagram from 'App/Services/Instagram'
import FormatSelector from 'App/Services/Instagram/FormatSelector'
import PublicationSelector from 'App/Services/Instagram/PublicationSelector'
import Shopify from 'App/Services/Shopify'
import SocialPublication from 'App/Models/SocialPublication'

/**
 * Orchestrates one Instagram-publication tick, fully decoupled from Pinterest.
 *
 *   - Reads the Shopify catalog and the set of products already posted to the
 *     IG feed (`social_publications`, channel='instagram')
 *   - Selects the most recently created product not yet posted to IG
 *   - Picks a format via the weighted fixed cycle (reel / carousel / image),
 *     constrained by what the product can actually produce
 *   - Publishes it (falling back to a single image if a richer format fails)
 *     and records the publication, including the format used
 *   - When the whole catalog is already posted, does nothing (no re-posting)
 *
 * Cadence is driven entirely by the once-a-day cron (PublishInstagramDaily),
 * so there is no in-service frequency cap.
 */
export default class InstagramPublication {
  public async run() {
    const shopify = new Shopify()
    const products = await shopify.product.getAll()

    const alreadyPostedProductIds = await this.getAlreadyPostedProductIds()
    const selector = new PublicationSelector(products, alreadyPostedProductIds)
    const product = selector.selectNextProductToPublish()

    if (!product) {
      console.log(
        '⏭️  Instagram skipped — whole catalog already posted to the IG feed (nothing new)'
      )
      return
    }

    const videoUrl = await shopify.metafield.getVideoUrl(product.id)
    const format = new FormatSelector().select({
      // Each IG post is a distinct product (the catalog is never re-posted), so
      // the number of already-posted products == number of IG posts == position
      // in the format cycle.
      priorPostCount: alreadyPostedProductIds.size,
      hasVideo: Boolean(videoUrl),
      usableImageCount: this.countUsableImages(product),
    })

    const { mediaId, usedFormat } = await this.publishInFormat(format, product, videoUrl)

    await SocialPublication.create({
      channel: 'instagram',
      shopifyProductId: product.id,
      externalId: mediaId,
      publishedAt: DateTime.now(),
      metadata: { format: usedFormat },
    })

    console.log(`✅ Instagram ${usedFormat} published (product=${product.id}, media id=${mediaId})`)
  }

  private async publishInFormat(
    format: InstagramPostFormat,
    product: ShopifyProduct,
    videoUrl: string | null
  ): Promise<{ mediaId: string; usedFormat: InstagramPostFormat }> {
    const instagram = new Instagram()
    try {
      if (format === 'reel') {
        if (!videoUrl) throw new Error('reel format chosen but product has no videoUrl')
        const payload = await instagram.postFormatter.buildReelPayload(product, videoUrl)
        const { mediaId } = await instagram.poster.publishReel(payload)
        return { mediaId, usedFormat: 'reel' }
      }
      if (format === 'carousel') {
        const payload = await instagram.postFormatter.buildCarouselPayload(product)
        const { mediaId } = await instagram.poster.publishCarousel(payload)
        return { mediaId, usedFormat: 'carousel' }
      }
      const payload = await instagram.postFormatter.buildPostPayload(product)
      const { mediaId } = await instagram.poster.publishPost(payload)
      return { mediaId, usedFormat: 'image' }
    } catch (error) {
      if (format === 'image') throw error
      // Reliability: a richer format failing (e.g. Meta rejects the video's
      // aspect ratio) should not cost us the day's post — fall back to a single
      // image, the most robust path.
      console.warn(
        `⚠️  Instagram ${format} failed, falling back to single image:`,
        error?.message ?? error
      )
      const payload = await instagram.postFormatter.buildPostPayload(product)
      const { mediaId } = await instagram.poster.publishPost(payload)
      return { mediaId, usedFormat: 'image' }
    }
  }

  private countUsableImages(product: ShopifyProduct): number {
    return (product.media?.nodes || []).filter(
      (node) => node.mediaContentType === 'IMAGE' && Boolean(node.image?.url)
    ).length
  }

  private async getAlreadyPostedProductIds(): Promise<Set<string>> {
    const rows = await SocialPublication.query()
      .where('channel', 'instagram')
      .select('shopify_product_id')
    return new Set(rows.map((row) => row.shopifyProductId))
  }
}
