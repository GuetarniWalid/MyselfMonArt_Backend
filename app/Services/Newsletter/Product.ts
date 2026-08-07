import Logger from '@ioc:Adonis/Core/Logger'
import Shopify from 'App/Services/Shopify'
import { localePath } from './emails/template'
import { extractHandle } from './sourceUrl'
import { moneyLabel } from './currency'
import { BEST_SELLERS_COLLECTION } from './config'
import type { RenderProduct } from './emails/template'
import type { VoucherCurrency } from './currency'
import type { NewsletterLocale } from './config'

/**
 * LES ŒUVRES AFFICHÉES DANS LES E-MAILS — celle qu'on regardait, et les plus vendues.
 *
 * L'encart s'affiche sur une fiche produit : `source_url` dit donc quelle œuvre la personne
 * avait sous les yeux quand elle a demandé son bon. Le rappeler dans l'e-mail transforme un
 * message générique en « votre bon, et le tableau que vous regardiez ».
 *
 * ⛔ TOUT ÉCHEC REND `null`, ET LE GABARIT SUPPRIME LE BLOC ENTIER. Jamais d'image cassée,
 * jamais de « undefined », jamais de prix vide : un bloc à moitié rempli est pire qu'un bloc
 * absent, et c'est le genre de détail qui fait douter de tout le message.
 *
 * ⛔ LES PRIX VIENNENT DE `contextualPricing`, JAMAIS D'UNE CONVERSION MAISON. Une œuvre à
 * 62,50 € se vend 78,00 $ aux États-Unis et 131,00 $ CA au Canada : la liste de prix applique
 * un ajustement en pourcentage APRÈS la conversion. Convertir soi-même au taux BCE afficherait
 * un prix que le paiement contredit — exactement l'annonce trompeuse qu'on évite sur le bon.
 */

export type { RenderProduct }

/**
 * Pays représentatif de chaque devise, quand le thème n'a pas transmis le pays.
 *
 * Sert UNIQUEMENT à demander le bon prix contextuel à Shopify : à devise égale, tous les
 * marchés d'une devise partagent la même grille (§ pricing par marché).
 */
const CURRENCY_COUNTRY: Record<VoucherCurrency, string> = {
  EUR: 'FR',
  USD: 'US',
  CAD: 'CA',
  CHF: 'CH',
  GBP: 'GB',
}

/**
 * Combien d'œuvres demander pour n'en garder que deux.
 *
 * On en demande plus que nécessaire parce qu'une partie sera écartée : image manquante, prix
 * indisponible sur ce marché. Sans marge, un seul trou ferait tomber le bloc sous deux œuvres
 * et le supprimerait.
 */
const BEST_SELLERS_FETCH = 8

/** Mise en cache des plus vendues, par marché et par langue. Elles ne bougent pas dans l'heure. */
const CACHE_TTL_MS = 60 * 60 * 1000
const bestSellersCache = new Map<string, { at: number; items: RenderProduct[] }>()

export default class NewsletterProductLookup {
  private shopify = new Shopify()

  /**
   * Résout le produit d'une `source_url`. `null` dès que quoi que ce soit manque.
   *
   * Ne lève JAMAIS : un e-mail doit partir même si la fiche a été dépubliée entre-temps.
   */
  public async fromSourceUrl(
    sourceUrl: string | null,
    locale: NewsletterLocale,
    currency: VoucherCurrency,
    /** Montant du bon DANS LA DEVISE D'AFFICHAGE, pour la ligne « soit X avec votre bon ». */
    voucherAmount: number,
    country?: string | null,
    /** Préfixe du MARCHÉ du destinataire ; `null` = repli sur le préfixe de langue. */
    pathPrefix?: string | null
  ): Promise<RenderProduct | null> {
    const handle = extractHandle(sourceUrl)
    if (!handle) return null

    try {
      const node = await this.shopify.product.getForNewsletter({
        handle,
        country: countryFor(currency, country),
        locale,
      })
      if (!node) return null
      return toRenderProduct(node, handle, locale, voucherAmount, pathPrefix)
    } catch (error) {
      Logger.info(
        'newsletter produit: %s non résolu (bloc omis) — %s',
        handle,
        (error as any)?.message ?? error
      )
      return null
    }
  }

  /**
   * Les plus vendues, pour le 2ᵉ e-mail. Rend un tableau VIDE en cas d'échec — le gabarit
   * supprime alors le bloc, ce qui ne se remarque pas.
   */
  public async bestSellers(
    locale: NewsletterLocale,
    currency: VoucherCurrency,
    voucherAmount: number,
    country?: string | null,
    /** Préfixe du MARCHÉ du destinataire ; `null` = repli sur le préfixe de langue. */
    pathPrefix?: string | null
  ): Promise<RenderProduct[]> {
    const iso = countryFor(currency, country)
    // Le montant du bon entre dans la clé : il change la ligne « soit X avec votre bon », donc
    // deux devises ne peuvent pas partager une entrée de cache. Le préfixe aussi : il est dans
    // l'URL de chaque œuvre, et deux marchés partageant devise et langue servirait sinon à
    // l'un les liens de l'autre.
    const key = `${iso}|${locale}|${voucherAmount}|${pathPrefix ?? ''}`

    const hit = bestSellersCache.get(key)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items

    try {
      const nodes = await this.shopify.product.getBestSellersForNewsletter({
        handle: BEST_SELLERS_COLLECTION,
        country: iso,
        locale,
        first: BEST_SELLERS_FETCH,
      })

      const items = nodes
        .map((node) => toRenderProduct(node, node.handle, locale, voucherAmount, pathPrefix))
        .filter((p): p is RenderProduct => p !== null)
        .slice(0, 2)

      bestSellersCache.set(key, { at: Date.now(), items })
      return items
    } catch (error) {
      // On ne met PAS en cache un échec : la prochaine tentative doit rejouer.
      Logger.info(
        'newsletter plus vendues: indisponibles (bloc omis) — %s',
        (error as any)?.message ?? error
      )
      return []
    }
  }
}

/**
 * Met une fiche Shopify en forme pour le gabarit. `null` dès qu'un champ manque.
 *
 * ⛔ Un seul champ manquant suffit à tout annuler : un bloc à moitié rempli — image cassée,
 * prix vide — fait douter de tout le message, alors qu'un bloc absent ne se remarque pas.
 */
function toRenderProduct(
  node: { title: string; imageUrl: string; amount: string; currencyCode: string },
  handle: string,
  locale: NewsletterLocale,
  voucherAmount: number,
  pathPrefix?: string | null
): RenderProduct | null {
  const priceAmount = Number(node.amount)
  if (!node.title || !node.imageUrl || !handle) return null
  if (!Number.isFinite(priceAmount) || priceAmount <= 0 || !node.currencyCode) return null

  // Mis en forme dans la LANGUE du destinataire, avec la devise que Shopify a facturée : on
  // n'invente aucune devise et on ne convertit rien.
  const price = moneyLabel(priceAmount, node.currencyCode, locale)
  if (!price) return null

  // Le bon ne peut pas rendre une œuvre gratuite : on borne à zéro plutôt que d'afficher un
  // prix négatif. En pratique la ligne est de toute façon masquée sous le seuil du bon.
  const discounted = Math.max(0, priceAmount - voucherAmount)

  return {
    title: node.title,
    imageUrl: node.imageUrl,
    price,
    priceWithVoucher: moneyLabel(discounted, node.currencyCode, locale),
    priceAmount,
    // Reconstruit plutôt que repris d'`onlineStoreUrl` : il faut la vitrine du DESTINATAIRE,
    // pas celle de la page où il s'est inscrit.
    //
    // ⛔ Le préfixe est celui de son MARCHÉ, pas de sa langue. Le prix affiché juste au-dessus
    // vient de `contextualPricing`, donc du marché : un lien vers `/en` (marché France, euros)
    // sous un prix en dollars ferait mentir la ligne de prix au premier clic. `localePath` ne
    // sert que si la table des marchés manque.
    url: `https://www.myselfmonart.com${
      typeof pathPrefix === 'string' ? pathPrefix : localePath(locale)
    }/products/${handle}`,
  }
}

/** Pays à interroger : celui du visiteur s'il est connu, sinon le représentant de sa devise. */
function countryFor(currency: VoucherCurrency, country?: string | null): string {
  const iso = String(country ?? '')
    .trim()
    .toUpperCase()
  if (/^[A-Z]{2}$/.test(iso)) return iso
  return CURRENCY_COUNTRY[currency] ?? 'FR'
}
