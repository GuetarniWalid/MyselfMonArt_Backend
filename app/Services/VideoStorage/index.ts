import Drive from '@ioc:Adonis/Core/Drive'
import Env from '@ioc:Adonis/Core/Env'
import fs from 'fs'

interface UploadResult {
  success: boolean
  url: string
  key: string
  error?: string
}

export default class VideoStorage {
  private readonly VIDEOS_FOLDER = 'videos'
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY_MS = 2000

  // Track products currently being uploaded to prevent race conditions with webhooks
  private static uploadsInProgress = new Set<string>()

  /**
   * Extract numeric product ID from various formats
   * Handles: "123", "gid://shopify/Product/123"
   */
  private static cleanProductId(productId: string): string {
    return productId.replace('gid://shopify/Product/', '')
  }

  /**
   * Generate the storage key for a product video
   * Format: videos/{productId}.mp4
   */
  private getStorageKey(productId: string): string {
    return `${this.VIDEOS_FOLDER}/${VideoStorage.cleanProductId(productId)}.mp4`
  }

  /**
   * Get the CDN URL for a product video
   */
  public getVideoUrl(productId: string): string {
    const key = this.getStorageKey(productId)
    const cdnEndpoint = Env.get('DO_SPACES_CDN_ENDPOINT')
    if (!cdnEndpoint) {
      throw new Error('DO_SPACES_CDN_ENDPOINT environment variable is not configured')
    }
    return `${cdnEndpoint}/${key}`
  }

  /**
   * Check if an upload is currently in progress for a product
   */
  public static isUploadInProgress(productId: string): boolean {
    return VideoStorage.uploadsInProgress.has(VideoStorage.cleanProductId(productId))
  }

  /**
   * Upload a video file to Digital Ocean Spaces with retry logic
   * @param productId - Shopify product ID (with or without gid:// prefix)
   * @param localFilePath - Path to the local video file
   * @returns Upload result with CDN URL
   */
  public async upload(productId: string, localFilePath: string): Promise<UploadResult> {
    const key = this.getStorageKey(productId)
    const cleanId = VideoStorage.cleanProductId(productId)

    console.log(`📤 Uploading video to DO Spaces...`)
    console.log(`   📁 Local file: ${localFilePath}`)
    console.log(`   🔑 Storage key: ${key}`)

    // Mark upload as in progress to prevent race conditions with webhooks
    VideoStorage.uploadsInProgress.add(cleanId)

    try {
      // Validate local file exists
      if (!fs.existsSync(localFilePath)) {
        return {
          success: false,
          url: '',
          key,
          error: `Local file not found: ${localFilePath}`,
        }
      }

      // Read file as buffer
      const fileBuffer = fs.readFileSync(localFilePath)
      const fileSize = fs.statSync(localFilePath).size

      console.log(`   📊 File size: ${this.formatFileSize(fileSize)}`)

      // Upload to DO Spaces with retry logic
      let lastError: Error | null = null
      for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
        try {
          await Drive.use('spaces').put(key, fileBuffer, {
            contentType: 'video/mp4',
            visibility: 'public',
          })

          const cdnUrl = this.getVideoUrl(productId)
          console.log(`   ✅ Upload complete`)
          console.log(`   🔗 CDN URL: ${cdnUrl}`)

          return {
            success: true,
            url: cdnUrl,
            key,
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          console.warn(
            `   ⚠️  Upload attempt ${attempt}/${this.MAX_RETRIES} failed: ${lastError.message}`
          )

          if (attempt < this.MAX_RETRIES) {
            const delay = this.RETRY_DELAY_MS * attempt
            console.log(`   ⏳ Retrying in ${delay}ms...`)
            await this.sleep(delay)
          }
        }
      }

      // All retries exhausted
      const errorMsg = lastError?.message || 'Unknown error'
      console.error(`   ❌ Upload failed after ${this.MAX_RETRIES} attempts: ${errorMsg}`)

      return {
        success: false,
        url: '',
        key,
        error: errorMsg,
      }
    } finally {
      // Always remove from in-progress set when done
      VideoStorage.uploadsInProgress.delete(cleanId)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Delete a video from Digital Ocean Spaces
   * @param productId - Shopify product ID (with or without gid:// prefix)
   */
  public async delete(productId: string): Promise<boolean> {
    const key = this.getStorageKey(productId)

    console.log(`🗑️  Deleting video from DO Spaces...`)
    console.log(`   🔑 Storage key: ${key}`)

    try {
      // Check if file exists before attempting deletion
      const exists = await this.exists(productId)
      if (!exists) {
        console.log(`   ℹ️  Video does not exist, nothing to delete`)
        return true
      }

      await Drive.use('spaces').delete(key)
      console.log(`   ✅ Video deleted successfully`)
      return true
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`   ❌ Delete failed: ${errorMsg}`)
      return false
    }
  }

  /**
   * Check if a video exists in Digital Ocean Spaces
   * @param productId - Shopify product ID (with or without gid:// prefix)
   */
  public async exists(productId: string): Promise<boolean> {
    const key = this.getStorageKey(productId)

    try {
      const exists = await Drive.use('spaces').exists(key)
      return exists
    } catch (error) {
      // If we get an error checking existence, assume it doesn't exist
      return false
    }
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
}
