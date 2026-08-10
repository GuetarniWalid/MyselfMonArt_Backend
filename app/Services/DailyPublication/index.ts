import { DateTime } from 'luxon'
import type { Board, PinterestPin, PinterestPinFormat } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'
import Pinterest from 'App/Services/Pinterest'
import PinterestFormatSelector from 'App/Services/Pinterest/PinterestFormatSelector'
import PinFormatter from 'App/Services/Pinterest/PinFormatter'
import Shopify from 'App/Services/Shopify'
import SocialPublication from 'App/Models/SocialPublication'
import { describeError, isAmbiguousPublishFailure } from 'App/Services/Social/PublishError'

/**
 * Orchestre un tick de publication Pinterest : sélectionne le prochain produit
 * (un produit n'est publié QU'UNE FOIS, cf. PublicationSelector), choisit un
 * format via le cycle pondéré, publie un seul pin et l'enregistre.
 *
 * Deux garde-fous contre le doublon :
 *
 *   1. RÉSERVATION AVANT L'APPEL RÉSEAU — la ligne `social_publications` est
 *      créée en `pending` avant de contacter Pinterest. Si le process meurt
 *      entre le pin et sa confirmation, le produit reste exclu des prochaines
 *      sélections : on préfère perdre une publication qu'en émettre deux.
 *   2. REPLI SÛR — le repli « format riche → image » ne se déclenche que si
 *      l'échec est survenu AVANT que Pinterest n'ait pu créer quoi que ce soit.
 *      Sur un timeout ou un 5xx pendant POST /pins, le pin peut très bien
 *      exister : republier reviendrait à afficher deux fois le même tableau.
 *
 * Instagram tourne sur son propre cron (PublishInstagramDaily →
 * InstagramPublication) avec sa propre logique de sélection.
 */
export default class DailyPublication {
  public async run() {
    const shopify = new Shopify()
    const [products, collections] = await Promise.all([
      shopify.product.getAll(),
      shopify.collection.getAll(),
    ])

    const publishedProductIds = await this.getPublishedProductIds()
    const pinterest = new Pinterest(products, collections, publishedProductIds)
    await pinterest.initialize()
    await pinterest.autoCreateMissingBoards()

    const selected = await pinterest.publicationSelector.selectNextProductToPublish()
    if (!selected) {
      console.log('⏭️  Pinterest skipped — tout le catalogue de toiles est déjà épinglé.')
      return
    }
    const { product, board } = selected

    const videoUrl = await shopify.metafield.getVideoUrl(product.id)
    const format = new PinterestFormatSelector().select({
      // The deterministic cycle position is driven by how many pins we've
      // already published to Pinterest overall.
      priorPostCount: await this.getPinterestPublicationCount(),
      hasVideo: Boolean(videoUrl),
      carouselSlideCount: PinFormatter.carouselSlideNodes(product.media?.nodes ?? []).length,
    })

    const reservation = await SocialPublication.create({
      channel: 'pinterest',
      shopifyProductId: product.id,
      externalId: null,
      externalBoardId: board.id,
      status: 'pending',
      publishedAt: DateTime.now(),
      metadata: { boardName: board.name, format },
    })

    let published: { pin: PinterestPin; usedFormat: PinterestPinFormat }
    try {
      published = await this.publishInFormat(pinterest, format, product, board, videoUrl)
    } catch (error) {
      // Le nettoyage ne doit jamais remplacer l'erreur d'origine dans les logs :
      // c'est ce masquage qui avait rendu un jeton expiré indétectable pendant
      // des semaines (on ne lisait que « Connection timeout »).
      try {
        await this.handlePublishFailure(reservation, pinterest, product, board, error)
      } catch (cleanupError) {
        console.error(
          `[Pinterest] Nettoyage de la réservation impossible: ${(cleanupError as any)?.message ?? cleanupError}`
        )
      }
      throw error
    }

    reservation.merge({
      externalId: published.pin.id,
      status: 'published',
      publishedAt: DateTime.now(),
      metadata: {
        title: published.pin.title,
        boardName: board.name,
        format: published.usedFormat,
      },
    })
    await reservation.save()

    console.log(
      `✅ Pinterest ${published.usedFormat} pin published (id=${published.pin.id}, board=${board.name})`
    )
  }

  /**
   * Un échec sans ambiguïté (payload invalide, images manquantes, 4xx explicite)
   * signifie qu'aucun pin n'existe : on libère la réservation pour que le
   * produit reparte au prochain tick.
   *
   * Un échec ambigu (timeout, 5xx, socket coupé pendant POST /pins) peut cacher
   * un pin réellement créé. On garde alors la réservation — le produit ne sera
   * jamais re-publié — et on tente de retrouver le pin pour compléter la ligne.
   */
  private async handlePublishFailure(
    reservation: SocialPublication,
    pinterest: Pinterest,
    product: ShopifyProduct,
    board: Board,
    error: unknown
  ): Promise<void> {
    if (!isAmbiguousPublishFailure(error)) {
      await reservation.delete()
      return
    }

    console.warn(
      `⚠️  Pinterest: échec ambigu pour ${product.id} — le pin existe peut-être, aucune republication. ${describeError(error)}`
    )

    const orphan = await this.findOrphanPin(pinterest, product.id, board.id)
    if (orphan) {
      reservation.merge({
        externalId: orphan.id,
        status: 'published',
        metadata: {
          title: orphan.title,
          boardName: board.name,
          format: 'unknown',
          reconciled: true,
        },
      })
      await reservation.save()
      console.log(`🔗 Pinterest: pin orphelin réconcilié (id=${orphan.id})`)
      return
    }

    // Rien retrouvé : la réservation reste en `pending` et continue d'exclure
    // le produit. Perdre une publication est préférable à un doublon visible.
    console.warn(
      `⚠️  Pinterest: aucun pin retrouvé pour ${product.id}; la réservation reste en pending.`
    )
  }

  /**
   * Cherche, sur la première page des pins récents, un pin pointant vers ce
   * produit. Best-effort : toute erreur est avalée, la réconciliation n'est
   * qu'un confort de traçabilité.
   */
  private async findOrphanPin(
    pinterest: Pinterest,
    productId: string,
    boardId: string
  ): Promise<PinterestPin | null> {
    try {
      const recent = await pinterest.fetcher.getRecentPins()
      const numericId = productId.replace('gid://shopify/Product/', '')
      return (
        recent.find((pin) => {
          if (pin.board_id !== boardId) return false
          try {
            const pinProductId = new URL(pin.link).searchParams.get('shopify_product_id')
            return Boolean(pinProductId) && pinProductId!.replace(/\D/g, '') === numericId
          } catch {
            return false
          }
        }) ?? null
      )
    } catch (reconcileError) {
      console.warn(
        `⚠️  Pinterest: réconciliation impossible: ${(reconcileError as any)?.message ?? reconcileError}`
      )
      return null
    }
  }

  private async publishInFormat(
    pinterest: Pinterest,
    format: PinterestPinFormat,
    product: ShopifyProduct,
    board: Board,
    videoUrl: string | null
  ): Promise<{ pin: PinterestPin; usedFormat: PinterestPinFormat }> {
    try {
      if (format === 'video') {
        if (!videoUrl) throw new Error('video format chosen but product has no videoUrl')
        const videoBuffer = await pinterest.pinFormatter.downloadVideoBuffer(videoUrl)
        const mediaId = await pinterest.poster.uploadVideo(videoBuffer)
        const payload = await pinterest.pinFormatter.buildVideoPinPayload(product, board, mediaId)
        const pin = await pinterest.poster.publishPin(payload)
        return { pin, usedFormat: 'video' }
      }
      if (format === 'carousel') {
        const payload = await pinterest.pinFormatter.buildCarouselPinPayload(product, board)
        const pin = await pinterest.poster.publishPin(payload)
        return { pin, usedFormat: 'carousel' }
      }
      const payload = await pinterest.pinFormatter.buildPinPayload(product, board)
      const pin = await pinterest.poster.publishPin(payload)
      return { pin, usedFormat: 'image' }
    } catch (error) {
      if (format === 'image') throw error
      // Le repli ne doit JAMAIS transformer un pin peut-être créé en second pin.
      if (isAmbiguousPublishFailure(error)) throw error
      // Reliability: a richer format failing *before* Pinterest created anything
      // (vidéo refusée, ratio de carrousel invalide, 4xx explicite) must not cost
      // us the day's pin — fall back to a single image, the most robust path.
      console.warn(
        `⚠️  Pinterest ${format} failed, falling back to single image:`,
        describeError(error)
      )
      const payload = await pinterest.pinFormatter.buildPinPayload(product, board)
      const pin = await pinterest.poster.publishPin(payload)
      return { pin, usedFormat: 'image' }
    }
  }

  private async getPinterestPublicationCount(): Promise<number> {
    const result = await SocialPublication.query().where('channel', 'pinterest').count('* as total')
    return Number(result[0].$extras.total ?? 0)
  }

  /**
   * Tous les produits déjà publiés sur Pinterest — réservations `pending`
   * comprises — lus depuis NOTRE base. Injectés dans le sélecteur pour garantir
   * qu'un produit n'est publié qu'une seule fois, quel que soit le format et le
   * board, et sans dépendre de ce que l'API Pinterest renvoie.
   */
  private async getPublishedProductIds(): Promise<Set<string>> {
    const rows = await SocialPublication.query()
      .where('channel', 'pinterest')
      .select('shopify_product_id')
    return new Set(rows.map((row) => row.shopifyProductId))
  }
}
