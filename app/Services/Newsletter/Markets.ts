import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import Shopify from 'App/Services/Shopify'
import NewsletterState from 'App/Models/NewsletterState'
import type { VoucherCurrency } from './currency'

/**
 * LES MARCHÉS DE LA BOUTIQUE, GROUPÉS PAR DEVISE.
 *
 * ⛔ CONSTRUITE DYNAMIQUEMENT DEPUIS L'API, JAMAIS CODÉE EN DUR. Une liste figée ferait sortir
 * du dispositif, EN SILENCE, tout marché créé plus tard : le marchand ouvrirait l'Italie, les
 * inscrits italiens recevraient un bon inutilisable, et rien dans les journaux ne ressemblerait
 * à une panne. Le marchand veut régler ce dispositif une fois — ça suppose qu'il suive la
 * boutique tout seul.
 *
 * Au 2026-08-06 la boutique compte huit marchés actifs :
 *   EUR → France · europ · Allemagne · Espagne     USD → USA
 *   CAD → Canada     CHF → Suisse     GBP → angleterre
 *
 * La liste est mise en cache et rafraîchie par l'entretien quotidien : un marché change deux
 * fois par an, pas deux fois par heure, et le chemin d'inscription n'a pas à payer cette
 * lecture.
 */

const STATE_MARKETS = 'markets_by_currency'
const STATE_MARKETS_TS = 'markets_fetched_ts'

/** Au-delà, on retente. En dessous, le cache suffit. */
const REFRESH_AFTER_HOURS = 24

export type MarketsByCurrency = Record<string, string[]>

export default class NewsletterMarkets {
  private shopify = new Shopify()

  private static memo: { at: number; map: MarketsByCurrency } | null = null

  /**
   * Identifiants des marchés à cibler pour une devise.
   *
   * Lève si la liste ne peut être ni lue ni reconstruite : un code sans ciblage serait
   * utilisable depuis n'importe quel marché, donc un bon de 13 € offert à un Américain qui
   * verrait 15 $ calibrés pour lui — et l'inverse. Mieux vaut ne pas émettre de bon que d'en
   * émettre un mal calibré. En pratique ce cas n'arrive que si Shopify est indisponible, et
   * l'inscription a alors déjà échoué plus tôt.
   */
  public async idsFor(currency: VoucherCurrency): Promise<string[]> {
    const map = await this.byCurrency()
    const ids = map[currency] ?? []
    if (!ids.length) {
      throw new Error(`aucun marché actif en ${currency} — bon non ciblable`)
    }
    return ids
  }

  /** La table complète devise → identifiants de marché. */
  public async byCurrency(): Promise<MarketsByCurrency> {
    const nowTs = Math.floor(DateTime.now().toSeconds())

    if (NewsletterMarkets.memo && nowTs - NewsletterMarkets.memo.at < REFRESH_AFTER_HOURS * 3600) {
      return NewsletterMarkets.memo.map
    }

    const stored = await this.read()
    const fetchedTs = await NewsletterState.readNumber(STATE_MARKETS_TS)
    const fresh = fetchedTs !== null && nowTs - fetchedTs < REFRESH_AFTER_HOURS * 3600

    if (stored && fresh) {
      NewsletterMarkets.memo = { at: nowTs, map: stored }
      return stored
    }

    try {
      const map = await this.fetchFromShopify()
      await NewsletterState.write(STATE_MARKETS, JSON.stringify(map))
      await NewsletterState.write(STATE_MARKETS_TS, nowTs)
      NewsletterMarkets.memo = { at: nowTs, map }
      return map
    } catch (error) {
      // Le dernier état connu vaut mieux que rien : les marchés sont extrêmement stables, et
      // une lecture ratée ne doit pas priver de bon quelqu'un qui vient de s'inscrire.
      if (stored) {
        Logger.warn(
          'newsletter marchés: lecture impossible — on garde la table connue (%s)',
          (error as any)?.message ?? error
        )
        NewsletterMarkets.memo = { at: nowTs, map: stored }
        return stored
      }
      throw error
    }
  }

  /** Rafraîchissement volontaire, appelé par l'entretien quotidien. */
  public async refresh(): Promise<MarketsByCurrency | null> {
    try {
      const map = await this.fetchFromShopify()
      await NewsletterState.write(STATE_MARKETS, JSON.stringify(map))
      await NewsletterState.write(STATE_MARKETS_TS, Math.floor(DateTime.now().toSeconds()))
      NewsletterMarkets.memo = { at: Math.floor(DateTime.now().toSeconds()), map }

      const summary = Object.entries(map)
        .map(([currency, ids]) => `${currency}:${ids.length}`)
        .join(' ')
      Logger.info('newsletter marchés: table rafraîchie (%s)', summary)
      return map
    } catch (error) {
      Logger.warn(
        'newsletter marchés: rafraîchissement en échec — %s',
        (error as any)?.message ?? error
      )
      return null
    }
  }

  // --- interne ---------------------------------------------------------------------

  private async read(): Promise<MarketsByCurrency | null> {
    try {
      const row = await NewsletterState.findBy('key', STATE_MARKETS)
      if (!row?.value) return null
      const parsed = JSON.parse(row.value)
      if (!parsed || typeof parsed !== 'object') return null
      // Une table vide n'est pas une table : la traiter comme absente force une relecture
      // plutôt que de faire échouer toutes les émissions jusqu'au prochain cron.
      return Object.keys(parsed).length ? (parsed as MarketsByCurrency) : null
    } catch {
      return null
    }
  }

  private async fetchFromShopify(): Promise<MarketsByCurrency> {
    const markets = await this.shopify.discount.getActiveMarkets()

    const map: MarketsByCurrency = {}
    for (const market of markets) {
      // Seuls les marchés ACTIFS : cibler un marché désactivé rendrait le code inutilisable
      // partout, ce qui ne se voit qu'au paiement.
      if (market.status !== 'ACTIVE') continue
      if (!market.currencyCode || !market.id) continue
      ;(map[market.currencyCode] ??= []).push(market.id)
    }

    if (!Object.keys(map).length) {
      throw new Error('aucun marché actif renvoyé par Shopify')
    }
    return map
  }
}
