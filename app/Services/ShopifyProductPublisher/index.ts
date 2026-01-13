import type { Collection } from 'Types/Collection'
import type { ExtensionRequest, Ratio } from 'Types/ShopifyProductPublisher'
import ImageComposer from './ImageComposer'
import Shopify from 'App/Services/Shopify'
import ProductPublisher from 'App/Services/ChatGPT/ProductPublisher'
import Env from '@ioc:Adonis/Core/Env'

export default class ShopifyProductPublisher {
  private imageComposer: ImageComposer

  constructor(base64Image: string) {
    this.imageComposer = new ImageComposer(base64Image)
  }

  public async cleanupSavedImages(): Promise<void> {
    await this.imageComposer.cleanupSavedImages()
  }

  public getAspectRatio(request: ExtensionRequest): Ratio {
    const aspectRatio = request.aspectRatio ?? '1:1'
    const [width, height] = aspectRatio.split(':').map(Number)

    if (width === height) {
      return 'square'
    } else if (width < height) {
      return 'portrait'
    } else {
      return 'landscape'
    }
  }

  public async getImagesWithBackground(
    mainImageUrl: string,
    ratio: Ratio,
    descriptionHtml: string
  ) {
    const imagesWithBackground = await this.imageComposer.getImagesWithBackground(
      mainImageUrl,
      ratio,
      descriptionHtml
    )

    const imagesWithBackgroundUrls = imagesWithBackground.map((image) =>
      this.replaceUrlForDevelopment(image)
    )

    const uniqueImages = [...new Set(imagesWithBackgroundUrls)]
    return uniqueImages
  }

  public async getLikesCount() {
    const likesCount = Math.floor(Math.random() * 200)
    return likesCount
  }

  public async getMainImage(ratio: Ratio) {
    const mainImage = await this.imageComposer.getMainImage(ratio)
    return this.replaceUrlForDevelopment(mainImage)
  }

  public async getOptimizedImage(ratio: Ratio): Promise<string> {
    let url = await this.imageComposer.getOptimizedImage(ratio)
    return this.replaceUrlForDevelopment(url)
  }

  public async getParentCollection(imageUrl: string) {
    const shopify = new Shopify()
    const collections = await shopify.collection.getAll()
    const collectionTitles = collections.map((collection) => collection.title)

    const productPublisher = new ProductPublisher()
    const parentCollectionTitle = await productPublisher.suggestRelevantParentCollection(
      collectionTitles,
      imageUrl
    )

    const parentCollection = this.getCollectionByTitle(collections, parentCollectionTitle)
    if (!parentCollection) {
      throw new Error(`Parent collection not found for title: ${parentCollectionTitle}`)
    }
    return parentCollection
  }

  public async replaceSrcName(src: string, filename: string) {
    const newSrc = await this.imageComposer.replaceSrcName(src, filename)
    return this.replaceUrlForDevelopment(newSrc)
  }

  private getCollectionByTitle(collections: Collection[], title: string) {
    return collections.find((collection) => collection.title === title)
  }

  private replaceUrlForDevelopment(url: string): string {
    if (Env.get('NODE_ENV') === 'development') {
      return url.replace(Env.get('APP_URL'), Env.get('NGROK_URL'))
    }
    return url
  }
}
