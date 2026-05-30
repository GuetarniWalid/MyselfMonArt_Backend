import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import type { PinterestPinFormat } from 'Types/Pinterest'
import Pinterest from 'App/Services/Pinterest'
import PinterestFormatSelector from 'App/Services/Pinterest/PinterestFormatSelector'
import BoardMatcher from 'App/Services/Pinterest/BoardMatcher'
import Shopify from 'App/Services/Shopify'
import fs from 'fs/promises'
import path from 'path'

export default class PinterestTestPublishOne extends BaseCommand {
  public static commandName = 'pinterest:test_publish_one'
  public static description =
    'Test one Pinterest publication in a chosen format. Dry-run by default (everything except the final POST /pins); pass --publish to actually post.'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.string({
    description: 'Shopify product ID (numeric or gid://). Defaults to next eligible product.',
  })
  public product: string

  @flags.string({
    description: 'Format to test: image | video | carousel. Defaults to image.',
  })
  public format: string

  @flags.boolean({
    description: 'Actually publish the pin (real POST /pins). Without it, the run is a dry-run.',
  })
  public publish: boolean

  @flags.boolean({
    description:
      'Skip auto-creation of missing boards (matching-only test, no Pinterest API write).',
  })
  public skipCreateBoards: boolean

  public async run() {
    const format = this.resolveFormat()

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

    this.logger.info(`Format:  ${format}${this.publish ? ' (WILL PUBLISH)' : ' (dry-run)'}`)
    this.logger.info(`Product: ${product.title} (${product.id})`)
    this.logger.info(`Board:   ${board.name} (${board.id})`)

    if (format === 'video') {
      await this.runVideo(pinterest, shopify, product, board)
    } else if (format === 'carousel') {
      await this.runCarousel(pinterest, product, board)
    } else {
      await this.runImage(pinterest, product, board)
    }
  }

  private async runImage(pinterest: Pinterest, product: any, board: any) {
    this.logger.info('Building image pin payload (this may take a few seconds)...')
    const payload = await pinterest.pinFormatter.buildPinPayload(product, board)

    const previewPath = path.resolve('tmp', 'pinterest-dry-run.png')
    await fs.mkdir(path.dirname(previewPath), { recursive: true })
    await fs.writeFile(previewPath, Buffer.from(payload.media_source.data, 'base64'))

    this.dumpPayload({
      ...payload,
      media_source: {
        source_type: payload.media_source.source_type,
        content_type: payload.media_source.content_type,
        data: `<base64 ${payload.media_source.data.length} chars>`,
      },
    })
    this.logger.info(`Image preview saved at: ${previewPath}`)

    if (this.publish) {
      const pin = await pinterest.poster.publishPin(payload)
      this.logger.success(`Published image pin id=${pin.id}`)
    } else {
      this.logger.info('Dry-run — pin NOT published. Re-run with --publish to post.')
    }
  }

  private async runCarousel(pinterest: Pinterest, product: any, board: any) {
    const slideCount = PinterestFormatSelector.MIN_CAROUSEL_IMAGES
    this.logger.info('Building carousel pin payload (downloading + cropping slides)...')
    const payload = await pinterest.pinFormatter.buildCarouselPinPayload(product, board)

    const dir = path.resolve('tmp')
    await fs.mkdir(dir, { recursive: true })
    for (let i = 0; i < payload.media_source.items.length; i++) {
      const file = path.join(dir, `pinterest-dry-run-carousel-${i}.png`)
      await fs.writeFile(file, Buffer.from(payload.media_source.items[i].data, 'base64'))
    }

    this.dumpPayload({
      ...payload,
      media_source: {
        source_type: payload.media_source.source_type,
        items: `<${payload.media_source.items.length} base64 images (min ${slideCount})>`,
      },
    })
    this.logger.info(
      `${payload.media_source.items.length} slide previews saved at: ${dir}\\pinterest-dry-run-carousel-*.png`
    )

    if (this.publish) {
      const pin = await pinterest.poster.publishPin(payload)
      this.logger.success(`Published carousel pin id=${pin.id}`)
    } else {
      this.logger.info('Dry-run — pin NOT published. Re-run with --publish to post.')
    }
  }

  private async runVideo(pinterest: Pinterest, shopify: Shopify, product: any, board: any) {
    const videoUrl = await shopify.metafield.getVideoUrl(product.id)
    if (!videoUrl) {
      throw new Error(
        `Product "${product.title}" has no video metafield — pick a product with a video via --product, or test --format=image/carousel.`
      )
    }
    this.logger.info(`Video URL: ${videoUrl}`)

    // The heavy, risky part — download + register + S3 upload + poll. This runs
    // even in dry-run because it only creates an unattached media object (nothing
    // public) and is exactly what we want to validate before going live.
    this.logger.info('Downloading video...')
    const videoBuffer = await pinterest.pinFormatter.downloadVideoBuffer(videoUrl)
    this.logger.info(`Downloaded ${(videoBuffer.length / (1024 * 1024)).toFixed(2)} MB`)

    this.logger.info('Registering + uploading to Pinterest + polling until processed...')
    const mediaId = await pinterest.poster.uploadVideo(videoBuffer)
    this.logger.success(`Media processed and ready: media_id=${mediaId}`)

    this.logger.info('Building video pin payload (with cover image)...')
    const payload = await pinterest.pinFormatter.buildVideoPinPayload(product, board, mediaId)

    const coverPath = path.resolve('tmp', 'pinterest-dry-run-video-cover.png')
    await fs.mkdir(path.dirname(coverPath), { recursive: true })
    await fs.writeFile(coverPath, Buffer.from(payload.media_source.cover_image_data, 'base64'))

    this.dumpPayload({
      ...payload,
      media_source: {
        source_type: payload.media_source.source_type,
        media_id: payload.media_source.media_id,
        cover_image_content_type: payload.media_source.cover_image_content_type,
        cover_image_data: `<base64 ${payload.media_source.cover_image_data.length} chars>`,
      },
    })
    this.logger.info(`Cover preview saved at: ${coverPath}`)

    if (this.publish) {
      const pin = await pinterest.poster.publishPin(payload)
      this.logger.success(`Published video pin id=${pin.id}`)
    } else {
      this.logger.info(
        'Dry-run — media uploaded & processed, but pin NOT created. Re-run with --publish to post.'
      )
    }
  }

  private dumpPayload(payloadForDisplay: Record<string, unknown>) {
    console.log('---')
    console.dir(payloadForDisplay, { depth: null })
    console.log('---')
  }

  private resolveFormat(): PinterestPinFormat {
    const raw = (this.format || 'image').toLowerCase()
    if (raw !== 'image' && raw !== 'video' && raw !== 'carousel') {
      throw new Error(`Invalid --format "${this.format}". Use image | video | carousel.`)
    }
    return raw
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
