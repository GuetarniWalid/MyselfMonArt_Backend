import { DateTime } from 'luxon'
import type { InstagramPostFormat } from 'Types/Instagram'
import type { Product as ShopifyProduct } from 'Types/Product'
import Instagram from 'App/Services/Instagram'
import FormatSelector from 'App/Services/Instagram/FormatSelector'
import PostFormatter from 'App/Services/Instagram/PostFormatter'
import PublicationSelector from 'App/Services/Instagram/PublicationSelector'
import Shopify from 'App/Services/Shopify'
import SocialPublication from 'App/Models/SocialPublication'
import { describeError, isAmbiguousPublishFailure } from 'App/Services/Social/PublishError'

/** Mémorise la légende réellement construite, pour la réconciliation. */
type Attempt = { caption?: string }

/**
 * Orchestrates one Instagram-publication tick, fully decoupled from Pinterest.
 *
 *   - Reads the Shopify catalog and the set of products already posted to the
 *     IG feed (`social_publications`, channel='instagram')
 *   - Selects the most recently created product not yet posted to IG
 *   - Picks a format via the weighted fixed cycle (reel / carousel / image),
 *     constrained by what the product can actually produce
 *   - Publishes it and records the publication, including the format used
 *   - When the whole catalog is already posted, does nothing (no re-posting)
 *
 * Deux garde-fous contre le doublon (un même produit publié en carrousel PUIS
 * en simple image) :
 *
 *   1. RÉSERVATION AVANT L'APPEL RÉSEAU — la ligne `social_publications` est
 *      créée en `pending` avant de contacter Meta. Un crash entre le post et sa
 *      confirmation ne remet donc jamais le produit dans la file.
 *   2. REPLI SÛR — le repli « format riche → image » ne se déclenche que si
 *      l'échec est survenu AVANT que Meta n'ait pu publier. Sur un timeout ou un
 *      5xx pendant POST /media_publish, le post peut déjà être en ligne :
 *      republier, c'est afficher deux fois la même œuvre.
 *
 * Cadence is driven entirely by the once-a-day cron (PublishInstagramDaily),
 * so there is no in-service frequency cap.
 */
export default class InstagramPublication {
  public async run() {
    const shopify = new Shopify()
    const products = await shopify.product.getAll()

    const alreadyPostedProductIds = await this.getAlreadyPostedProductIds()
    const selector = new PublicationSelector(products, alreadyPostedProductIds)
    const product = selector.selectNextProductToPublish()

    if (!product) {
      console.log(
        '⏭️  Instagram skipped — whole catalog already posted to the IG feed (nothing new)'
      )
      return
    }

    const videoUrl = await shopify.metafield.getVideoUrl(product.id)
    const format = new FormatSelector().select({
      // Each IG post is a distinct product (the catalog is never re-posted), so
      // the number of already-posted products == number of IG posts == position
      // in the format cycle.
      priorPostCount: alreadyPostedProductIds.size,
      hasVideo: Boolean(videoUrl),
      carouselSlideCount: PostFormatter.carouselSlideNodes(product.media?.nodes ?? []).length,
    })

    const reservation = await SocialPublication.create({
      channel: 'instagram',
      shopifyProductId: product.id,
      externalId: null,
      status: 'pending',
      publishedAt: DateTime.now(),
      metadata: { format },
    })

    const instagram = new Instagram()
    const attempt: Attempt = {}

    let result: { mediaId: string; usedFormat: InstagramPostFormat }
    try {
      result = await this.publishInFormat(instagram, format, product, videoUrl, attempt)
    } catch (error) {
      // Le nettoyage ne doit jamais remplacer l'erreur d'origine dans les logs :
      // c'est ce masquage qui avait rendu un jeton expiré indétectable pendant
      // des semaines (on ne lisait que « Connection timeout »).
      try {
        await this.handlePublishFailure(instagram, reservation, product, attempt, error)
      } catch (cleanupError) {
        console.error(
          `[Instagram] Nettoyage de la réservation impossible: ${(cleanupError as any)?.message ?? cleanupError}`
        )
      }
      throw error
    }

    reservation.merge({
      externalId: result.mediaId,
      status: 'published',
      publishedAt: DateTime.now(),
      metadata: { format: result.usedFormat },
    })
    await reservation.save()

    console.log(
      `✅ Instagram ${result.usedFormat} published (product=${product.id}, media id=${result.mediaId})`
    )
  }

  /**
   * Échec sans ambiguïté (payload invalide, conteneur refusé, 4xx explicite) :
   * rien n'a été publié, on libère la réservation et le produit repartira.
   *
   * Échec ambigu (timeout / 5xx pendant POST /media_publish) : le post est
   * peut-être en ligne. On garde la réservation — le produit ne sera jamais
   * republié — et on tente de retrouver le média via sa légende.
   */
  private async handlePublishFailure(
    instagram: Instagram,
    reservation: SocialPublication,
    product: ShopifyProduct,
    attempt: Attempt,
    error: unknown
  ): Promise<void> {
    if (!isAmbiguousPublishFailure(error)) {
      await reservation.delete()
      return
    }

    console.warn(
      `⚠️  Instagram: échec ambigu pour ${product.id} — le post existe peut-être, aucune republication. ${describeError(error)}`
    )

    const mediaId = attempt.caption
      ? await instagram.poster.findRecentMediaByCaption(attempt.caption)
      : null

    if (mediaId) {
      reservation.merge({
        externalId: mediaId,
        status: 'published',
        metadata: { format: 'unknown', reconciled: true },
      })
      await reservation.save()
      console.log(`🔗 Instagram: post orphelin réconcilié (media id=${mediaId})`)
      return
    }

    // Rien retrouvé : la réservation reste en `pending` et continue d'exclure le
    // produit. Perdre une publication est préférable à un doublon visible.
    console.warn(
      `⚠️  Instagram: aucun post retrouvé pour ${product.id}; la réservation reste en pending.`
    )
  }

  private async publishInFormat(
    instagram: Instagram,
    format: InstagramPostFormat,
    product: ShopifyProduct,
    videoUrl: string | null,
    attempt: Attempt
  ): Promise<{ mediaId: string; usedFormat: InstagramPostFormat }> {
    try {
      if (format === 'reel') {
        if (!videoUrl) throw new Error('reel format chosen but product has no videoUrl')
        const payload = await instagram.postFormatter.buildReelPayload(product, videoUrl)
        attempt.caption = payload.caption
        const { mediaId } = await instagram.poster.publishReel(payload)
        return { mediaId, usedFormat: 'reel' }
      }
      if (format === 'carousel') {
        const payload = await instagram.postFormatter.buildCarouselPayload(product)
        attempt.caption = payload.caption
        const { mediaId } = await instagram.poster.publishCarousel(payload)
        return { mediaId, usedFormat: 'carousel' }
      }
      const payload = await instagram.postFormatter.buildPostPayload(product)
      attempt.caption = payload.caption
      const { mediaId } = await instagram.poster.publishPost(payload)
      return { mediaId, usedFormat: 'image' }
    } catch (error) {
      if (format === 'image') throw error
      // Le repli ne doit JAMAIS transformer un post peut-être publié en second post.
      if (isAmbiguousPublishFailure(error)) throw error
      // Reliability: a richer format failing *before* Meta published anything
      // (vidéo au mauvais ratio, conteneur refusé) should not cost us the day's
      // post — fall back to a single image, the most robust path.
      console.warn(
        `⚠️  Instagram ${format} failed, falling back to single image:`,
        describeError(error)
      )
      const payload = await instagram.postFormatter.buildPostPayload(product)
      attempt.caption = payload.caption
      const { mediaId } = await instagram.poster.publishPost(payload)
      return { mediaId, usedFormat: 'image' }
    }
  }

  /**
   * Produits déjà postés sur le feed IG — réservations `pending` comprises, pour
   * qu'une publication interrompue ne puisse pas repartir une seconde fois.
   */
  private async getAlreadyPostedProductIds(): Promise<Set<string>> {
    const rows = await SocialPublication.query()
      .where('channel', 'instagram')
      .select('shopify_product_id')
    return new Set(rows.map((row) => row.shopifyProductId))
  }
}
