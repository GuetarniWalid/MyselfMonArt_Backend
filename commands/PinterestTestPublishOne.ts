import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import Pinterest from 'App/Services/Pinterest'
import BoardMatcher from 'App/Services/Pinterest/BoardMatcher'
import Shopify from 'App/Services/Shopify'
import fs from 'fs/promises'
import path from 'path'

export default class PinterestTestPublishOne extends BaseCommand {
  public static commandName = 'pinterest:test_publish_one'
  public static description =
    'Dry-run: mirror the cron (auto-create missing boards, build the pin payload) without posting the pin. Saves the cropped image locally for visual inspection.'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.string({
    description: 'Shopify product ID (numeric or gid://). Defaults to next eligible product.',
  })
  public product: string

  @flags.boolean({
    description:
      'Skip auto-creation of missing boards (matching-only test, no Pinterest API write).',
  })
  public skipCreateBoards: boolean

  public async run() {
    const shopify = new Shopify()
    const [products, collections] = await Promise.all([
      shopify.product.getAll(),
      shopify.collection.getAll(),
    ])

    const pinterest = new Pinterest(products, collections)
    await pinterest.initialize()

    if (!this.skipCreateBoards) {
      this.logger.info('Auto-creating missing boards (mirroring cron behavior)...')
      await pinterest.autoCreateMissingBoards()
    } else {
      this.logger.info('Skipping auto-creation (--skip-create-boards).')
    }

    const { product, board } = this.product
      ? this.pickByProductId(pinterest, products)
      : await pinterest.publicationSelector.selectNextProductToPublish()

    this.logger.info(`Product: ${product.title} (${product.id})`)
    this.logger.info(`Board:   ${board.name} (${board.id})`)
    this.logger.info('Building pin payload (this may take a few seconds)...')

    const pinPayload = await pinterest.pinFormatter.buildPinPayload(product, board)

    const previewPath = path.resolve('tmp', 'pinterest-dry-run.png')
    await fs.mkdir(path.dirname(previewPath), { recursive: true })
    await fs.writeFile(previewPath, Buffer.from(pinPayload.media_source.data, 'base64'))

    const payloadForDisplay = {
      ...pinPayload,
      media_source: {
        source_type: pinPayload.media_source.source_type,
        content_type: pinPayload.media_source.content_type,
        data: `<base64 ${pinPayload.media_source.data.length} chars>`,
      },
    }
    console.log('---')
    console.dir(payloadForDisplay, { depth: null })
    console.log('---')
    this.logger.info(`Image preview saved at: ${previewPath}`)
    this.logger.info('Dry-run complete — pin NOT published. Review the image and payload above.')
  }

  private pickByProductId(pinterest: Pinterest, products: any[]) {
    const numericId = this.product.replace('gid://shopify/Product/', '')
    const product = products.find((p) => p.id.endsWith(numericId))
    if (!product) throw new Error(`Product ${this.product} not found in Shopify`)

    const matcher = new BoardMatcher()
    const matching = matcher.getMatchingBoards(product, pinterest.getBoards())
    if (matching.length === 0) {
      throw new Error(
        `Product ${product.title} has no matching board (mother_collection=${matcher.getMotherCollectionTitle(product) ?? 'none'}, artworkType=${matcher.getArtworkType(product) ?? 'none'}). With --skip-create-boards, only existing boards are considered — re-run without the flag to auto-create.`
      )
    }
    return { product, board: matching[0] }
  }
}
