import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import InstagramPublication from 'App/Services/InstagramPublication'
import FormatSelector from 'App/Services/Instagram/FormatSelector'
import PublicationSelector from 'App/Services/Instagram/PublicationSelector'
import SocialPublication from 'App/Models/SocialPublication'
import Shopify from 'App/Services/Shopify'

export default class InstagramPublishNext extends BaseCommand {
  public static commandName = 'instagram:publish_next'
  public static description =
    'Run the decoupled Instagram publication once: picks the most recent product not yet posted to the IG feed and publishes it. Without --yes, only prints which product would be posted.'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.boolean({
    description: 'Confirm the publish. Without it, prints the selected product and exits.',
  })
  public yes: boolean

  public async run() {
    if (this.yes) {
      this.logger.info('Publishing the next product to Instagram...')
      await new InstagramPublication().run()
      return
    }

    const selected = await this.selectNext()
    if (!selected) {
      this.logger.warning('[DRY-RUN] Nothing to publish — whole catalog already posted to IG.')
      return
    }
    const { product, priorPostCount } = selected

    const shopify = new Shopify()
    const videoUrl = await shopify.metafield.getVideoUrl(product.id)
    const usableImageCount = (product.media?.nodes || []).filter(
      (node) => node.mediaContentType === 'IMAGE' && Boolean(node.image?.url)
    ).length
    const format = new FormatSelector().select({
      priorPostCount,
      hasVideo: Boolean(videoUrl),
      usableImageCount,
    })

    this.logger.info(`[DRY-RUN] Would publish: ${product.title} (${product.id})`)
    this.logger.info(
      `[DRY-RUN] Format: ${format}  (video=${Boolean(videoUrl)}, usableImages=${usableImageCount}, cyclePos=${priorPostCount})`
    )
    this.logger.warning('Re-run with --yes to publish for real.')
  }

  private async selectNext() {
    const shopify = new Shopify()
    const products = await shopify.product.getAll()
    const rows = await SocialPublication.query()
      .where('channel', 'instagram')
      .select('shopify_product_id')
    const postedIds = new Set(rows.map((row) => row.shopifyProductId))
    const product = new PublicationSelector(products, postedIds).selectNextProductToPublish()
    if (!product) return null
    return { product, priorPostCount: postedIds.size }
  }
}
