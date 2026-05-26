import { DateTime } from 'luxon'
import Instagram from 'App/Services/Instagram'
import Pinterest from 'App/Services/Pinterest'
import Shopify from 'App/Services/Shopify'
import SocialPublication from 'App/Models/SocialPublication'

/**
 * Orchestrates one daily-publication tick: publishes a single product to
 * Pinterest first, then optionally chains the same product to Instagram.
 *
 *   - Pinterest selector picks the next product+board (unchanged behavior)
 *   - Pinterest is published and recorded in `social_publications`
 *   - Instagram is then attempted, but only if we have not posted to IG in
 *     the last 24h (organic IG reach drops with high frequency, so we cap
 *     at one post/day even though the cron fires more often)
 *   - Instagram failures never undo or hide the Pinterest success — they are
 *     logged and swallowed
 */
export default class DailyPublication {
  private readonly INSTAGRAM_MIN_HOURS_BETWEEN_POSTS = 24

  public async run() {
    const shopify = new Shopify()
    const [products, collections] = await Promise.all([
      shopify.product.getAll(),
      shopify.collection.getAll(),
    ])

    const pinterest = new Pinterest(products, collections)
    await pinterest.initialize()
    await pinterest.autoCreateMissingBoards()

    const { product, board } = await pinterest.publicationSelector.selectNextProductToPublish()

    const pinPayload = await pinterest.pinFormatter.buildPinPayload(product, board)
    const pin = await pinterest.poster.publishPin(pinPayload)

    await SocialPublication.create({
      channel: 'pinterest',
      shopifyProductId: product.id,
      externalId: pin.id,
      externalBoardId: board.id,
      publishedAt: DateTime.now(),
      metadata: {
        title: pinPayload.title,
        description: pinPayload.description,
        boardName: board.name,
      },
    })

    console.log(`✅ Pinterest pin published (id=${pin.id}, board=${board.name})`)

    const shouldChainIG = await this.shouldChainInstagram()
    if (!shouldChainIG) {
      console.log('⏭️  Instagram skipped — already posted within the last 24h')
      return
    }

    try {
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

      console.log(`✅ Instagram post published (media id=${igResult.mediaId})`)
    } catch (igError) {
      // Pinterest already succeeded — never let IG failure mask that.
      console.error(
        '❌ Instagram chain failed (Pinterest stays published):',
        igError?.message ?? igError
      )
    }
  }

  private async shouldChainInstagram(): Promise<boolean> {
    const last = await SocialPublication.query()
      .where('channel', 'instagram')
      .orderBy('published_at', 'desc')
      .first()

    if (!last) return true

    const hoursSinceLast = DateTime.now().diff(last.publishedAt, 'hours').hours
    return hoursSinceLast >= this.INSTAGRAM_MIN_HOURS_BETWEEN_POSTS
  }
}
