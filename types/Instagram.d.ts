/**
 * Output of the Claude IG post payload generator (text only).
 */
export interface InstagramPostContent {
  caption: string
  altText: string
}

/**
 * The three IG feed formats we publish, in descending order of organic reach.
 * The format is chosen per-product by a weighted fixed cycle (FormatSelector).
 */
export type InstagramPostFormat = 'reel' | 'carousel' | 'image'

/**
 * Fully prepared payload for an IG post, produced by PostFormatter.
 * The image buffer is kept in-memory; the poster uploads it (Phase 3)
 * and turns it into a public URL before calling the Meta Graph API.
 */
export interface InstagramPostPayload {
  caption: string
  altText: string
  imageBuffer: Buffer
  shopifyProductId: string
  link: string
}

/**
 * Carousel payload (2–10 slides). Each buffer is uploaded to a public URL,
 * turned into a carousel item container, then bundled into a parent container.
 */
export interface InstagramCarouselPayload {
  caption: string
  altText: string
  imageBuffers: Buffer[]
  shopifyProductId: string
  link: string
}

/**
 * Reel payload. The video is already hosted at a public URL (DO Spaces CDN
 * via the product's video metafield), so no upload step is needed — the URL
 * is handed straight to the Meta REELS container.
 */
export interface InstagramReelPayload {
  caption: string
  videoUrl: string
  shopifyProductId: string
  link: string
}

/**
 * Meta IG Container creation response (subset).
 * Returned by POST /{ig-user-id}/media.
 */
export interface InstagramMediaContainer {
  id: string
}

/**
 * Meta IG Media publish response (subset).
 * Returned by POST /{ig-user-id}/media_publish.
 */
export interface InstagramPublishedMedia {
  id: string
}
