import type { Board, PinPayload } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'
import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import Pinterest from '../ChatGPT/Pinterest'

export default class PinFormatter {
  private readonly UPLOAD_DIR = 'public/uploads'
  private readonly PUBLIC_URL = '/uploads'
  private readonly BASE_URL =
    process.env.NODE_ENV === 'test' ? '' : process.env.APP_URL || 'http://localhost:3333'

  public async buildPinPayload(shopifyProduct: ShopifyProduct, board: Board): Promise<PinPayload> {
    const { publicUrl, imageAlt } = await this.processAndUploadImage(shopifyProduct, board)
    const pinterest = new Pinterest()
    const pinPayload = await pinterest.pinAI.buildPinPayload(shopifyProduct, imageAlt, board)

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

  private async processAndUploadImage(shopifyProduct: ShopifyProduct, board: Board) {
    const image = this.getImage(shopifyProduct.media.nodes)
    const imageUrl = image.image!.url
    const imageBuffer = await this.downloadImage(imageUrl)
    const croppedBuffer = await this.cropImage(imageBuffer)
    const styledBuffer = await this.addBorder(croppedBuffer, board)
    const publicUrl = await this.saveImageLocally(styledBuffer)
    return { publicUrl, imageAlt: image.alt }
  }

  private getImage(images: ShopifyProduct['media']['nodes']) {
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('No image found')
    }
    const imageList = images.filter((image) => image.mediaContentType === 'IMAGE')
    if (imageList.length === 0) {
      throw new Error('No valid image found')
    }

    const image = imageList[2] || imageList[0]
    if (!image.image || !image.image.url) {
      throw new Error('Image object or image URL is undefined')
    }
    return image
  }

  private async downloadImage(imageUrl: string): Promise<Buffer> {
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()
    return Buffer.from(buffer)
  }

  private async cropImage(imageBuffer: Buffer): Promise<Buffer> {
    const image = sharp(imageBuffer)
    const croppedImage = await image.resize(1000, 1500, { fit: 'cover' }).toBuffer()
    return croppedImage
  }

  private async addBorder(imageBuffer: Buffer, board: Board): Promise<Buffer> {
    const borderColor = this.chooseBorderColor(board)
    const offset = 50
    const strokeWidth = 15

    // Load image from buffer
    const image = sharp(imageBuffer)
    const { width, height } = await image.metadata()

    if (!width || !height) {
      throw new Error('Invalid image dimensions')
    }

    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${offset}" y="${offset}"
            width="${width - 2 * offset}"
            height="${height - 2 * offset}"
            fill="none"
            stroke="rgba(${borderColor.r}, ${borderColor.g}, ${borderColor.b}, ${borderColor.alpha})"
            stroke-width="${strokeWidth}"
            vector-effect="non-scaling-stroke"/>
    </svg>`

    const overlay = Buffer.from(svg)

    const outputBuffer = await image
      .composite([{ input: overlay, blend: 'over' }])
      .png()
      .toBuffer()

    return outputBuffer
  }

  private chooseBorderColor(board: Board): {
    r: number
    g: number
    b: number
    alpha: number
  } {
    const defaultColor = { r: 0, g: 0, b: 0, alpha: 0 }
    if (!board.description) {
      return defaultColor
    }

    const colorPattern = /Ref:\s*(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/i
    const match = board.description.match(colorPattern)

    if (!match) {
      return defaultColor
    }

    const r = Number(match[1])
    const g = Number(match[2])
    const b = Number(match[3])
    const a = match[4] !== undefined ? Number(match[4]) : 100

    return {
      r,
      g,
      b,
      alpha: a / 100,
    }
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
