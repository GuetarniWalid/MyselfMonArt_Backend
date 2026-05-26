import type {
  InstagramMediaContainer,
  InstagramPostPayload,
  InstagramPublishedMedia,
} from 'Types/Instagram'
import InstagramPostPayloadValidator from 'App/Validators/InstagramPostPayloadValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import Shopify from 'App/Services/Shopify'
import Authentication from './Authentication'

export default class InstagramPoster extends Authentication {
  /**
   * Publish a post on Instagram.
   *
   * Flow:
   *   1. Validate the payload
   *   2. Upload imageBuffer → Shopify Files (Meta requires a public URL)
   *   3. Meta container-based publishing:
   *      a. POST /{ig-user-id}/media (creation container) with image_url + caption
   *      b. POST /{ig-user-id}/media_publish to actually publish
   *   4. Always cleanup the temp Shopify file in `finally`, regardless of
   *      Meta success/failure — cleanup failures are logged but do not mask
   *      the original publish outcome.
   */
  public async publishPost(payload: InstagramPostPayload): Promise<{ mediaId: string }> {
    await this.validatePayload(payload)

    const shopify = new Shopify()
    const filename = this.buildFilename(payload.shopifyProductId)

    const { fileId, url: imageUrl } = await shopify.file.uploadFromBuffer({
      buffer: payload.imageBuffer,
      mimeType: 'image/jpeg',
      filename,
      alt: payload.altText,
    })

    try {
      const igUserId = await this.getInstagramUserId()
      const container = await this.createMediaContainer(igUserId, imageUrl, payload.caption)
      const published = await this.publishMediaContainer(igUserId, container.id)
      return { mediaId: published.id }
    } finally {
      try {
        await shopify.file.delete([fileId])
      } catch (cleanupError) {
        console.error(
          `[Instagram] Failed to cleanup temp Shopify file ${fileId}:`,
          cleanupError?.message ?? cleanupError
        )
      }
    }
  }

  private async createMediaContainer(
    igUserId: string,
    imageUrl: string,
    caption: string
  ): Promise<InstagramMediaContainer> {
    try {
      return await this.request<InstagramMediaContainer>({
        method: 'POST',
        url: `/${igUserId}/media`,
        params: {
          image_url: imageUrl,
          caption,
        },
      })
    } catch (error) {
      const status = error?.response?.status
      const body = error?.response?.data
      throw new Error(
        `Instagram POST /media failed (status ${status}): ${JSON.stringify(body)} | image_url=${imageUrl}`
      )
    }
  }

  private async publishMediaContainer(
    igUserId: string,
    creationId: string
  ): Promise<InstagramPublishedMedia> {
    try {
      return await this.request<InstagramPublishedMedia>({
        method: 'POST',
        url: `/${igUserId}/media_publish`,
        params: {
          creation_id: creationId,
        },
      })
    } catch (error) {
      const status = error?.response?.status
      const body = error?.response?.data
      throw new Error(
        `Instagram POST /media_publish failed (status ${status}): ${JSON.stringify(body)} | creation_id=${creationId}`
      )
    }
  }

  private async validatePayload(payload: InstagramPostPayload) {
    try {
      await validator.validate({
        schema: new InstagramPostPayloadValidator().schema,
        data: {
          caption: payload.caption,
          altText: payload.altText,
          shopifyProductId: payload.shopifyProductId,
          link: payload.link,
        },
      })
      if (!Buffer.isBuffer(payload.imageBuffer) || payload.imageBuffer.length === 0) {
        throw new Error('imageBuffer is missing or empty')
      }
    } catch (error) {
      console.error(error)
      throw new Error('Invalid Instagram post payload')
    }
  }

  private buildFilename(shopifyProductId: string): string {
    const numericId = shopifyProductId.replace('gid://shopify/Product/', '')
    return `ig-post-${numericId}-${Date.now()}.jpg`
  }
}
