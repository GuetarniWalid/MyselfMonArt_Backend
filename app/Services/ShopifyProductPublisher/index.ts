import type { ExtensionRequest, Ratio, ImageType, ProductType } from 'Types/ShopifyProductPublisher'
import ImageComposer from './ImageComposer'

export default class ShopifyProductPublisher {
  private imageComposer: ImageComposer
  private images: Array<{ base64Image: string; mockupContext?: string; type: ImageType }>
  private ratio: Ratio
  private productType: ProductType
  private parentCollection: { id: string; title: string }

  constructor(request: ExtensionRequest) {
    this.imageComposer = new ImageComposer()
    this.images = request.images
    this.ratio = request.ratio
    this.productType = request.productType
    this.parentCollection = request.parentCollection
  }

  public async cleanupSavedImages(): Promise<void> {
    await this.imageComposer.cleanupSavedImages()
  }

  /**
   * Get the index of the first original image
   */
  public getOriginalImageIndex(): number {
    const originalIndex = this.images.findIndex((image) => image.type === 'original')
    if (originalIndex === -1) {
      throw new Error('No original image found in images array')
    }
    return originalIndex
  }

  /**
   * Get the main artwork image (first image with type: "original")
   * This is used for AI analysis
   */
  public getMainArtworkImage() {
    const originalIndex = this.getOriginalImageIndex()
    return this.images[originalIndex]
  }

  /**
   * Process all images (optimize, resize, save)
   * @returns Array of URLs for processed images
   */
  public async processAllImages(): Promise<string[]> {
    const processedUrls = await Promise.all(
      this.images.map(async (image) => {
        return await this.imageComposer.processImage(image.base64Image, this.ratio)
      })
    )
    return processedUrls
  }

  /**
   * Get random likes count
   */
  public async getLikesCount(): Promise<number> {
    return Math.floor(Math.random() * 200)
  }

  /**
   * Get parent collection ID
   */
  public getParentCollectionID(): string {
    return this.parentCollection.id
  }

  /**
   * Get collection title for AI context
   */
  public getCollectionTitle(): string {
    return this.parentCollection.title
  }

  /**
   * Get product type (painting, poster, or tapestry)
   */
  public getProductType(): ProductType {
    return this.productType
  }

  /**
   * Replace source filename with SEO-friendly name
   */
  public async replaceSrcName(src: string, filename: string): Promise<string> {
    return await this.imageComposer.replaceSrcName(src, filename)
  }

  /**
   * Get mockup context for a specific image index
   */
  public getMockupContext(index: number): string {
    if (index < 0 || index >= this.images.length) {
      throw new Error(`Invalid image index: ${index}`)
    }
    const context = this.images[index].mockupContext
    if (!context) {
      throw new Error(`Image at index ${index} does not have a mockupContext`)
    }
    return context
  }
}
