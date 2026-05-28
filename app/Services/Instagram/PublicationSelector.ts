import type { Product as ShopifyProduct } from 'Types/Product'

/**
 * Selects the next product to publish on the Instagram feed, fully independent
 * from Pinterest. A product is eligible when it has a publishable image, a
 * usable store URL, and has not yet been posted to the IG feed (tracked via
 * `social_publications`, channel='instagram'). Among eligible products the most
 * recently created one wins; `null` means the whole catalog is already posted.
 */
export default class PublicationSelector {
  // Same priority as PostFormatter / PinFormatter: index 2 is the
  // lifestyle/mockup shot most of the time, then 3, then 1, then 0.
  private static readonly IMAGE_PRIORITY = [2, 3, 1, 0]

  constructor(
    private readonly shopifyProducts: ShopifyProduct[],
    private readonly alreadyPostedProductIds: Set<string>
  ) {}

  public selectNextProductToPublish(): ShopifyProduct | null {
    const eligible = this.shopifyProducts.filter((product) => this.isEligible(product))
    if (eligible.length === 0) return null
    return [...eligible].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]
  }

  private isEligible(product: ShopifyProduct): boolean {
    if (this.alreadyPostedProductIds.has(product.id)) return false
    if (!this.hasPublishableImage(product)) return false
    return this.hasUsableStoreUrl(product)
  }

  private hasPublishableImage(product: ShopifyProduct): boolean {
    const images = (product.media?.nodes || []).filter((m) => m.mediaContentType === 'IMAGE')
    return PublicationSelector.IMAGE_PRIORITY.some((i) => Boolean(images[i]?.image?.url))
  }

  private hasUsableStoreUrl(product: ShopifyProduct): boolean {
    if (!product.onlineStoreUrl) return false
    try {
      // PostFormatter derives the post link from onlineStoreUrl; an invalid
      // URL would throw at publish time, so guard against it here.
      new URL(product.onlineStoreUrl)
      return true
    } catch {
      return false
    }
  }
}
