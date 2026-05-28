import { DateTime } from 'luxon'
import Pinterest from 'App/Services/Pinterest'
import Shopify from 'App/Services/Shopify'
import SocialPublication from 'App/Models/SocialPublication'

/**
 * Orchestrates one daily-publication tick on Pinterest: selects the next
 * product+board via the Pinterest selector, publishes a single pin, and records
 * it in `social_publications`.
 *
 * Instagram is no longer chained here — it runs on its own independent cron
 * (PublishInstagramDaily → InstagramPublication) with its own selection logic
 * and once-a-day cadence.
 */
export default class DailyPublication {
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
  }
}
