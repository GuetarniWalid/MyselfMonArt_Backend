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
  maxWidth?: number // Explicit max-width override; default is orientation-aware
  maxHeight?: number // Explicit max-height override; default is orientation-aware
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

    // Orientation-aware cap: a vertical (9:16) source keeps 1080x1920 — it is no
    // longer squeezed into a landscape box and downscaled — while landscape
    // stays 1920x1080 and square becomes 1080x1080. Explicit maxWidth/maxHeight
    // passed by the caller still take precedence.
    const { maxWidth, maxHeight } = await this.resolveMaxDimensions(
      inputPath,
      options.maxWidth,
      options.maxHeight
    )

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
   * Resolve the scaling box. Explicit caller dimensions win (escape hatch /
   * backwards compatibility). Otherwise probe the source and pick a box that
   * matches its orientation, so the longer edge caps at 1920 and the shorter at
   * 1080 — keeping vertical 9:16 sources at full 1080x1920. Falls back to the
   * historical landscape cap if ffprobe is unavailable.
   */
  private async resolveMaxDimensions(
    inputPath: string,
    explicitWidth?: number,
    explicitHeight?: number
  ): Promise<{ maxWidth: number; maxHeight: number }> {
    if (explicitWidth && explicitHeight) {
      return { maxWidth: explicitWidth, maxHeight: explicitHeight }
    }

    const dims = await this.probeVideoDimensions(inputPath)
    if (!dims) {
      return { maxWidth: this.DEFAULT_MAX_WIDTH, maxHeight: this.DEFAULT_MAX_HEIGHT }
    }

    const LONG_EDGE = 1920
    const SHORT_EDGE = 1080
    if (dims.height > dims.width) return { maxWidth: SHORT_EDGE, maxHeight: LONG_EDGE }
    if (dims.width > dims.height) return { maxWidth: LONG_EDGE, maxHeight: SHORT_EDGE }
    return { maxWidth: SHORT_EDGE, maxHeight: SHORT_EDGE }
  }

  /**
   * Read the source's displayed video dimensions via ffprobe. Accounts for
   * rotation metadata (a 90/270° rotation swaps the displayed orientation
   * relative to the stored width/height). Returns null on any failure so the
   * caller can fall back gracefully.
   */
  private async probeVideoDimensions(
    inputPath: string
  ): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          console.warn(`   ⚠️  ffprobe failed, using default cap: ${err.message}`)
          resolve(null)
          return
        }
        const stream = metadata.streams?.find((s) => s.codec_type === 'video')
        if (!stream?.width || !stream?.height) {
          resolve(null)
          return
        }
        const rawRotation =
          (stream as any).rotation ?? (stream.tags && (stream.tags as any).rotate) ?? 0
        const swap = Math.abs(Number(rawRotation)) % 180 === 90
        resolve(
          swap
            ? { width: stream.height, height: stream.width }
            : { width: stream.width, height: stream.height }
        )
      })
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
