import PinterestBoardRecommendation from 'App/Models/PinterestBoardRecommendation'
import type { Board, PinterestPin } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'

export default class PublicationSelector {
  private productsWithBoardRecommendations: PinterestBoardRecommendation[] = []

  constructor(
    private readonly boards: Board[],
    private readonly pins: PinterestPin[],
    private readonly shopifyProducts: ShopifyProduct[]
  ) {}

  public async selectNextProductToPublish() {
    this.productsWithBoardRecommendations = await PinterestBoardRecommendation.all()
    const eligibleProducts = this.getEligibleProducts()
    const leastPublishedProduct = this.getLeastPublishedProduct(eligibleProducts)
    const nextAvailableBoard = this.getNextAvailableBoard(leastPublishedProduct)
    return {
      product: this.getShopifyProductFromRecommendation(leastPublishedProduct),
      board: nextAvailableBoard,
    }
  }

  private getEligibleProducts() {
    return this.productsWithBoardRecommendations.filter((recommendation) => {
      const shopifyProduct = this.getShopifyProductFromRecommendation(recommendation)
      if (!shopifyProduct) return false

      const productPins = this.getProductPins(shopifyProduct.id)
      const currentBoardIds = new Set(productPins.map((pin) => pin.board_id))

      return recommendation.boardIds.some((boardId) => !currentBoardIds.has(boardId))
    })
  }

  private getShopifyProductFromRecommendation(recommendation: PinterestBoardRecommendation) {
    return this.shopifyProducts.find((p) => {
      const numericId = p.id.replace('gid://shopify/Product/', '')
      return p.id === recommendation.productId || numericId === recommendation.productId
    }) as ShopifyProduct
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
    } catch (error) {
      return false
    }
  }

  private getLeastPublishedProduct(eligibleProducts: PinterestBoardRecommendation[]) {
    return eligibleProducts.sort((a, b) => {
      const aPins = this.getProductPins(a.productId)
      const bPins = this.getProductPins(b.productId)
      return aPins.length - bPins.length
    })[0]
  }

  private getNextAvailableBoard(recommendation: PinterestBoardRecommendation) {
    const productPins = this.getProductPins(recommendation.productId)
    const currentBoardIds = new Set(productPins.map((pin) => pin.board_id))

    const availableBoards = this.boards.filter(
      (board) => recommendation.boardIds.includes(board.id) && !currentBoardIds.has(board.id)
    )
    return this.pickRandomAvailableBoard(availableBoards)
  }

  private pickRandomAvailableBoard(availableBoards: Board[]) {
    return availableBoards[Math.floor(Math.random() * availableBoards.length)]
  }
}
