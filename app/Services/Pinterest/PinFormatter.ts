import type { Board, PinPayload } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'
import sharp from 'sharp'
import Pinterest from '../Claude/Pinterest'

export default class PinFormatter {
  public async buildPinPayload(shopifyProduct: ShopifyProduct, board: Board): Promise<PinPayload> {
    const { buffer, imageAlt } = await this.processImage(shopifyProduct)
    const pinterest = new Pinterest()
    const productType = this.getProductTypeFr(shopifyProduct)
    const pinPayload = await pinterest.generatePinPayload(
      shopifyProduct.title,
      shopifyProduct.description,
      productType
    )

    return {
      board_id: board.id,
      title: pinPayload.title || shopifyProduct.title,
      description: pinPayload.description || shopifyProduct.description,
      link: this.getProductLinkWithProductId(shopifyProduct),
      alt_text: pinPayload.alt_text || imageAlt,
      media_source: {
        source_type: 'image_base64',
        content_type: 'image/png',
        data: buffer.toString('base64'),
      },
    }
  }

  public async getCroppedImageBuffer(shopifyProduct: ShopifyProduct): Promise<Buffer> {
    const { buffer } = await this.processImage(shopifyProduct)
    return buffer
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
