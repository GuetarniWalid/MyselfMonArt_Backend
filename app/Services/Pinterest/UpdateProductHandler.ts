import type { Product as ShopifyProduct } from 'Types/Product'
import type { Board } from 'Types/Pinterest'
import PinterestBoardRecommendation from 'App/Models/PinterestBoardRecommendation'
import PinterestBoardAI from '../ChatGPT/Pinterest/PinterestBoardAI'
import { DateTime } from 'luxon'

export default class UpdateProductHandler {
  constructor(
    private readonly products: ShopifyProduct[],
    private readonly productsWithBoardRecommendations: PinterestBoardRecommendation[],
    private readonly boards: Board[]
  ) {}

  public async refreshBoardRecommendations() {
    const productsNeedingUpdate = this.getProductsNeedingUpdate()
    const pinterestBoardAI = new PinterestBoardAI()

    for (const product of productsNeedingUpdate) {
      const newBoards = this.getNewBoards(product)
      const shopifyProduct = this.products.find((p) => p.id === product.productId)
      if (!shopifyProduct) continue

      for (const board of newBoards) {
        const isBoardRelevant = await pinterestBoardAI.isBoardRelevantForProduct(
          shopifyProduct,
          board.name
        )
        await this.updateProductBoardRecommendations(product, board, isBoardRelevant)
      }
    }
  }

  private getProductsNeedingUpdate() {
    return this.productsWithBoardRecommendations.filter((recommendation) => {
      return this.boards.some((board) => {
        const boardCreatedAt = new Date(board.created_at).getTime()
        const recommendationUpdatedAt = recommendation.updatedAt.toJSDate().getTime()
        return boardCreatedAt > recommendationUpdatedAt
      })
    })
  }

  private getNewBoards(product: PinterestBoardRecommendation) {
    return this.boards.filter((board) => {
      const boardCreatedAt = new Date(board.created_at).getTime()
      const recommendationUpdatedAt = product.updatedAt.toJSDate().getTime()
      return boardCreatedAt > recommendationUpdatedAt
    })
  }

  private async updateProductBoardRecommendations(
    product: PinterestBoardRecommendation,
    board: Board,
    isBoardRelevant: boolean
  ) {
    const boardRecommendation = await PinterestBoardRecommendation.findOrFail(product.id)
    if (isBoardRelevant) {
      boardRecommendation.boardIds = [...boardRecommendation.boardIds, board.id]
    }
    boardRecommendation.updatedAt = DateTime.now()
    await boardRecommendation.save()
  }
}
