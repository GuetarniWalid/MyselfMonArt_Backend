import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import PostFormatter from 'App/Services/Instagram/PostFormatter'
import Shopify from 'App/Services/Shopify'
import fs from 'fs/promises'
import path from 'path'

export default class InstagramTestPayloadOne extends BaseCommand {
  public static commandName = 'instagram:test_payload_one'
  public static description =
    'Dry-run: build a complete Instagram post payload (Claude-generated caption + cropped 1080x1350 image) without posting. Saves the cropped image locally for visual inspection.'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.string({
    description:
      'Shopify product ID (numeric or gid://). If omitted, picks the most recently created product.',
  })
  public product: string

  public async run() {
    const shopify = new Shopify()
    const products = await shopify.product.getAll()
    if (products.length === 0) throw new Error('No product found in Shopify')

    const product = this.product ? this.pickById(products) : this.pickMostRecent(products)

    this.logger.info(`Product: ${product.title} (${product.id})`)
    this.logger.info('Building Instagram post payload (this may take a few seconds)...')

    const formatter = new PostFormatter()
    const payload = await formatter.buildPostPayload(product)

    const previewPath = path.resolve('tmp', 'instagram-dry-run.jpg')
    await fs.mkdir(path.dirname(previewPath), { recursive: true })
    await fs.writeFile(previewPath, payload.imageBuffer)

    const display = {
      caption: payload.caption,
      altText: payload.altText,
      shopifyProductId: payload.shopifyProductId,
      link: payload.link,
      imageBuffer: `<buffer ${payload.imageBuffer.length} bytes saved at ${previewPath}>`,
    }
    console.log('---')
    console.dir(display, { depth: null })
    console.log('---')
    this.logger.info(`Caption length: ${payload.caption.length} / 2200 chars`)
    this.logger.info(`Alt text length: ${payload.altText.length} / 125 chars`)
    this.logger.info(`Image preview saved at: ${previewPath}`)
    this.logger.info('Dry-run complete — nothing was posted to Instagram.')
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
