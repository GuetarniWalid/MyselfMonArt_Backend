import type { Board, CarouselPinPayload, ImagePinPayload, VideoPinPayload } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'
import sharp from 'sharp'
import PinterestFormatSelector from './PinterestFormatSelector'
import Pinterest from '../Claude/Pinterest'

export default class PinFormatter {
  /** Single static image pin (base64). */
  public async buildPinPayload(
    shopifyProduct: ShopifyProduct,
    board: Board
  ): Promise<ImagePinPayload> {
    const { buffer, imageAlt } = await this.processImage(shopifyProduct)
    const text = await this.generateText(shopifyProduct, imageAlt)

    return {
      board_id: board.id,
      title: text.title,
      description: text.description,
      link: this.getProductLinkWithProductId(shopifyProduct),
      alt_text: text.alt_text,
      media_source: {
        source_type: 'image_base64',
        content_type: 'image/png',
        data: buffer.toString('base64'),
      },
    }
  }

  /**
   * Video pin payload. The `mediaId` must already be a processed Pinterest
   * media upload (see PinterestPoster.uploadVideo). The cover image is the
   * product's cropped image, sent base64 — robust and needs no hosted URL.
   */
  public async buildVideoPinPayload(
    shopifyProduct: ShopifyProduct,
    board: Board,
    mediaId: string
  ): Promise<VideoPinPayload> {
    const { buffer, imageAlt } = await this.processImage(shopifyProduct)
    const text = await this.generateText(shopifyProduct, imageAlt)

    return {
      board_id: board.id,
      title: text.title,
      description: text.description,
      link: this.getProductLinkWithProductId(shopifyProduct),
      alt_text: text.alt_text,
      media_source: {
        source_type: 'video_id',
        media_id: mediaId,
        cover_image_content_type: 'image/png',
        cover_image_data: buffer.toString('base64'),
      },
    }
  }

  /**
   * Carousel pin payload — 2 to 5 product images (index 2+), each cropped to the
   * same 1000x1500 ratio so Pinterest accepts them as a uniform carousel.
   */
  public async buildCarouselPinPayload(
    shopifyProduct: ShopifyProduct,
    board: Board
  ): Promise<CarouselPinPayload> {
    const { buffers, firstAlt } = await this.processImagesForCarousel(shopifyProduct)
    const text = await this.generateText(shopifyProduct, firstAlt)

    return {
      board_id: board.id,
      title: text.title,
      description: text.description,
      link: this.getProductLinkWithProductId(shopifyProduct),
      alt_text: text.alt_text,
      media_source: {
        source_type: 'multiple_image_base64',
        items: buffers.map((buffer) => ({
          content_type: 'image/png',
          data: buffer.toString('base64'),
        })),
      },
    }
  }

  /** Download a product video from its CDN URL into a buffer (for upload). */
  public async downloadVideoBuffer(videoUrl: string): Promise<Buffer> {
    const response = await fetch(videoUrl)
    if (!response.ok) {
      throw new Error(`Failed to download video (${response.status}) from ${videoUrl}`)
    }
    const buffer = await response.arrayBuffer()
    return Buffer.from(buffer)
  }

  public async getCroppedImageBuffer(shopifyProduct: ShopifyProduct): Promise<Buffer> {
    const { buffer } = await this.processImage(shopifyProduct)
    return buffer
  }

  /**
   * Resolve the pin's title/description/alt via Claude, falling back to the
   * product's own fields. Shared by every format so the copy is consistent.
   */
  private async generateText(
    shopifyProduct: ShopifyProduct,
    fallbackAlt: string
  ): Promise<{ title: string; description: string; alt_text: string }> {
    const pinterest = new Pinterest()
    const productType = this.getProductTypeFr(shopifyProduct)
    const generated = await pinterest.generatePinPayload(
      shopifyProduct.title,
      shopifyProduct.description,
      productType
    )
    return {
      title: generated.title || shopifyProduct.title,
      description: generated.description || shopifyProduct.description,
      alt_text: generated.alt_text || fallbackAlt,
    }
  }

  private getProductTypeFr(shopifyProduct: ShopifyProduct): string {
    const artworkType = shopifyProduct.artworkTypeMetafield?.value
    switch (artworkType) {
      case 'painting':
        return 'Tableau sur toile'
      case 'poster':
        return 'Poster'
      case 'tapestry':
        return 'Tapisserie murale'
      default:
        return 'Tableau décoratif'
    }
  }

  private async processImage(shopifyProduct: ShopifyProduct) {
    const image = this.getImage(shopifyProduct.media.nodes)
    const imageBuffer = await this.downloadImage(image.image!.url)
    const buffer = await this.cropImage(imageBuffer)
    return { buffer, imageAlt: image.alt }
  }

  private static readonly IMAGE_PRIORITY = [2, 3, 1, 0]

  // Cap carousel slides at Pinterest's hard limit of 5. Slides are the product's
  // images from index 2 onward — index 0 and 1 are never included (same rule as
  // the Instagram carousel).
  private static readonly MAX_CAROUSEL_IMAGES = 5

  private getImage(images: ShopifyProduct['media']['nodes']) {
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('No image found')
    }
    const imageList = images.filter((image) => image.mediaContentType === 'IMAGE')
    for (const index of PinFormatter.IMAGE_PRIORITY) {
      const candidate = imageList[index]
      if (candidate?.image?.url) return candidate
    }
    throw new Error(
      'No usable image at indices [2, 3, 1, 0] — product not publishable to Pinterest'
    )
  }

  // Carousel slides: every usable image from index 2 onward, in natural order.
  // Static so the orchestrator can count slides for the format-capability
  // decision without duplicating the rule.
  public static carouselSlideNodes(images: ShopifyProduct['media']['nodes']) {
    if (!Array.isArray(images)) return []
    const imageList = images.filter((image) => image.mediaContentType === 'IMAGE')
    return imageList.slice(2).filter((image) => Boolean(image.image?.url))
  }

  private async processImagesForCarousel(
    shopifyProduct: ShopifyProduct
  ): Promise<{ buffers: Buffer[]; firstAlt: string }> {
    const slides = PinFormatter.carouselSlideNodes(shopifyProduct.media.nodes).slice(
      0,
      PinFormatter.MAX_CAROUSEL_IMAGES
    )
    if (slides.length < PinterestFormatSelector.MIN_CAROUSEL_IMAGES) {
      throw new Error(
        `Not enough carousel images from index 2+ (${slides.length} < ${PinterestFormatSelector.MIN_CAROUSEL_IMAGES})`
      )
    }
    const buffers = await Promise.all(
      slides.map(async (image) => this.cropImage(await this.downloadImage(image.image!.url)))
    )
    return { buffers, firstAlt: slides[0].alt }
  }

  private async downloadImage(imageUrl: string): Promise<Buffer> {
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()
    return Buffer.from(buffer)
  }

  private async cropImage(imageBuffer: Buffer): Promise<Buffer> {
    const image = sharp(imageBuffer)
    return image.resize(1000, 1500, { fit: 'cover' }).png().toBuffer()
  }

  private getProductLinkWithProductId(shopifyProduct: ShopifyProduct): string {
    const url = new URL(shopifyProduct.onlineStoreUrl)
    url.searchParams.set('shopify_product_id', shopifyProduct.id)
    return url.toString()
  }
}
