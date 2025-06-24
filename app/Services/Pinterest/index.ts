import type { Board, PinterestPin } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'
import Authentication from './Authentication'
import NewProductHandler from './NewProductHandler'
import PinterestBoardRecommendation from 'App/Models/PinterestBoardRecommendation'
import PinterestFetcher from './PinterestFetcher'
import PublicationSelector from './PublicationSelector'
import UpdateProductHandler from './UpdateProductHandler'
import PinterestPoster from './PinterestPoster'
import PinFormatter from './PinFormatter'

export default class Pinterest {
  private boards: Board[] = []
  private pins: PinterestPin[] = []
  public authentication: Authentication
  private productsWithBoardRecommendations: PinterestBoardRecommendation[] = []
  public fetcher: PinterestFetcher
  public newProductHandler: NewProductHandler
  public publicationSelector: PublicationSelector
  public updateProductHandler: UpdateProductHandler
  public poster: PinterestPoster
  public pinFormatter: PinFormatter

  constructor(private readonly shopifyProducts: ShopifyProduct[]) {
    this.authentication = new Authentication()
    this.fetcher = new PinterestFetcher()
    this.poster = new PinterestPoster()
    this.pinFormatter = new PinFormatter()
  }

  public async initialize() {
    this.boards = await this.fetcher.getAllPublicBoards()
    this.pins = await this.fetcher.getAllPins()
    this.productsWithBoardRecommendations = await PinterestBoardRecommendation.all()

    this.newProductHandler = new NewProductHandler(
      this.shopifyProducts,
      this.productsWithBoardRecommendations,
      this.boards
    )
    this.updateProductHandler = new UpdateProductHandler(
      this.shopifyProducts,
      this.productsWithBoardRecommendations,
      this.boards
    )
    this.publicationSelector = new PublicationSelector(this.boards, this.pins, this.shopifyProducts)
  }
}
