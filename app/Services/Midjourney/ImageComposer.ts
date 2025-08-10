import type { Background, Ratio } from 'Types/Midjourney'
import BackgroundSelector from './BackgroundSelector'
import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

export default class ImageComposer {
  private base64Image: string
  private savedImageFiles: string[] = []

  constructor(base64Image: string) {
    this.base64Image = base64Image.replace(/^data:image\/[a-z]+;base64,/, '')
  }

  private readonly UPLOAD_DIR = 'public/uploads'
  private readonly BASE_URL =
    process.env.NODE_ENV === 'test' ? '' : process.env.APP_URL || 'http://localhost:3333'

  private aspectRatioMap = {
    square: 1,
    portrait: 0.75,
    landscape: 1.33,
  }
  private readonly OPTIMAL_SIZES = {
    square: { width: 640, height: 640, maxSizeKB: 300 },
    portrait: { width: 600, height: 800, maxSizeKB: 400 },
    landscape: { width: 800, height: 600, maxSizeKB: 400 },
  }

  private async applyCanvasTexture(imageBuffer: Buffer): Promise<Buffer> {
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()
    const width = metadata.width || 100
    const height = metadata.height || 100

    // Load the canvas texture and get its dimensions
    const texturePath = 'public/texture/texture-canvas.png'

    // Create a tiled texture by repeating the original texture
    const tiledTexture = await sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    })
      .composite([
        {
          input: texturePath,
          tile: true,
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer()

    // Composite the texture over the image
    const texturedImage = image.composite([
      {
        input: tiledTexture,
        top: 0,
        left: 0,
        blend: 'overlay',
      },
    ])

    return texturedImage.toBuffer()
  }

  private calculateAspectRatioDimensions(width: number, height: number, targetRatio: number) {
    const currentAspectRatio = width / height

    // If aspect ratio is already close to target, return original dimensions
    if (Math.abs(currentAspectRatio - targetRatio) < 0.01) {
      return { targetWidth: width, targetHeight: height }
    }

    let targetWidth: number
    let targetHeight: number

    if (currentAspectRatio > targetRatio) {
      targetWidth = Math.round(height * targetRatio)
      targetHeight = height
    } else {
      targetWidth = width
      targetHeight = Math.round(width / targetRatio)
    }

    return { targetWidth, targetHeight }
  }

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

  private async createFrame(imageBuffer: Buffer): Promise<Buffer> {
    const FRAME_THICKNESS = 10
    const texturePath = 'public/texture/texture-light-oak.png'
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()
    const width = metadata.width || 100
    const height = metadata.height || 100
    const horizontalFrame = await sharp(texturePath).resize(width, FRAME_THICKNESS).toBuffer()
    const verticalTexture = await sharp(texturePath).rotate(90).toBuffer()
    const verticalFrame = await sharp(verticalTexture).resize(FRAME_THICKNESS, height).toBuffer()
    const resizedTexture = await sharp(texturePath)
      .resize(FRAME_THICKNESS, FRAME_THICKNESS)
      .toBuffer()
    function triangleSVG(width: number, height: number) {
      return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 ${width},0 0,${height}" fill="#fff"/></svg>`
    }
    const cornerTL = await sharp(Buffer.from(triangleSVG(FRAME_THICKNESS, FRAME_THICKNESS)))
      .composite([{ input: resizedTexture, left: 0, top: 0 }])
      .png()
      .toBuffer()
    const cornerTR = await sharp(Buffer.from(triangleSVG(FRAME_THICKNESS, FRAME_THICKNESS)))
      .rotate(90)
      .composite([{ input: resizedTexture, left: 0, top: 0 }])
      .png()
      .toBuffer()
    const cornerBL = await sharp(Buffer.from(triangleSVG(FRAME_THICKNESS, FRAME_THICKNESS)))
      .rotate(-90)
      .composite([{ input: resizedTexture, left: 0, top: 0 }])
      .png()
      .toBuffer()
    const cornerBR = await sharp(Buffer.from(triangleSVG(FRAME_THICKNESS, FRAME_THICKNESS)))
      .rotate(180)
      .composite([{ input: resizedTexture, left: 0, top: 0 }])
      .png()
      .toBuffer()
    const framedImage = sharp({
      create: {
        width: width + 2 * FRAME_THICKNESS,
        height: height + 2 * FRAME_THICKNESS,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).composite([
      { input: cornerTL, top: 0, left: 0 },
      { input: cornerTR, top: 0, left: width + FRAME_THICKNESS },
      { input: cornerBL, top: height + FRAME_THICKNESS, left: 0 },
      { input: cornerBR, top: height + FRAME_THICKNESS, left: width + FRAME_THICKNESS },
      { input: horizontalFrame, top: 0, left: FRAME_THICKNESS },
      { input: horizontalFrame, top: height + FRAME_THICKNESS, left: FRAME_THICKNESS },
      { input: verticalFrame, top: FRAME_THICKNESS, left: 0 },
      { input: verticalFrame, top: FRAME_THICKNESS, left: width + FRAME_THICKNESS },
      { input: imageBuffer, top: FRAME_THICKNESS, left: FRAME_THICKNESS },
    ])
    return framedImage.png().toBuffer()
  }

  private async createInternalFrameShadow(
    imageBuffer: Buffer,
    width: number,
    height: number
  ): Promise<Buffer> {
    const frameShadowThickness = 8
    const frameShadowBlur = 12
    const frameShadowOpacity = 0.18
    const leftShadowSVG = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${frameShadowThickness}" height="${height}" fill="black" fill-opacity="${frameShadowOpacity}"/></svg>`
    const topShadowSVG = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${width}" height="${frameShadowThickness}" fill="black" fill-opacity="${frameShadowOpacity}"/></svg>`
    const leftShadow = await sharp(Buffer.from(leftShadowSVG))
      .blur(frameShadowBlur)
      .png()
      .toBuffer()
    const topShadow = await sharp(Buffer.from(topShadowSVG)).blur(frameShadowBlur).png().toBuffer()
    return await sharp(imageBuffer)
      .composite([
        { input: leftShadow, left: 0, top: 0 },
        { input: topShadow, left: 0, top: 0 },
      ])
      .png()
      .toBuffer()
  }

  private async createBottomPaintingEdge(imageBuffer: Buffer): Promise<Buffer> {
    // Get image dimensions
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()
    const width = metadata.width || 100

    // Create SVG with skewed bottom edge for 3D canvas effect
    const bottomEdgeSVG = `
      <svg width="${width + 6}" height="2" viewBox="0 0 ${width + 6} 2" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0H${width}L${width + 6} 2H6L0 0Z" fill="#D7D7D7" opacity="0.5"/>
      </svg>
    `

    // Convert SVG to buffer
    const svgBuffer = Buffer.from(bottomEdgeSVG, 'utf-8')

    // Apply canvas texture to the bottom edge
    return await this.applyCanvasTextureToEdge(svgBuffer, width + 6, 2)
  }

  private async createRightPaintingEdge(imageBuffer: Buffer): Promise<Buffer> {
    // Get image dimensions
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()
    const height = metadata.height || 100

    // Create SVG with skewed right edge for 3D canvas effect
    const rightEdgeSVG = `
      <svg width="4" height="${height + 2}" viewBox="0 0 4 ${height + 2}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0H2L2 ${height + 2}H0L0 0Z" fill="#D7D7D7" opacity="0.5"/>
      </svg>
    `

    // Convert SVG to buffer
    const svgBuffer = Buffer.from(rightEdgeSVG, 'utf-8')

    // Apply canvas texture to the right edge
    return await this.applyCanvasTextureToEdge(svgBuffer, 4, height + 2)
  }

  private async applyCanvasTextureToEdge(
    svgBuffer: Buffer,
    width: number,
    height: number
  ): Promise<Buffer> {
    const rasterEdge = await sharp(svgBuffer).resize(width, height).png().toBuffer()
    const texturePath = 'public/texture/texture-canvas.png'

    const resizedTexture = await sharp(texturePath)
      .resize(Math.min(width, 50), Math.min(height, 50))
      .png()
      .toBuffer()

    const tiledTexture = await sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    })
      .composite([
        {
          input: resizedTexture,
          tile: true,
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer()

    const edgeWithTexture = sharp(rasterEdge).composite([
      {
        input: tiledTexture,
        top: 0,
        left: 0,
        blend: 'overlay',
      },
    ])

    return edgeWithTexture.toBuffer()
  }

  private async createExternalShadow(imageBuffer: Buffer): Promise<Buffer> {
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()
    const width = metadata.width || 100
    const height = metadata.height || 100

    // Shadow parameters
    const SHADOW_MARGIN = 30
    const SHADOW_BLUR = 6
    const SHADOW_X_OFFSET = -20
    const SHADOW_Y_OFFSET = -20
    const SHADOW_OPACITY = 0.25

    // Create SVG shadow rectangle
    const shadow = await sharp(
      Buffer.from(`
        <svg
          width="${width + SHADOW_MARGIN * 2}"
          height="${height + SHADOW_MARGIN * 2}"
        >
          <rect
            width="${width}"
            height="${height}"
            x="${SHADOW_MARGIN + SHADOW_X_OFFSET}"
            y="${SHADOW_MARGIN + SHADOW_Y_OFFSET}"
            fill="rgba(0, 0, 0, ${SHADOW_OPACITY})"
          />
        </svg>`)
    )
      .blur(SHADOW_BLUR)
      .png()
      .toBuffer()

    return shadow
  }

  private async createTopLayer(background: Background): Promise<Buffer> {
    if (!background.topLayer) {
      return Buffer.from('')
    }

    const topLayer = sharp(`public/backgrounds/${background.topLayer}`)
    const topLayerBuffer = await topLayer.toBuffer()
    return topLayerBuffer
  }

  private extractUploadsPath(url: string): string {
    // Normalize to forward slashes
    const normalized = url.replace(/\\/g, '/')
    // Extract only 'uploads/filename.jpg'
    const match = normalized.match(/uploads\/[^/]+$/)
    return match ? match[0] : normalized
  }

  public async getImagesWithBackground(
    mainImageUrl: string,
    ratio: Ratio,
    descriptionHtml: string
  ): Promise<string[]> {
    const backgroundSelector = new BackgroundSelector()
    try {
      const backgrounds = await backgroundSelector.getBackgrounds(mainImageUrl, descriptionHtml)
      const newImageUrlsPromises = backgrounds.map(async (background, idx) => {
        const composedImageBuffer = await this.composeImageWithBackground(
          background,
          ratio,
          idx === 1 // showFrame only for the second background
        )
        const newImageUrl = await this.saveImageLocally(composedImageBuffer)
        return newImageUrl
      })
      const newImageUrls = await Promise.all(newImageUrlsPromises)
      return newImageUrls
    } catch (error: any) {
      console.warn(`Failed to process base64 image: ${error.message}`)
      throw error
    }
  }

  public async getMainImage(ratio: Ratio): Promise<string> {
    try {
      let imageBuffer = await this.formatImageToRatio(ratio)
      const newImageUrl = await this.saveImageLocally(imageBuffer)
      return newImageUrl
    } catch (error: any) {
      console.warn(`Failed to process base64 image: ${error.message}`)
      throw error
    }
  }

  public async getOptimizedImage(ratio: Ratio): Promise<string> {
    try {
      const imageBuffer = await this.optimizeImageToBuffer(ratio)
      const newImageUrl = await this.saveImageLocally(imageBuffer)
      return newImageUrl
    } catch (error: any) {
      console.warn(`Failed to process base64 image: ${error.message}`)
      throw error
    }
  }

  private async formatImageToRatio(ratio: Ratio): Promise<Buffer> {
    let image: sharp.Sharp
    try {
      const imageBuffer = Buffer.from(this.base64Image, 'base64')
      image = sharp(imageBuffer)
    } catch (error: any) {
      throw new Error(`Failed to process base64 image: ${error.message}`)
    }

    const { width, height } = await image.metadata()

    if (!width || !height) {
      throw new Error('Invalid image dimensions')
    }

    let targetWidth: number
    let targetHeight: number

    if (ratio === 'square') {
      const minDimension = Math.min(width, height)
      targetWidth = minDimension
      targetHeight = minDimension
    } else {
      const aspectRatioExpected = this.aspectRatioMap[ratio]
      const result = this.calculateAspectRatioDimensions(width, height, aspectRatioExpected)
      targetWidth = result.targetWidth
      targetHeight = result.targetHeight
    }

    const resizedImage = image.resize(targetWidth, targetHeight, {
      fit: 'cover',
      position: 'center',
    })

    return resizedImage.toBuffer()
  }

  public async replaceSrcName(src: string, filename: string) {
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
    return newSrc
  }

  private async resizeImage(expectedWidth: number, expectedHeight: number): Promise<Buffer> {
    const imageBuffer = Buffer.from(this.base64Image, 'base64')
    const image = sharp(imageBuffer)
    const resizedImage = image.resize(expectedWidth, expectedHeight, {
      fit: 'cover',
      position: 'center',
    })
    return resizedImage.toBuffer()
  }

  private async optimizeImageToBuffer(ratio: Ratio): Promise<Buffer> {
    let image: sharp.Sharp
    try {
      const imageBuffer = Buffer.from(this.base64Image, 'base64')
      image = sharp(imageBuffer)
    } catch (error: any) {
      throw new Error(`Failed to process base64 image: ${error.message}`)
    }

    const { width, height } = await image.metadata()

    if (!width || !height) {
      throw new Error('Invalid image dimensions')
    }

    const optimalSize = this.OPTIMAL_SIZES[ratio]
    let targetWidth = optimalSize.width
    let targetHeight = optimalSize.height

    const resizedImage = image.resize(targetWidth, targetHeight, {
      fit: 'cover',
      position: 'center',
    })

    const optimizedBuffer = await this.optimizeImageQuality(resizedImage, optimalSize.maxSizeKB)

    return optimizedBuffer
  }

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

  private async saveImageLocally(imageBuffer: Buffer): Promise<string> {
    await fs.mkdir(this.UPLOAD_DIR, { recursive: true })

    const filename = `${randomUUID()}.jpg`
    const filepath = path.join(this.UPLOAD_DIR, filename)

    await fs.writeFile(filepath, imageBuffer)
    this.savedImageFiles.push(filepath)
    // Return a valid public URL (no 'public/', always forward slashes)
    return `${this.BASE_URL}/uploads/${filename}`
  }

  private async composeImageWithBackground(
    background: Background,
    ratio: Ratio,
    showFrame = false
  ) {
    const position = background[ratio]
    const imageBuffer = await this.resizeImage(position.width, position.height)
    const texturedImageBuffer = await this.applyCanvasTexture(imageBuffer)
    let mainImageBuffer: Buffer = texturedImageBuffer
    let shadowBuffer: Buffer | undefined
    let bottomEdgeBuffer: Buffer | undefined
    let rightEdgeBuffer: Buffer | undefined
    if (showFrame) {
      mainImageBuffer = await this.createInternalFrameShadow(
        texturedImageBuffer,
        position.width,
        position.height
      )
      mainImageBuffer = await this.createFrame(mainImageBuffer)
      shadowBuffer = await this.createExternalShadow(mainImageBuffer)
    } else {
      shadowBuffer = await this.createExternalShadow(texturedImageBuffer)
      bottomEdgeBuffer = await this.createBottomPaintingEdge(texturedImageBuffer)
      rightEdgeBuffer = await this.createRightPaintingEdge(texturedImageBuffer)
    }
    const backgroundImage = sharp(`public/backgrounds/${background.path}`)
    const topLayerBuffer = await this.createTopLayer(background)
    const compositeOperations = [
      { input: shadowBuffer, top: position.y, left: position.x },
      ...(!showFrame
        ? [
            { input: bottomEdgeBuffer, top: position.y + position.height, left: position.x },
            { input: rightEdgeBuffer, top: position.y, left: position.x + position.width },
          ]
        : []),
      { input: mainImageBuffer, top: position.y, left: position.x },
    ]
    if (topLayerBuffer.length > 0) {
      compositeOperations.push({ input: topLayerBuffer, top: 0, left: 0 })
    }
    const finalImageBuffer = backgroundImage.composite(compositeOperations)
    return finalImageBuffer.toBuffer()
  }
}
