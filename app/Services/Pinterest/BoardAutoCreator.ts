import type { Board } from 'Types/Pinterest'
import type { Collection } from 'Types/Collection'
import type { Product as ShopifyProduct } from 'Types/Product'
import BoardMatcher, { ArtworkType } from './BoardMatcher'
import PinterestPoster from './PinterestPoster'
import ClaudePinterest from '../Claude/Pinterest'

const MAX_BOARD_NAME_LENGTH = 50

type MissingBoardKey = string
type MissingBoard = {
  artworkType: ArtworkType
  collectionTitle: string
  collectionDescription: string | null
}

export default class BoardAutoCreator {
  private readonly matcher = new BoardMatcher()

  constructor(
    private readonly poster: PinterestPoster,
    private readonly claudePinterest: ClaudePinterest
  ) {}

  public async createMissingBoards(
    products: ShopifyProduct[],
    boards: Board[],
    collections: Collection[]
  ): Promise<Board[]> {
    const missing = this.findMissingBoards(products, boards, collections)
    if (missing.size === 0) return []

    console.log(`[Pinterest] ${missing.size} missing board(s) to create`)
    const created: Board[] = []
    for (const item of missing.values()) {
      const board = await this.createOne(item)
      if (board) created.push(board)
    }
    return created
  }

  private findMissingBoards(
    products: ShopifyProduct[],
    boards: Board[],
    collections: Collection[]
  ): Map<MissingBoardKey, MissingBoard> {
    const missing = new Map<MissingBoardKey, MissingBoard>()
    const collectionsByTitle = new Map(collections.map((c) => [c.title, c]))

    for (const product of products) {
      const artworkType = this.matcher.getArtworkType(product)
      const collectionTitle = this.matcher.getMotherCollectionTitle(product)
      if (!artworkType || !collectionTitle) continue

      const hasMatch = boards.some((board) =>
        this.matcher.matchesProduct(board, artworkType, collectionTitle)
      )
      if (hasMatch) continue

      const key = `${artworkType}::${collectionTitle}`
      if (missing.has(key)) continue

      missing.set(key, {
        artworkType,
        collectionTitle,
        collectionDescription: collectionsByTitle.get(collectionTitle)?.description ?? null,
      })
    }

    return missing
  }

  private async createOne(item: MissingBoard): Promise<Board | null> {
    const name = this.matcher.buildBoardName(item.artworkType, item.collectionTitle)
    if (name.length === 0 || name.length > MAX_BOARD_NAME_LENGTH) {
      console.warn(
        `[Pinterest] Skipping board auto-create for "${item.collectionTitle}" — generated name "${name}" length ${name.length} (max ${MAX_BOARD_NAME_LENGTH})`
      )
      return null
    }

    try {
      const description = await this.claudePinterest.generateBoardDescription(
        item.collectionTitle,
        item.collectionDescription
      )
      const board = await this.poster.createBoard({ name, description, privacy: 'PUBLIC' })
      console.log(`[Pinterest] ✅ Created board "${name}" (id: ${board.id})`)
      return board
    } catch (error) {
      console.error(`[Pinterest] ❌ Failed to create board "${name}":`, error?.message || error)
      return null
    }
  }
}
