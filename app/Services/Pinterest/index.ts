import type { Board, PinterestPin } from 'Types/Pinterest'
import type { Collection } from 'Types/Collection'
import type { Product as ShopifyProduct } from 'Types/Product'
import Authentication from './Authentication'
import BoardAutoCreator from './BoardAutoCreator'
import PinterestFetcher from './PinterestFetcher'
import PublicationSelector from './PublicationSelector'
import PinterestPoster from './PinterestPoster'
import PinFormatter from './PinFormatter'
import ClaudePinterest from '../Claude/Pinterest'

export default class Pinterest {
  private boards: Board[] = []
  private pins: PinterestPin[] = []
  public authentication: Authentication
  public fetcher: PinterestFetcher
  public poster: PinterestPoster
  public pinFormatter: PinFormatter
  public boardAutoCreator: BoardAutoCreator
  public publicationSelector!: PublicationSelector

  constructor(
    private readonly shopifyProducts: ShopifyProduct[],
    private readonly shopifyCollections: Collection[] = []
  ) {
    this.authentication = new Authentication()
    this.fetcher = new PinterestFetcher()
    this.poster = new PinterestPoster()
    this.pinFormatter = new PinFormatter()
    this.boardAutoCreator = new BoardAutoCreator(this.poster, new ClaudePinterest())
  }

  public async initialize() {
    this.boards = await this.fetcher.getAllPublicBoards()
    this.pins = await this.fetcher.getAllPins()
    this.rebuildPublicationSelector()
  }

  public getBoards(): Board[] {
    return this.boards
  }

  public async autoCreateMissingBoards() {
    const created = await this.boardAutoCreator.createMissingBoards(
      this.shopifyProducts,
      this.boards,
      this.shopifyCollections
    )
    if (created.length > 0) {
      this.boards = [...this.boards, ...created]
      this.rebuildPublicationSelector()
    }
  }

  private rebuildPublicationSelector() {
    this.publicationSelector = new PublicationSelector(this.boards, this.pins, this.shopifyProducts)
  }
}
