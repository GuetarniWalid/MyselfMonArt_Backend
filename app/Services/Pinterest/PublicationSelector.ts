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

  private getEligibleProducts(): ShopifyProduct[] {
    return this.shopifyProducts.filter((product) => {
      if (!this.hasNeutralMockup(product)) return false
      const matchingBoards = this.matcher.getMatchingBoards(product, this.boards)
      if (matchingBoards.length === 0) return false
      const usedBoardIds = new Set(this.getProductPins(product.id).map((pin) => pin.board_id))
      return matchingBoards.some((board) => !usedBoardIds.has(board.id))
    })
  }

  private hasNeutralMockup(product: ShopifyProduct): boolean {
    const images = (product.media?.nodes || []).filter((m) => m.mediaContentType === 'IMAGE')
    return Boolean(images[2]?.image?.url)
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
      return this.getProductPins(a.id).length - this.getProductPins(b.id).length
    })[0]
  }

  private getNextAvailableBoard(product: ShopifyProduct): Board {
    const matchingBoards = this.matcher.getMatchingBoards(product, this.boards)
    const usedBoardIds = new Set(this.getProductPins(product.id).map((pin) => pin.board_id))
    const availableBoards = matchingBoards.filter((board) => !usedBoardIds.has(board.id))
    return availableBoards[Math.floor(Math.random() * availableBoards.length)]
  }
}
