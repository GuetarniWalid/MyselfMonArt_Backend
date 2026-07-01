import { DateTime } from 'luxon'
import type { Board, PinterestPin, PinterestPinFormat } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'
import Pinterest from 'App/Services/Pinterest'
import PinterestFormatSelector from 'App/Services/Pinterest/PinterestFormatSelector'
import PinterestPublicationSelector from 'App/Services/Pinterest/PublicationSelector'
import PinFormatter from 'App/Services/Pinterest/PinFormatter'
import Shopify from 'App/Services/Shopify'
import SocialPublication from 'App/Models/SocialPublication'

/**
 * Orchestrates one daily-publication tick on Pinterest: selects the next
 * product+board via the Pinterest selector, picks a format via the weighted
 * fixed cycle (image / video, with carousel as a fallback), publishes a single
 * pin, and records it in `social_publications`.
 *
 * Format is chosen by PinterestFormatSelector and constrained by what the
 * product can actually produce; a richer format that fails at publish time
 * falls back to a single image so the day's pin is never lost.
 *
 * Instagram runs on its own independent cron (PublishInstagramDaily →
 * InstagramPublication) with its own selection logic.
 */
export default class DailyPublication {
  public async run() {
    const shopify = new Shopify()
    const [products, collections] = await Promise.all([
      shopify.product.getAll(),
      shopify.collection.getAll(),
    ])

    const publishedPairs = await this.getPublishedProductBoardKeys()
    const pinterest = new Pinterest(products, collections, publishedPairs)
    await pinterest.initialize()
    await pinterest.autoCreateMissingBoards()

    const { product, board } = await pinterest.publicationSelector.selectNextProductToPublish()

    const videoUrl = await shopify.metafield.getVideoUrl(product.id)
    const format = new PinterestFormatSelector().select({
      // The deterministic cycle position is driven by how many pins we've
      // already published to Pinterest overall.
      priorPostCount: await this.getPinterestPublicationCount(),
      hasVideo: Boolean(videoUrl),
      carouselSlideCount: PinFormatter.carouselSlideNodes(product.media?.nodes ?? []).length,
    })

    const { pin, usedFormat } = await this.publishInFormat(
      pinterest,
      format,
      product,
      board,
      videoUrl
    )

    await SocialPublication.create({
      channel: 'pinterest',
      shopifyProductId: product.id,
      externalId: pin.id,
      externalBoardId: board.id,
      publishedAt: DateTime.now(),
      metadata: {
        title: pin.title,
        boardName: board.name,
        format: usedFormat,
      },
    })

    console.log(`✅ Pinterest ${usedFormat} pin published (id=${pin.id}, board=${board.name})`)
  }

  private async publishInFormat(
    pinterest: Pinterest,
    format: PinterestPinFormat,
    product: ShopifyProduct,
    board: Board,
    videoUrl: string | null
  ): Promise<{ pin: PinterestPin; usedFormat: PinterestPinFormat }> {
    try {
      if (format === 'video') {
        if (!videoUrl) throw new Error('video format chosen but product has no videoUrl')
        const videoBuffer = await pinterest.pinFormatter.downloadVideoBuffer(videoUrl)
        const mediaId = await pinterest.poster.uploadVideo(videoBuffer)
        const payload = await pinterest.pinFormatter.buildVideoPinPayload(product, board, mediaId)
        const pin = await pinterest.poster.publishPin(payload)
        return { pin, usedFormat: 'video' }
      }
      if (format === 'carousel') {
        const payload = await pinterest.pinFormatter.buildCarouselPinPayload(product, board)
        const pin = await pinterest.poster.publishPin(payload)
        return { pin, usedFormat: 'carousel' }
      }
      const payload = await pinterest.pinFormatter.buildPinPayload(product, board)
      const pin = await pinterest.poster.publishPin(payload)
      return { pin, usedFormat: 'image' }
    } catch (error) {
      if (format === 'image') throw error
      // Reliability: a richer format failing (Pinterest rejects the video,
      // carousel ratio mismatch, etc.) must not cost us the day's pin — fall
      // back to a single image, the most robust path.
      console.warn(
        `⚠️  Pinterest ${format} failed, falling back to single image:`,
        error?.message ?? error
      )
      const payload = await pinterest.pinFormatter.buildPinPayload(product, board)
      const pin = await pinterest.poster.publishPin(payload)
      return { pin, usedFormat: 'image' }
    }
  }

  private async getPinterestPublicationCount(): Promise<number> {
    const result = await SocialPublication.query().where('channel', 'pinterest').count('* as total')
    return Number(result[0].$extras.total ?? 0)
  }

  /**
   * Toutes les paires (produit, board) qu'on a déjà publiées sur Pinterest,
   * lues depuis NOTRE base (source fiable qu'on maîtrise). Injectées dans le
   * sélecteur pour garantir qu'un produit n'est jamais re-pinné sur un board
   * déjà utilisé — quel que soit le format (image/carrousel/vidéo) et sans
   * dépendre de ce que l'API Pinterest renvoie pour les pins existants.
   */
  private async getPublishedProductBoardKeys(): Promise<Set<string>> {
    const rows = await SocialPublication.query()
      .where('channel', 'pinterest')
      .whereNotNull('external_board_id')
      .select('shopify_product_id', 'external_board_id')
    return new Set(
      rows
        .filter((row) => row.externalBoardId)
        .map((row) =>
          PinterestPublicationSelector.pairKey(row.shopifyProductId, row.externalBoardId!)
        )
    )
  }
}
