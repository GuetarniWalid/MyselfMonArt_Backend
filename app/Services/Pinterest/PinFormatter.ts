import type { Board, PinPayload } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'
import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import Pinterest from '../Claude/Pinterest'

export default class PinFormatter {
  private readonly UPLOAD_DIR = 'public/uploads'
  private readonly PUBLIC_URL = '/uploads'
  private readonly BASE_URL =
    process.env.NODE_ENV === 'test' ? '' : process.env.APP_URL || 'http://localhost:3333'

  public async buildPinPayload(shopifyProduct: ShopifyProduct, board: Board): Promise<PinPayload> {
    const { publicUrl, imageAlt } = await this.processAndUploadImage(shopifyProduct)
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
        url: publicUrl,
        source_type: 'image_url',
      },
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

  private async processAndUploadImage(shopifyProduct: ShopifyProduct) {
    const image = this.getImage(shopifyProduct.media.nodes)
    const imageUrl = image.image!.url
    const imageBuffer = await this.downloadImage(imageUrl)
    const croppedBuffer = await this.cropImage(imageBuffer)
    const publicUrl = await this.saveImageLocally(croppedBuffer)
    return { publicUrl, imageAlt: image.alt }
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
    const croppedImage = await image.resize(1000, 1500, { fit: 'cover' }).png().toBuffer()
    return croppedImage
  }

  private async saveImageLocally(imageBuffer: Buffer): Promise<string> {
    // Ensure upload directory exists
    await fs.mkdir(this.UPLOAD_DIR, { recursive: true })

    // Generate unique filename
    const filename = `${randomUUID()}.png`
    const filepath = path.join(this.UPLOAD_DIR, filename)

    // Save the file
    await fs.writeFile(filepath, imageBuffer)

    // Return URL (relative in test, full in production)
    return `${this.BASE_URL}${this.PUBLIC_URL}/${filename}`
  }

  public async removeImage(imageUrl: string): Promise<void> {
    try {
      // Extract filename from URL
      const filename = path.basename(imageUrl)
      const filepath = path.join(this.UPLOAD_DIR, filename)

      // Check if file exists
      await fs.access(filepath)

      // Remove file
      await fs.unlink(filepath)
    } catch (error) {
      // If file doesn't exist or can't be removed, log error but don't throw
      console.error(`Failed to remove image ${imageUrl}:`, error)
    }
  }

  private getProductLinkWithProductId(shopifyProduct: ShopifyProduct): string {
    const url = new URL(shopifyProduct.onlineStoreUrl)
    url.searchParams.set('shopify_product_id', shopifyProduct.id)
    return url.toString()
  }
}
