import type { InstagramPostPayload } from 'Types/Instagram'
import type { Product as ShopifyProduct } from 'Types/Product'
import sharp from 'sharp'
import Instagram from '../Claude/Instagram'

export default class PostFormatter {
  public async buildPostPayload(shopifyProduct: ShopifyProduct): Promise<InstagramPostPayload> {
    const { buffer, imageAlt } = await this.processImage(shopifyProduct)
    const instagram = new Instagram()
    const productType = this.getProductTypeFr(shopifyProduct)
    const postContent = await instagram.generatePostPayload(
      shopifyProduct.title,
      shopifyProduct.description,
      productType
    )

    return {
      caption: postContent.caption,
      altText: postContent.alt_text || imageAlt,
      imageBuffer: buffer,
      shopifyProductId: shopifyProduct.id,
      link: this.getProductLinkWithProductId(shopifyProduct),
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

  // Same priority as PinFormatter: index 2 is the lifestyle/mockup shot most of
  // the time, then 3, then 1, then 0 as a last resort.
  private static readonly IMAGE_PRIORITY = [2, 3, 1, 0]

  private getImage(images: ShopifyProduct['media']['nodes']) {
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('No image found')
    }
    const imageList = images.filter((image) => image.mediaContentType === 'IMAGE')
    for (const index of PostFormatter.IMAGE_PRIORITY) {
      const candidate = imageList[index]
      if (candidate?.image?.url) return candidate
    }
    throw new Error(
      'No usable image at indices [2, 3, 1, 0] — product not publishable to Instagram'
    )
  }

  private async downloadImage(imageUrl: string): Promise<Buffer> {
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()
    return Buffer.from(buffer)
  }

  // 1080x1350 = 4:5 portrait, the IG feed sweet spot (maximum vertical real
  // estate in the feed while staying within IG's accepted aspect range).
  private async cropImage(imageBuffer: Buffer): Promise<Buffer> {
    const image = sharp(imageBuffer)
    return image.resize(1080, 1350, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer()
  }

  private getProductLinkWithProductId(shopifyProduct: ShopifyProduct): string {
    const url = new URL(shopifyProduct.onlineStoreUrl)
    url.searchParams.set('shopify_product_id', shopifyProduct.id)
    return url.toString()
  }
}
