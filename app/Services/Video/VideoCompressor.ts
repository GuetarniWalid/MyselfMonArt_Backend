import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'

interface CompressionResult {
  success: boolean
  outputPath: string
  originalSize: number
  compressedSize: number
  compressionRatio: number
  duration?: number // Compression duration in seconds
  error?: string
}

interface CompressionOptions {
  crf?: number // Constant Rate Factor (18-28, lower = better quality), default 23
  preset?: string // Encoding speed (ultrafast, fast, medium, slow), default 'medium'
  maxWidth?: number // Max width for scaling, default 1920
  maxHeight?: number // Max height for scaling, default 1080
  timeout?: number // Timeout in milliseconds, default 10 minutes
}

export default class VideoCompressor {
  private readonly DEFAULT_CRF = 23
  private readonly DEFAULT_PRESET = 'medium'
  private readonly DEFAULT_MAX_WIDTH = 1920
  private readonly DEFAULT_MAX_HEIGHT = 1080
  private readonly DEFAULT_TIMEOUT = 10 * 60 * 1000 // 10 minutes

  /**
   * Compress a video file using FFmpeg with H.264 codec
   * @param inputPath - Path to the input video file
   * @param options - Compression options (CRF, preset, max dimensions)
   * @returns Promise with compression result
   */
  public async compressVideo(
    inputPath: string,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const {
      crf = this.DEFAULT_CRF,
      preset = this.DEFAULT_PRESET,
      maxWidth = this.DEFAULT_MAX_WIDTH,
      maxHeight = this.DEFAULT_MAX_HEIGHT,
      timeout = this.DEFAULT_TIMEOUT,
    } = options

    const startTime = Date.now()

    // Validate input file exists
    if (!fs.existsSync(inputPath)) {
      return {
        success: false,
        outputPath: inputPath,
        originalSize: 0,
        compressedSize: 0,
        compressionRatio: 1,
        error: `Input file not found: ${inputPath}`,
      }
    }

    const originalSize = fs.statSync(inputPath).size
    const dir = path.dirname(inputPath)
    const inputExt = path.extname(inputPath)
    const basename = path.basename(inputPath, inputExt)

    // Always output as .mp4 for H.264 compatibility (even if input is .mov)
    const outputExt = '.mp4'
    const tempOutputPath = path.join(dir, `${basename}_compressed${outputExt}`)
    const finalOutputPath = path.join(dir, `${basename}${outputExt}`)

    console.log(`🎬 Starting video compression...`)
    console.log(`   📁 Input: ${inputPath}`)
    console.log(`   📊 Original size: ${this.formatFileSize(originalSize)}`)
    console.log(`   ⚙️  Settings: CRF=${crf}, preset=${preset}, max=${maxWidth}x${maxHeight}`)

    return new Promise((resolve) => {
      let timeoutId: NodeJS.Timeout | null = null
      let ffmpegProcess: any = null

      // Set timeout to prevent hanging
      timeoutId = setTimeout(() => {
        console.error(`   ❌ FFmpeg timeout after ${timeout / 1000}s`)
        if (ffmpegProcess) {
          ffmpegProcess.kill('SIGKILL')
        }
      }, timeout)

      const clearTimeoutSafe = () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      }

      ffmpegProcess = ffmpeg(inputPath)
        .videoCodec('libx264')
        .outputOptions([
          `-crf ${crf}`,
          `-preset ${preset}`,
          // Scale down if larger than max dimensions, maintaining aspect ratio
          // Using scale2ref alternative: scale with -2 for auto-height maintaining aspect ratio
          // Scale down only if larger than max dimensions, preserving aspect ratio
          // force_original_aspect_ratio=decrease ensures no stretching
          `-vf scale=${maxWidth}:${maxHeight}:force_original_aspect_ratio=decrease`,
          // AAC audio codec for compatibility
          '-c:a aac',
          '-b:a 128k',
          // Fast start for web streaming
          '-movflags +faststart',
          // Overwrite output without asking
          '-y',
        ])
        .on('start', (commandLine) => {
          console.log(`   🚀 FFmpeg command: ${commandLine}`)
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            // Use console.log for Docker compatibility (no \r carriage return)
            const percent = Math.round(progress.percent)
            if (percent % 10 === 0) {
              // Log every 10%
              console.log(`   ⏳ Progress: ${percent}%`)
            }
          }
        })
        .on('end', () => {
          clearTimeoutSafe()
          const duration = (Date.now() - startTime) / 1000

          if (!fs.existsSync(tempOutputPath)) {
            console.error(`   ❌ Output file not found after compression`)
            resolve({
              success: false,
              outputPath: inputPath,
              originalSize,
              compressedSize: originalSize,
              compressionRatio: 1,
              duration,
              error: 'Output file not created',
            })
            return
          }

          const compressedSize = fs.statSync(tempOutputPath).size
          const compressionRatio = originalSize / compressedSize

          console.log(`   ✅ Compression complete in ${duration.toFixed(1)}s`)
          console.log(`   📊 Compressed size: ${this.formatFileSize(compressedSize)}`)
          console.log(`   📉 Compression ratio: ${compressionRatio.toFixed(2)}x`)
          console.log(
            `   💾 Saved: ${this.formatFileSize(originalSize - compressedSize)} (${((1 - compressedSize / originalSize) * 100).toFixed(1)}%)`
          )

          // Replace original with compressed
          try {
            // Delete original file
            fs.unlinkSync(inputPath)

            // Rename temp to final path (may be different extension)
            fs.renameSync(tempOutputPath, finalOutputPath)
            console.log(`   🔄 Replaced original with compressed version`)

            resolve({
              success: true,
              outputPath: finalOutputPath,
              originalSize,
              compressedSize,
              compressionRatio,
              duration,
            })
          } catch (replaceError) {
            const errorMsg =
              replaceError instanceof Error ? replaceError.message : String(replaceError)
            console.error(`   ❌ Failed to replace original file: ${errorMsg}`)

            // Clean up temp file if exists
            if (fs.existsSync(tempOutputPath)) {
              try {
                fs.unlinkSync(tempOutputPath)
              } catch (e) {
                // Ignore cleanup errors
              }
            }

            resolve({
              success: false,
              outputPath: inputPath,
              originalSize,
              compressedSize,
              compressionRatio,
              duration,
              error: `Failed to replace original: ${errorMsg}`,
            })
          }
        })
        .on('error', (err) => {
          clearTimeoutSafe()
          const duration = (Date.now() - startTime) / 1000
          console.error(`   ❌ FFmpeg error: ${err.message}`)

          // Clean up temp file if exists
          if (fs.existsSync(tempOutputPath)) {
            try {
              fs.unlinkSync(tempOutputPath)
            } catch (e) {
              // Ignore cleanup errors
            }
          }

          resolve({
            success: false,
            outputPath: inputPath,
            originalSize,
            compressedSize: originalSize,
            compressionRatio: 1,
            duration,
            error: err.message,
          })
        })
        .save(tempOutputPath)
    })
  }

  /**
   * Check if a file is a video based on extension
   */
  public isVideoFile(filePath: string): boolean {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
    const ext = path.extname(filePath).toLowerCase()
    return videoExtensions.includes(ext)
  }

  /**
   * Format file size in human-readable format
   */
  public formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }
}
