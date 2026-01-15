import type { Ratio } from 'Types/ShopifyProductPublisher'
import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import Env from '@ioc:Adonis/Core/Env'

export default class ImageComposer {
  private savedImageFiles: string[] = []

  private readonly UPLOAD_DIR = 'public/uploads'
  private readonly BASE_URL =
    process.env.NODE_ENV === 'test' ? '' : process.env.APP_URL || 'http://localhost:3333'

  private readonly OPTIMAL_SIZES = {
    square: { width: 640, height: 640, maxSizeKB: 300 },
    portrait: { width: 600, height: 800, maxSizeKB: 400 },
    landscape: { width: 800, height: 600, maxSizeKB: 400 },
  }

  /**
   * Process a single image from the images array (with compression for AI calls)
   * @param base64Image - The base64 encoded image
   * @param ratio - The ratio (portrait/landscape/square)
   * @returns URL of the optimized and saved image
   */
  public async processImage(base64Image: string, ratio: Ratio): Promise<string> {
    try {
      // Remove data URI prefix - handle both "data:image/..." and "data:application/octet-stream"
      const cleanBase64 = base64Image.replace(
        /^data:(image\/[a-z]+|application\/octet-stream);base64,/,
        ''
      )

      // Optimize the image (always outputs JPEG)
      const imageBuffer = await this.optimizeBase64Image(cleanBase64, ratio)

      // Save locally as JPEG (optimization always converts to JPEG)
      const imageUrl = await this.saveImageLocally(imageBuffer, 'jpg')

      // Replace URL for development if needed
      return this.replaceUrlForDevelopment(imageUrl)
    } catch (error: any) {
      console.warn(`Failed to process image: ${error.message}`)
      throw error
    }
  }

  /**
   * Save original image without compression (for Shopify publication)
   * @param base64Image - The base64 encoded image
   * @returns URL of the original saved image
   */
  public async saveOriginalImage(base64Image: string): Promise<string> {
    try {
      // Remove data URI prefix - handle both "data:image/..." and "data:application/octet-stream"
      const cleanBase64 = base64Image.replace(
        /^data:(image\/[a-z]+|application\/octet-stream);base64,/,
        ''
      )

      // Extract format from original data URI to save with correct extension
      let format = 'jpg'
      const formatMatch = base64Image.match(/^data:image\/([a-z]+);base64,/)
      if (formatMatch) {
        format = formatMatch[1]
      }

      // Convert to buffer WITHOUT any processing - save original as-is
      const imageBuffer = Buffer.from(cleanBase64, 'base64')

      // Save locally with original format (no compression, no re-encoding)
      const imageUrl = await this.saveImageLocally(imageBuffer, format)

      // Replace URL for development if needed
      return this.replaceUrlForDevelopment(imageUrl)
    } catch (error: any) {
      console.warn(`Failed to save original image: ${error.message}`)
      throw error
    }
  }

  /**
   * Compress image and return as base64 data URI (for AI calls)
   * @param base64Image - The base64 encoded image
   * @param ratio - The ratio (portrait/landscape/square)
   * @returns Base64 data URI of the compressed image
   */
  public async compressImageToDataUri(base64Image: string, ratio: Ratio): Promise<string> {
    try {
      // Remove data URI prefix - handle both "data:image/..." and "data:application/octet-stream"
      const cleanBase64 = base64Image.replace(
        /^data:(image\/[a-z]+|application\/octet-stream);base64,/,
        ''
      )

      // Optimize the image
      const imageBuffer = await this.optimizeBase64Image(cleanBase64, ratio)

      // Convert to base64 data URI
      const base64Data = imageBuffer.toString('base64')
      return `data:image/jpeg;base64,${base64Data}`
    } catch (error: any) {
      console.warn(`Failed to compress image: ${error.message}`)
      throw error
    }
  }

  /**
   * Optimize a base64 image without composition
   */
  private async optimizeBase64Image(base64Image: string, ratio: Ratio): Promise<Buffer> {
    let image: sharp.Sharp
    try {
      const imageBuffer = Buffer.from(base64Image, 'base64')
      image = sharp(imageBuffer)
    } catch (error: any) {
      throw new Error(`Failed to process base64 image: ${error.message}`)
    }

    const { width, height } = await image.metadata()

    if (!width || !height) {
      throw new Error('Invalid image dimensions')
    }

    const optimalSize = this.OPTIMAL_SIZES[ratio]
    const targetWidth = optimalSize.width
    const targetHeight = optimalSize.height

    const resizedImage = image.resize(targetWidth, targetHeight, {
      fit: 'cover',
      position: 'center',
    })

    return await this.optimizeImageQuality(resizedImage, optimalSize.maxSizeKB)
  }

  /**
   * Optimize image quality to target file size
   */
  private async optimizeImageQuality(image: sharp.Sharp, maxSizeKB: number): Promise<Buffer> {
    let quality = 90
    let buffer: Buffer

    // try to reach the target size with different qualities
    while (quality > 10) {
      buffer = await image.jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer()

      const sizeKB = buffer.length / 1024

      // if the size is acceptable, return the buffer
      if (sizeKB <= maxSizeKB) {
        return buffer
      }

      // reduce the quality and try again
      quality -= 10
    }

    // if we can't reach the target size, return with the base quality (90)
    console.warn(`Could not reach target size of ${maxSizeKB}KB, using base quality (90)`)
    return await image.jpeg({ quality: 90, progressive: true, mozjpeg: true }).toBuffer()
  }

  /**
   * Save image buffer to disk and return public URL
   */
  private async saveImageLocally(imageBuffer: Buffer, format: string = 'jpg'): Promise<string> {
    await fs.mkdir(this.UPLOAD_DIR, { recursive: true })

    const filename = `${randomUUID()}.${format}`
    const filepath = path.join(this.UPLOAD_DIR, filename)

    await fs.writeFile(filepath, imageBuffer)
    this.savedImageFiles.push(filepath)

    // Return a valid public URL
    return `${this.BASE_URL}/uploads/${filename}`
  }

  /**
   * Replace source filename with SEO-friendly name
   */
  public async replaceSrcName(src: string, filename: string): Promise<string> {
    let relativePath = this.extractUploadsPath(src)
    if (!relativePath.startsWith('public/')) {
      relativePath = path.join('public', relativePath)
    }

    const ext = path.extname(relativePath)
    // Sanitize the base filename: allow only alphanumeric, dash, underscore
    let base = filename.replace(/\.[^/.]+$/, '')
    base = base.replace(/[^a-zA-Z0-9-_]/g, '-')

    const uniqueId = randomUUID()
    const newFilename = `${base}-${uniqueId}${ext}`
    const newPath = path.join(this.UPLOAD_DIR, newFilename)

    await fs.rename(relativePath, newPath)
    this.savedImageFiles.push(newPath)

    const newSrc = `${this.BASE_URL}/uploads/${newFilename}`
    return this.replaceUrlForDevelopment(newSrc)
  }

  /**
   * Clean up all saved image files
   */
  public async cleanupSavedImages(): Promise<void> {
    const cleanupPromises = this.savedImageFiles.map(async (filePath) => {
      try {
        // Check if file exists before deleting
        await fs.access(filePath)
        await fs.unlink(filePath)
        console.log(`Cleaned up image file: ${filePath}`)
      } catch (error: any) {
        // Do nothing if file does not exist
        if (error.code !== 'ENOENT') {
          console.warn(`Failed to delete image file ${filePath}:`, error.message)
        }
        // If ENOENT, silently ignore
      }
    })

    await Promise.all(cleanupPromises)
    this.savedImageFiles = [] // Clear the array after cleanup
  }

  /**
   * Extract uploads path from URL
   */
  private extractUploadsPath(url: string): string {
    // Normalize to forward slashes
    const normalized = url.replace(/\\/g, '/')
    // Extract only 'uploads/filename.jpg'
    const match = normalized.match(/uploads\/[^/]+$/)
    return match ? match[0] : normalized
  }

  /**
   * Replace URL for development environment
   */
  private replaceUrlForDevelopment(url: string): string {
    if (Env.get('NODE_ENV') === 'development') {
      const ngrokUrl = Env.get('NGROK_URL')
      if (ngrokUrl) {
        // Replace the actual BASE_URL being used (not APP_URL from env)
        return url.replace(this.BASE_URL, ngrokUrl)
      }
    }
    return url
  }
}
