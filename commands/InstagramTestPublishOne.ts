import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import Instagram from 'App/Services/Instagram'
import Shopify from 'App/Services/Shopify'

export default class InstagramTestPublishOne extends BaseCommand {
  public static commandName = 'instagram:test_publish_one'
  public static description =
    'PUBLISH a real Instagram post end-to-end. Builds the payload (Claude caption + cropped image), uploads to Shopify Files, posts to IG, then deletes the temp file. Use --yes to confirm the publish.'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.string({
    description:
      'Shopify product ID (numeric or gid://). If omitted, picks the most recently created product.',
  })
  public product: string

  @flags.boolean({
    description:
      'Confirm the publish. Without this flag, the command prints the payload and exits without posting.',
  })
  public yes: boolean

  public async run() {
    const shopify = new Shopify()
    const products = await shopify.product.getAll()
    if (products.length === 0) throw new Error('No product found in Shopify')

    const product = this.product ? this.pickById(products) : this.pickMostRecent(products)
    this.logger.info(`Product: ${product.title} (${product.id})`)

    const instagram = new Instagram()

    this.logger.info('Building payload (~10s for Claude call)...')
    const payload = await instagram.postFormatter.buildPostPayload(product)

    this.logger.info(`Caption length: ${payload.caption.length} / 2200 chars`)
    this.logger.info(`Alt text length: ${payload.altText.length} / 125 chars`)

    if (!this.yes) {
      this.logger.warning(
        '[DRY-RUN] Skipping the actual Instagram publish. Re-run with --yes to publish for real.'
      )
      console.log('---')
      console.log(payload.caption)
      console.log('---')
      return
    }

    this.logger.info('Publishing to Instagram (upload → POST /media → POST /media_publish)...')
    const result = await instagram.poster.publishPost(payload)
    this.logger.success(`Published to Instagram. media id = ${result.mediaId}`)
  }

  private pickById(products: any[]) {
    const numericId = this.product.replace('gid://shopify/Product/', '')
    const product = products.find((p) => p.id.endsWith(numericId))
    if (!product) throw new Error(`Product ${this.product} not found in Shopify`)
    return product
  }

  private pickMostRecent(products: any[]) {
    return [...products].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]
  }
}
