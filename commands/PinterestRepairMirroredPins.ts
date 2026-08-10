import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import type { PinterestPin } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'
import Pinterest from 'App/Services/Pinterest'
import PinFormatter from 'App/Services/Pinterest/PinFormatter'
import Shopify from 'App/Services/Shopify'
import SocialPublication from 'App/Models/SocialPublication'

/**
 * Répare les pins recopiés automatiquement depuis Instagram.
 *
 * Un partage automatique Instagram → Pinterest recopie chaque publication du
 * compte sur un board dédié. Ces pins-là posent trois problèmes :
 *
 *   - ils n'ont AUCUN titre (Instagram n'a pas de champ titre, le miroir laisse
 *     donc le champ vide) ;
 *   - leur lien pointe vers `instagram.com` et non vers la fiche produit : les
 *     clics partent chez Meta au lieu de la boutique ;
 *   - ils font doublon visuel avec le pin que le backend publie pour la même
 *     œuvre — c'est l'origine du signalement « le même produit publié deux
 *     fois, une fois en carrousel sans titre ».
 *
 * Ce sont pourtant, et de loin, les pins les plus vus du compte. On les répare
 * plutôt que de les supprimer : titre posé, lien repointé sur la fiche produit,
 * et titres de diapositives pour les carrousels.
 *
 * RATTACHEMENT AU PRODUIT : le miroir publie une fois par jour la publication
 * Instagram de la VEILLE. Le registre `social_publications` connaissant le
 * produit posté chaque jour sur Instagram, la correspondance J-1 est
 * déterministe — vérifiée sur les 32 pins concernés, et recoupée sur le contenu
 * des légendes.
 */
export default class PinterestRepairMirroredPins extends BaseCommand {
  public static commandName = 'pinterest:repair_mirrored_pins'
  public static description =
    'Répare les pins recopiés depuis Instagram : titre ajouté et lien repointé vers la fiche produit. Sans --yes, simple simulation.'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.boolean({
    description: 'Applique réellement les corrections. Sans ce drapeau, simple simulation.',
  })
  public yes: boolean

  public async run() {
    const shopify = new Shopify()
    const products = await shopify.product.getAll()
    const productById = new Map(products.map((product) => [product.id, product]))

    const rows = await SocialPublication.query().whereIn('channel', ['instagram', 'pinterest'])
    const productByInstagramDay = new Map<string, string>()
    const titleByProduct = new Map<string, string>()
    for (const row of rows) {
      if (row.channel === 'instagram') {
        productByInstagramDay.set(row.publishedAt.toFormat('yyyy-MM-dd'), row.shopifyProductId)
      } else {
        const title = (row.metadata as any)?.title
        if (title) titleByProduct.set(row.shopifyProductId, title)
      }
    }

    const pinterest = new Pinterest([])
    await pinterest.initialize()
    const mirrored = (await pinterest.fetcher.getAllPins()).filter(
      PinterestRepairMirroredPins.isMirroredFromInstagram
    )

    this.logger.info(`${mirrored.length} pin(s) recopié(s) depuis Instagram.`)
    if (mirrored.length === 0) {
      this.logger.success('Rien à réparer.')
      return
    }

    let repaired = 0
    const skipped: Array<{ id: string; reason: string }> = []

    for (const pin of mirrored) {
      const productId = productByInstagramDay.get(PinterestRepairMirroredPins.instagramDayOf(pin))
      const product = productId ? productById.get(productId) : undefined
      if (!product) {
        skipped.push({
          id: pin.id,
          reason: `aucun produit rattaché (${productId ?? 'date inconnue'})`,
        })
        continue
      }

      const title = titleByProduct.get(product.id) || product.title
      let link: string
      try {
        link = PinterestRepairMirroredPins.productLink(product)
      } catch {
        skipped.push({ id: pin.id, reason: `fiche produit sans URL exploitable (${product.id})` })
        continue
      }

      const slotCount = pin.media?.items?.length ?? 0
      this.logger.info(
        `${this.yes ? '' : '[SIMULATION] '}pin ${pin.id}${slotCount ? ` (${slotCount} diapos)` : ''} → « ${title} » → ${link}`
      )

      if (!this.yes) continue

      try {
        const slot = PinFormatter.buildCarouselSlot(title, pin.description ?? '', link)
        await pinterest.poster.updatePin(pin.id, {
          title,
          link,
          // Sur un carrousel, c'est le titre de la DIAPOSITIVE qui s'affiche :
          // sans lui le pin resterait muet malgré son titre.
          ...(slotCount > 0
            ? {
                carousel_slots: Array.from({ length: slotCount }, () => ({
                  title: slot.title,
                  link,
                })),
              }
            : {}),
        })
        repaired++
      } catch (error) {
        const reason = (error as any)?.message ?? String(error)
        skipped.push({ id: pin.id, reason })
        this.logger.error(`  échec ${pin.id} : ${reason}`)
      }
    }

    if (!this.yes) {
      this.logger.warning('\n[SIMULATION] Aucun pin modifié. Relancer avec --yes pour appliquer.')
      return
    }

    this.logger.info(`\nTerminé : ${repaired} réparé(s), ${skipped.length} ignoré(s).`)
    for (const entry of skipped) {
      this.logger.warning(`  ${entry.id} — ${entry.reason}`)
    }
  }

  /** Un pin du miroir se reconnaît à son lien, qui pointe vers Instagram. */
  private static isMirroredFromInstagram(pin: PinterestPin): boolean {
    try {
      return new URL(pin.link).hostname.endsWith('instagram.com')
    } catch {
      return false
    }
  }

  /** Le miroir publie la veille : on remonte d'un jour pour retrouver le produit. */
  private static instagramDayOf(pin: PinterestPin): string {
    const created = new Date(`${pin.created_at}Z`)
    created.setUTCDate(created.getUTCDate() - 1)
    return created.toISOString().slice(0, 10)
  }

  private static productLink(product: ShopifyProduct): string {
    const url = new URL(product.onlineStoreUrl)
    url.searchParams.set('shopify_product_id', product.id)
    return url.toString()
  }
}
