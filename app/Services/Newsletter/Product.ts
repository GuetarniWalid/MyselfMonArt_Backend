import Logger from '@ioc:Adonis/Core/Logger'
import Shopify from 'App/Services/Shopify'
import { localePath } from './emails/template'
import { extractHandle, formatProductPrice } from './sourceUrl'
import type { VoucherCurrency } from './currency'
import type { NewsletterLocale } from './config'

/**
 * LE PRODUIT REGARDÉ AU MOMENT DE L'INSCRIPTION — bloc OPTIONNEL des e-mails.
 *
 * L'encart s'affiche sur une fiche produit : `source_url` dit donc quelle œuvre la personne
 * avait sous les yeux quand elle a demandé son bon. Le rappeler dans l'e-mail transforme un
 * message générique en « votre bon, et le tableau que vous regardiez ».
 *
 * ⛔ TOUT ÉCHEC REND `null`, ET LE GABARIT SUPPRIME LE BLOC ENTIER. Jamais d'image cassée,
 * jamais de « undefined », jamais de prix vide : un bloc à moitié rempli est pire qu'un bloc
 * absent, et c'est le genre de détail qui fait douter de tout le message.
 */

export interface NewsletterProduct {
  title: string
  imageUrl: string
  /** Prix DÉJÀ MIS EN FORME dans la devise de l'acheteur : « 59,50 € », « 74.00 $ ». */
  price: string
  /** URL de la fiche, préfixe de langue compris. */
  url: string
}

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
    country?: string | null
  ): Promise<NewsletterProduct | null> {
    const handle = extractHandle(sourceUrl)
    if (!handle) return null

    try {
      const node = await this.shopify.product.getForNewsletter({
        handle,
        country: countryFor(currency, country),
        locale,
      })
      // ⛔ Un seul champ manquant suffit à tout annuler : un bloc à moitié rempli — image
      // cassée, prix vide — fait douter de tout le message, alors qu'un bloc absent ne se
      // remarque pas.
      const price = node ? formatProductPrice(node.amount, node.currencyCode) : ''
      if (!node?.title || !node.imageUrl || !price) return null

      return {
        title: node.title,
        imageUrl: node.imageUrl,
        price,
        // Reconstruit plutôt que repris d'`onlineStoreUrl` : il faut le préfixe de LANGUE du
        // destinataire, pas celui de la page où il s'est inscrit. Un Néerlandais qui s'inscrit
        // depuis la version française doit recevoir le lien néerlandais.
        url: `https://www.myselfmonart.com${localePath(locale)}/products/${handle}`,
      }
    } catch (error) {
      Logger.info(
        'newsletter produit: %s non résolu (bloc omis) — %s',
        handle,
        (error as any)?.message ?? error
      )
      return null
    }
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
