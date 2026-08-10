import { DateTime } from 'luxon'
import SocialPublication, { SocialChannel } from 'App/Models/SocialPublication'
import { isDuplicateKeyError } from 'App/Services/Social/PublishError'

/**
 * Registre des publications sociales, partagé par le cron ET par les commandes
 * de test manuelles.
 *
 * Les commandes `*:test_publish_one` publiaient de vrais posts sans jamais rien
 * écrire dans `social_publications` — et, faute de `--product`, visaient par
 * défaut le produit le plus récent, c'est-à-dire justement celui que le cron
 * venait de publier. D'où des produits publiés deux fois, invisibles en base.
 * Toute publication réelle passe désormais par ici.
 */
export default class PublicationLedger {
  /** Le produit a-t-il déjà une ligne (publiée ou simplement réservée) ? */
  public static async isPublished(channel: SocialChannel, productId: string): Promise<boolean> {
    const existing = await SocialPublication.query()
      .where('channel', channel)
      .where('shopify_product_id', productId)
      .first()
    return existing !== null
  }

  /**
   * Garde-fou des publications manuelles : refuse de republier un produit déjà
   * présent au registre, sauf intention explicite.
   */
  public static async assertPublishable(
    channel: SocialChannel,
    productId: string,
    force: boolean = false
  ): Promise<void> {
    if (force) return
    if (await PublicationLedger.isPublished(channel, productId)) {
      throw new Error(
        `${channel}: le produit ${productId} a déjà été publié (voir social_publications). ` +
          `Republier créerait un doublon. Utiliser --force pour passer outre en connaissance de cause.`
      )
    }
  }

  /**
   * Réserve la publication AVANT tout appel réseau.
   *
   * Renvoie `null` si la contrainte `uq_channel_product` refuse l'insertion :
   * une autre exécution tient déjà ce produit (cron et lancement manuel qui se
   * chevauchent). L'appelant doit alors abandonner son tick en silence — c'est
   * la garantie que deux exécutions concurrentes ne publient jamais deux fois
   * le même produit, là où une simple lecture préalable laissait la fenêtre
   * ouverte.
   */
  public static async reserve(input: {
    channel: SocialChannel
    productId: string
    externalBoardId?: string | null
    metadata: Record<string, unknown>
  }): Promise<SocialPublication | null> {
    try {
      return await SocialPublication.create({
        channel: input.channel,
        shopifyProductId: input.productId,
        externalId: null,
        externalBoardId: input.externalBoardId ?? null,
        status: 'pending',
        publishedAt: DateTime.now(),
        metadata: input.metadata,
      })
    } catch (error) {
      if (isDuplicateKeyError(error)) return null
      throw error
    }
  }

  /** Enregistre une publication réelle déclenchée à la main. */
  public static async recordManual(input: {
    channel: SocialChannel
    productId: string
    externalId: string
    externalBoardId?: string | null
    format: string
    title?: string
    boardName?: string
  }): Promise<void> {
    await SocialPublication.create({
      channel: input.channel,
      shopifyProductId: input.productId,
      externalId: input.externalId,
      externalBoardId: input.externalBoardId ?? null,
      status: 'published',
      publishedAt: DateTime.now(),
      metadata: {
        format: input.format,
        source: 'manual',
        ...(input.title ? { title: input.title } : {}),
        ...(input.boardName ? { boardName: input.boardName } : {}),
      },
    })
  }
}
