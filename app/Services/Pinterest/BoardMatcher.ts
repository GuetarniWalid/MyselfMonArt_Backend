import type { Board } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'

export type ArtworkType = 'painting' | 'poster' | 'tapestry'

export const BOARD_PREFIX_BY_ARTWORK_TYPE: Record<ArtworkType, string> = {
  painting: 'Tableau Décoration',
  poster: 'Poster Décoration',
  tapestry: 'Tapisserie Décoration',
}

const PREFIX_STOP_WORDS = new Set([
  'tableau',
  'tableaux',
  'poster',
  'posters',
  'tapisserie',
  'tapisseries',
  'decoration',
])

function normalize(input: string): string {
  return input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function tokenize(input: string): string[] {
  return normalize(input)
    .split(/[\s\-:]+/)
    .filter(Boolean)
}

export default class BoardMatcher {
  public getArtworkType(product: ShopifyProduct): ArtworkType | null {
    const value = product.artworkTypeMetafield?.value
    if (value === 'painting' || value === 'poster' || value === 'tapestry') return value
    return null
  }

  public getMotherCollectionTitle(product: ShopifyProduct): string | null {
    const edge = product.metafields?.edges?.find(
      (e) => e.node.namespace === 'link' && e.node.key === 'mother_collection'
    )
    return edge?.node.reference?.title || null
  }

  public getBoardArtworkType(board: Board): ArtworkType | null {
    const normalized = normalize(board.name)
    if (normalized.startsWith('tableau ')) return 'painting'
    if (normalized.startsWith('poster ')) return 'poster'
    if (normalized.startsWith('tapisserie ')) return 'tapestry'
    return null
  }

  public getBoardTopicTokens(boardName: string): string[] {
    return tokenize(boardName).filter((t) => !PREFIX_STOP_WORDS.has(t))
  }

  public getCollectionTopicTokens(collectionTitle: string): string[] {
    return tokenize(collectionTitle).filter((t) => !PREFIX_STOP_WORDS.has(t))
  }

  public matchesProduct(board: Board, artworkType: ArtworkType, collectionTitle: string): boolean {
    if (this.getBoardArtworkType(board) !== artworkType) return false
    const boardTokens = this.getBoardTopicTokens(board.name)
    if (boardTokens.length === 0) return false
    const collectionTokens = new Set(this.getCollectionTopicTokens(collectionTitle))
    return boardTokens.every((t) => collectionTokens.has(t))
  }

  public getMatchingBoards(product: ShopifyProduct, boards: Board[]): Board[] {
    const artworkType = this.getArtworkType(product)
    const collectionTitle = this.getMotherCollectionTitle(product)
    if (!artworkType || !collectionTitle) return []
    return boards.filter((board) => this.matchesProduct(board, artworkType, collectionTitle))
  }

  public buildBoardName(artworkType: ArtworkType, collectionTitle: string): string {
    const prefix = BOARD_PREFIX_BY_ARTWORK_TYPE[artworkType]
    const topicTokens = this.getCollectionTopicTokens(collectionTitle)
    if (topicTokens.length === 0) return ''
    const topic = topicTokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ')
    return `${prefix} ${topic}`
  }
}
