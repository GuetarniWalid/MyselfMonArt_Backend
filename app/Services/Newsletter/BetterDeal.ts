import Logger from '@ioc:Adonis/Core/Logger'
import Shopify from 'App/Services/Shopify'

/**
 * LE POINT D'HONNÊTETÉ DU 3ᵉ E-MAIL — « au-delà de X de panier, la promotion en cours est plus
 * avantageuse que votre bon ».
 *
 * ⛔ CE SEUIL NE SE CONVERTIT PAS, IL SE CALCULE. Le gabarit du designer l'écrivait « 150 € »,
 * et la première idée est de convertir : 150 € → ~173 $. C'est FAUX, et c'est faux à cause de la
 * correction 5 elle-même.
 *
 * Le bon d'un Américain ne vaut pas 150 € convertis : il vaut 15 $, une cible RONDE choisie par
 * le marchand, pas le résultat d'un taux de change. Le croisement se calcule donc entièrement
 * dans la devise du lecteur :
 *
 *     seuil = montant du bon (dans SA devise) ÷ taux de la promotion automatique
 *
 *     EUR  15 € ÷ 10 %  = 150 €        USD  15 $ ÷ 10 %  = 150 $   (et non 173 $)
 *     CAD  20 $ CA ÷ 10 % = 200 $ CA   CHF  14 CHF ÷ 10 % = 140 CHF
 *     GBP  13 £ ÷ 10 %  = 130 £
 *
 * Convertir aurait annoncé 173 $ à un Américain dont le bon est battu par la promotion dès
 * 150 $ : on lui aurait fait garder un code qui lui coûte de l'argent, dans le paragraphe dont
 * TOUT L'INTÉRÊT est l'honnêteté.
 *
 * ⛔ ET LE TAUX EST LU CHEZ SHOPIFY, JAMAIS ÉCRIT EN DUR. La promotion du moment
 * (« Vacance d'été ☀️ », −10 %) expire le 2026-08-30. Un seuil figé continuerait d'annoncer une
 * promotion qui n'existe plus — et le marchand veut « régler une fois et ne plus jamais y
 * toucher ». Sans promotion active, `null` : le paragraphe DISPARAÎT entièrement plutôt que de
 * décrire une offre imaginaire.
 */

/** Ce qu'on a retenu de la promotion automatique en cours. */
export interface BetterDeal {
  /** Part de remise, en fraction : 0,1 pour −10 %. */
  rate: number
  /** Titre de la promotion, pour le journal — jamais affiché au client. */
  title: string
}

/**
 * Durée de mise en cache. Un passage du cron envoie jusqu'à 20 e-mails : sans cache, c'est 20
 * lectures identiques. Une promotion ne change pas dans l'heure, et le pire cas d'un cache
 * périmé est d'omettre le paragraphe (ou de le montrer une heure de trop) — jamais d'annoncer
 * un seuil faux, puisque le taux et le seuil viennent de la même lecture.
 */
const CACHE_TTL_MS = 60 * 60 * 1000

let cached: { at: number; deal: BetterDeal | null } | null = null

export default class NewsletterBetterDeal {
  private shopify = new Shopify()

  /**
   * La promotion automatique en pourcentage actuellement active, ou `null`.
   *
   * Ne lève JAMAIS : ce paragraphe est un bonus de confiance, il ne doit pas retenir un e-mail.
   * Une panne de lecture rend `null`, donc omet le paragraphe.
   */
  public async current(): Promise<BetterDeal | null> {
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.deal

    let deal: BetterDeal | null = null
    try {
      deal = await this.read()
    } catch (error) {
      // On ne met PAS en cache un échec : la prochaine tentative doit rejouer, sans quoi une
      // panne d'une seconde effacerait le paragraphe pour une heure.
      Logger.info(
        'newsletter meilleure affaire: lecture impossible (paragraphe omis) — %s',
        (error as any)?.message ?? error
      )
      return null
    }

    cached = { at: Date.now(), deal }
    return deal
  }

  /**
   * Seuil à annoncer, DANS LA DEVISE DU LECTEUR. `null` = pas de promotion, pas de paragraphe.
   *
   * Arrondi à l'unité SUPÉRIEURE, et le sens compte : sous le seuil annoncé, le bon doit être
   * réellement au moins aussi avantageux. Arrondir vers le bas ferait dire « gardez votre
   * argent » à quelqu'un dont le bon vaut encore plus que la promotion.
   */
  public async thresholdFor(voucherAmount: number): Promise<number | null> {
    const deal = await this.current()
    if (!deal || !(deal.rate > 0)) return null
    return Math.ceil(voucherAmount / deal.rate)
  }

  // --- interne ---------------------------------------------------------------------

  private async read(): Promise<BetterDeal | null> {
    const promos = await this.shopify.discount.getActiveAutomaticPercentages()
    const nowMs = Date.now()

    let best: BetterDeal | null = null

    for (const promo of promos) {
      if (promo.status !== 'ACTIVE') continue

      // `status:active` est le filtre de Shopify ; on revérifie l'échéance nous-mêmes, parce
      // que c'est cette date-là qui rend le paragraphe vrai ou faux, et qu'elle tombe pendant
      // la vie d'une séquence en cours.
      if (promo.endsAt && Date.parse(promo.endsAt) <= nowMs) continue
      if (!Number.isFinite(promo.percentage) || promo.percentage <= 0) continue

      // La promotion la plus forte est celle qui croise le plus tôt : c'est elle qui rend le
      // conseil vrai. En annoncer une plus faible ferait garder le bon trop longtemps.
      if (!best || promo.percentage > best.rate) {
        best = { rate: promo.percentage, title: promo.title }
      }
    }

    if (best) {
      Logger.info(
        'newsletter meilleure affaire: promotion « %s » à %s %% retenue',
        best.title,
        Math.round(best.rate * 100)
      )
    }
    return best
  }
}
