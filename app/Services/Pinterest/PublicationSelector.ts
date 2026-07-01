import type { Board, PinterestPin } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'
import BoardMatcher from './BoardMatcher'

export default class PublicationSelector {
  private readonly matcher = new BoardMatcher()

  constructor(
    private readonly boards: Board[],
    private readonly pins: PinterestPin[],
    private readonly shopifyProducts: ShopifyProduct[]
  ) {}

  public async selectNextProductToPublish(): Promise<{
    product: ShopifyProduct
    board: Board
  }> {
    const eligibleProducts = this.getEligibleProducts()
    if (eligibleProducts.length === 0) {
      throw new Error('No eligible product to publish on Pinterest')
    }
    const leastPublishedProduct = this.getLeastPublishedProduct(eligibleProducts)
    const nextAvailableBoard = this.getNextAvailableBoard(leastPublishedProduct)
    return { product: leastPublishedProduct, board: nextAvailableBoard }
  }

  private static readonly IMAGE_PRIORITY = [2, 3, 1, 0]

  private getEligibleProducts(): ShopifyProduct[] {
    return this.shopifyProducts.filter((product) => {
      if (!this.isPainting(product)) return false
      if (!this.hasPublishableImage(product)) return false
      const matchingBoards = this.matcher.getMatchingBoards(product, this.boards)
      if (matchingBoards.length === 0) return false
      const usedBoardIds = new Set(this.getProductPins(product.id).map((pin) => pin.board_id))
      return matchingBoards.some((board) => !usedBoardIds.has(board.id))
    })
  }

  /**
   * On ne promeut sur les réseaux QUE les toiles (artwork.type === 'painting').
   * Posters, tapisseries et tout autre type sont ignorés — un produit sans le
   * metafield est ignoré aussi, plutôt que de risquer de publier un non-tableau
   * (liste blanche : on échoue en sautant, jamais en publiant par erreur).
   */
  private isPainting(product: ShopifyProduct): boolean {
    return product.artworkTypeMetafield?.value === 'painting'
  }

  private hasPublishableImage(product: ShopifyProduct): boolean {
    const images = (product.media?.nodes || []).filter((m) => m.mediaContentType === 'IMAGE')
    return PublicationSelector.IMAGE_PRIORITY.some((i) => Boolean(images[i]?.image?.url))
  }

  private getProductPins(productId: string): PinterestPin[] {
    return this.pins.filter((pin) => this.isPinForProduct(pin, productId))
  }

  private isPinForProduct(pin: PinterestPin, productId: string): boolean {
    try {
      const url = new URL(pin.link)
      const pinProductId = url.searchParams.get('shopify_product_id')
      if (!pinProductId) return false
      const numericProductId = productId.replace('gid://shopify/Product/', '')
      const numericPinProductId = pinProductId.replace('gid://shopify/Product/', '')
      return numericProductId === numericPinProductId
    } catch {
      return false
    }
  }

  private getLeastPublishedProduct(products: ShopifyProduct[]): ShopifyProduct {
    return [...products].sort((a, b) => {
      const pinDiff = this.getProductPins(a.id).length - this.getProductPins(b.id).length
      if (pinDiff !== 0) return pinDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })[0]
  }

  private getNextAvailableBoard(product: ShopifyProduct): Board {
    const matchingBoards = this.matcher.getMatchingBoards(product, this.boards)
    const usedBoardIds = new Set(this.getProductPins(product.id).map((pin) => pin.board_id))
    const availableBoards = matchingBoards.filter((board) => !usedBoardIds.has(board.id))
    return availableBoards[Math.floor(Math.random() * availableBoards.length)]
  }
}
