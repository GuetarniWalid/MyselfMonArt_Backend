import type { Board, PinterestPin } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'
import BoardMatcher from './BoardMatcher'

/**
 * Choisit le prochain produit à épingler.
 *
 * Règle : UN PRODUIT N'EST PUBLIÉ QU'UNE SEULE FOIS, tous formats et tous
 * boards confondus. Auparavant la déduplication portait sur la paire
 * (produit × board) : un produit correspondant à plusieurs boards était donc
 * épinglé plusieurs fois — c'est ainsi qu'un même tableau se retrouvait publié
 * en carrousel sur un board puis en image sur un autre. Le board reste choisi
 * parmi ceux qui correspondent au produit, mais il n'y en a qu'un seul.
 *
 * Un produit est considéré comme déjà publié si NOTRE base en garde la trace
 * (`social_publications`, y compris une réservation `pending`) OU si Pinterest
 * expose encore un pin vivant pointant vers sa fiche produit. La base prime :
 * c'est la source qu'on maîtrise, indépendante de ce que l'API veut bien
 * renvoyer.
 */
export default class PublicationSelector {
  private readonly matcher = new BoardMatcher()

  constructor(
    private readonly boards: Board[],
    private readonly pins: PinterestPin[],
    private readonly shopifyProducts: ShopifyProduct[],
    // Produits déjà publiés (ou réservés) d'après social_publications.
    private readonly publishedProductIds: Set<string> = new Set()
  ) {}

  /**
   * `null` quand tout le catalogue de toiles est déjà passé. Depuis qu'un
   * produit n'est publié qu'une seule fois, l'épuisement est une fin normale et
   * non une anomalie : le cron doit sauter son tour en silence, pas hurler une
   * erreur cinq fois par jour.
   */
  public async selectNextProductToPublish(): Promise<{
    product: ShopifyProduct
    board: Board
  } | null> {
    const eligibleProducts = this.getEligibleProducts()
    if (eligibleProducts.length === 0) return null
    const product = this.getNextProduct(eligibleProducts)
    return { product, board: this.pickBoard(product) }
  }

  private static readonly IMAGE_PRIORITY = [2, 3, 1, 0]

  private getEligibleProducts(): ShopifyProduct[] {
    return this.shopifyProducts.filter((product) => {
      if (!this.isPainting(product)) return false
      if (this.isAlreadyPublished(product.id)) return false
      if (!this.hasPublishableImage(product)) return false
      return this.matcher.getMatchingBoards(product, this.boards).length > 0
    })
  }

  /**
   * Un produit est « déjà publié » dès qu'il existe une trace en base (publiée
   * OU réservée) ou un pin vivant chez Pinterest. Aucune notion de board ici :
   * une seule publication par produit, point.
   */
  private isAlreadyPublished(productId: string): boolean {
    if (this.publishedProductIds.has(productId)) return true
    return this.getProductPins(productId).length > 0
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

  /**
   * Les produits éligibles n'ont, par construction, aucune publication : on
   * prend donc simplement le plus récemment créé (même règle qu'Instagram, la
   * nouveauté part en premier).
   */
  private getNextProduct(products: ShopifyProduct[]): ShopifyProduct {
    return [...products].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0]
  }

  private pickBoard(product: ShopifyProduct): Board {
    const matchingBoards = this.matcher.getMatchingBoards(product, this.boards)
    return matchingBoards[Math.floor(Math.random() * matchingBoards.length)]
  }
}
