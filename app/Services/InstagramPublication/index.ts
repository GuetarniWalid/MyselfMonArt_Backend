import { DateTime } from 'luxon'
import Instagram from 'App/Services/Instagram'
import PublicationSelector from 'App/Services/Instagram/PublicationSelector'
import Shopify from 'App/Services/Shopify'
import SocialPublication from 'App/Models/SocialPublication'

/**
 * Orchestrates one Instagram-publication tick, fully decoupled from Pinterest.
 *
 *   - Reads the Shopify catalog and the set of products already posted to the
 *     IG feed (`social_publications`, channel='instagram')
 *   - Selects the most recently created product not yet posted to IG
 *   - Publishes it and records the publication
 *   - When the whole catalog is already posted, does nothing (no re-posting)
 *     and logs — a new Shopify product resumes publishing on the next tick
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

    const instagram = new Instagram()
    const postPayload = await instagram.postFormatter.buildPostPayload(product)
    const igResult = await instagram.poster.publishPost(postPayload)

    await SocialPublication.create({
      channel: 'instagram',
      shopifyProductId: product.id,
      externalId: igResult.mediaId,
      publishedAt: DateTime.now(),
      metadata: {
        caption: postPayload.caption,
        altText: postPayload.altText,
      },
    })

    console.log(`✅ Instagram post published (product=${product.id}, media id=${igResult.mediaId})`)
  }

  private async getAlreadyPostedProductIds(): Promise<Set<string>> {
    const rows = await SocialPublication.query()
      .where('channel', 'instagram')
      .select('shopify_product_id')
    return new Set(rows.map((row) => row.shopifyProductId))
  }
}
