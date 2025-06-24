import type { Product as ShopifyProduct } from 'Types/Product'
import type { Board } from 'Types/Pinterest'
import PinterestBoardRecommendation from 'App/Models/PinterestBoardRecommendation'
import Pinterest from '../ChatGPT/Pinterest'

export default class NewProductHandler {
  constructor(
    private readonly products: ShopifyProduct[],
    private readonly productsWithBoardRecommendations: PinterestBoardRecommendation[],
    private readonly boards: Board[]
  ) {}

  public async processNewProducts() {
    const unstoredProducts = this.getUnstoredProducts()
    const pinterest = new Pinterest()
    const boardNames = this.getBoardNames()

    for (const product of unstoredProducts) {
      const relevantBoardNames = await pinterest.boardAI.suggestRelevantBoards(product, boardNames)
      const boardIds = this.mapBoardNamesToIds(relevantBoardNames)
      await this.storeNewProductRecommendations(product.id, boardIds)
    }
  }

  private getUnstoredProducts() {
    return this.products.filter(
      (product) =>
        !this.productsWithBoardRecommendations.some(
          (recommendation) => recommendation.productId === product.id
        )
    )
  }

  private getBoardNames() {
    return this.boards.map((board) => board.name)
  }

  private mapBoardNamesToIds(boardNames: string[]): string[] {
    return boardNames
      .map((name) => this.boards.find((board) => board.name === name)?.id)
      .filter((id): id is string => id !== undefined)
  }

  private async storeNewProductRecommendations(productId: string, boardIds: string[]) {
    await PinterestBoardRecommendation.create({
      productId,
      boardIds,
    })
  }
}
