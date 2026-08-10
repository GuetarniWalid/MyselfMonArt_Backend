import type {
  InstagramCarouselPayload,
  InstagramMediaContainer,
  InstagramPostPayload,
  InstagramPublishedMedia,
  InstagramReelPayload,
} from 'Types/Instagram'
import InstagramPostPayloadValidator from 'App/Validators/InstagramPostPayloadValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import Shopify from 'App/Services/Shopify'
import { PublishError } from 'App/Services/Social/PublishError'
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
      const container = await this.createContainer(igUserId, {
        image_url: imageUrl,
        caption: payload.caption,
      })
      // Meta needs a few seconds to ingest the image and mark the container
      // FINISHED. Publishing before that returns "Media ID is not available"
      // (error_subcode 2207027). Poll until ready before publishing.
      await this.waitForContainerReady(container.id)
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

  /**
   * Publish a carousel (2–10 image slides).
   *
   * Flow: upload each slide to a public URL → create one carousel-item
   * container per slide → bundle them into a parent CAROUSEL container →
   * publish. All temp Shopify files are cleaned up in `finally`, regardless of
   * outcome.
   */
  public async publishCarousel(payload: InstagramCarouselPayload): Promise<{ mediaId: string }> {
    this.assertCaption(payload.caption)
    if (payload.imageBuffers.length < 2) {
      throw new Error(`Carousel needs at least 2 images (got ${payload.imageBuffers.length})`)
    }

    const shopify = new Shopify()
    const uploadedFileIds: string[] = []
    try {
      const igUserId = await this.getInstagramUserId()

      const childIds: string[] = []
      for (let i = 0; i < payload.imageBuffers.length; i++) {
        const { fileId, url } = await shopify.file.uploadFromBuffer({
          buffer: payload.imageBuffers[i],
          mimeType: 'image/jpeg',
          filename: this.buildFilename(payload.shopifyProductId, `carousel-${i}`),
          alt: payload.altText,
        })
        uploadedFileIds.push(fileId)

        const item = await this.createContainer(igUserId, {
          image_url: url,
          is_carousel_item: true,
        })
        await this.waitForContainerReady(item.id)
        childIds.push(item.id)
      }

      const parent = await this.createContainer(igUserId, {
        media_type: 'CAROUSEL',
        caption: payload.caption,
        children: childIds.join(','),
      })
      await this.waitForContainerReady(parent.id)
      const published = await this.publishMediaContainer(igUserId, parent.id)
      return { mediaId: published.id }
    } finally {
      if (uploadedFileIds.length) {
        try {
          await shopify.file.delete(uploadedFileIds)
        } catch (cleanupError) {
          console.error(
            `[Instagram] Failed to cleanup temp Shopify carousel files ${uploadedFileIds.join(', ')}:`,
            cleanupError?.message ?? cleanupError
          )
        }
      }
    }
  }

  /**
   * Publish a Reel from an already-hosted public video URL (the product's
   * video metafield / DO Spaces CDN). No upload step is needed. `share_to_feed`
   * also surfaces the reel in the main feed grid.
   */
  public async publishReel(payload: InstagramReelPayload): Promise<{ mediaId: string }> {
    this.assertCaption(payload.caption)
    if (!payload.videoUrl) {
      throw new Error('Reel payload is missing videoUrl')
    }

    const igUserId = await this.getInstagramUserId()
    const container = await this.createContainer(igUserId, {
      media_type: 'REELS',
      video_url: payload.videoUrl,
      caption: payload.caption,
      share_to_feed: true,
    })
    // Video ingestion is far slower than images — poll longer (up to ~3min)
    // before publishing.
    await this.waitForContainerReady(container.id, 60, 3000)
    const published = await this.publishMediaContainer(igUserId, container.id)
    return { mediaId: published.id }
  }

  private async createContainer(
    igUserId: string,
    params: Record<string, any>
  ): Promise<InstagramMediaContainer> {
    try {
      return await this.request<InstagramMediaContainer>({
        method: 'POST',
        url: `/${igUserId}/media`,
        params,
      })
    } catch (error) {
      const status = error?.response?.status
      const body = error?.response?.data
      // Omit the (long) caption from the error context, keep the useful bits.
      const { caption, ...debugParams } = params
      // Phase `prepare` : créer un conteneur ne publie rien. Se rabattre sur un
      // autre format après cet échec est sans risque.
      throw new PublishError(
        `Instagram POST /media failed (status ${status}): ${JSON.stringify(body)} | params=${JSON.stringify(debugParams)}`,
        'prepare',
        error
      )
    }
  }

  /**
   * Retrouve un média récemment publié dont la légende correspond exactement.
   * Sert à réconcilier après un échec ambigu de POST /media_publish : si Meta a
   * en réalité publié, on récupère son id au lieu de republier.
   * Best-effort — renvoie null à la moindre difficulté.
   */
  public async findRecentMediaByCaption(caption: string): Promise<string | null> {
    try {
      const igUserId = await this.getInstagramUserId()
      const response = await this.request<{ data?: Array<{ id: string; caption?: string }> }>({
        method: 'GET',
        url: `/${igUserId}/media`,
        params: { fields: 'id,caption', limit: 5 },
      })
      const match = (response.data ?? []).find((media) => (media.caption ?? '') === caption)
      return match?.id ?? null
    } catch (error) {
      console.warn(`[Instagram] Réconciliation impossible: ${(error as any)?.message ?? error}`)
      return null
    }
  }

  private assertCaption(caption: string): void {
    if (typeof caption !== 'string' || caption.length === 0) {
      throw new Error('Instagram caption is missing or empty')
    }
    if (caption.length > 2200) {
      throw new Error(`Instagram caption exceeds 2200 chars (${caption.length})`)
    }
  }

  private async waitForContainerReady(
    creationId: string,
    maxRetries: number = 20,
    delayMs: number = 2000
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const status = await this.request<{ status_code: string; id: string }>({
        method: 'GET',
        url: `/${creationId}`,
        params: { fields: 'status_code' },
      })

      if (status.status_code === 'FINISHED') return
      if (status.status_code === 'ERROR') {
        throw new Error(`Instagram container ${creationId} ended in ERROR state`)
      }
      if (status.status_code === 'EXPIRED') {
        throw new Error(`Instagram container ${creationId} expired before publish`)
      }
      // Otherwise status is IN_PROGRESS — keep polling.
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
    throw new Error(
      `Instagram container ${creationId} not ready after ${maxRetries} attempts (${(maxRetries * delayMs) / 1000}s)`
    )
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
      // Phase `publish` : c'est CET appel qui met le post en ligne. Un timeout
      // ou un 5xx ici peut parfaitement accompagner un post déjà publié — d'où
      // l'interdiction faite à l'appelant de se rabattre sur un autre format.
      throw new PublishError(
        `Instagram POST /media_publish failed (status ${status}): ${JSON.stringify(body)} | creation_id=${creationId}`,
        'publish',
        error
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

  private buildFilename(shopifyProductId: string, suffix?: string): string {
    const numericId = shopifyProductId.replace('gid://shopify/Product/', '')
    const tag = suffix ? `${suffix}-` : ''
    return `ig-post-${numericId}-${tag}${Date.now()}.jpg`
  }
}
