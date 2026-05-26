/**
 * Output of the Claude IG post payload generator (text only).
 */
export interface InstagramPostContent {
  caption: string
  altText: string
}

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
