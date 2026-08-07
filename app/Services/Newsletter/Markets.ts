import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import Shopify from 'App/Services/Shopify'
import NewsletterState from 'App/Models/NewsletterState'
import { resolvePathPrefix } from './marketPath'
import type { MarketPathTable } from './marketPath'
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
 *
 * ⚠️ LE CAS QUI INQUIÈTE À RAISON, ET POURQUOI IL SE RÉSOUT TOUT SEUL. La boutique LIVRE dans
 * 31 pays mais n'a de marchés explicites que pour 13 : un acheteur autrichien, portugais ou
 * irlandais peut payer sans appartenir à aucune des huit régions listées. Shopify le rattache
 * alors au MARCHÉ PRIMAIRE — France, en euros (vérifié le 2026-08-06). Or le marché primaire
 * est un marché comme un autre : il figure dans cette liste et se retrouve donc groupé sous SA
 * devise. L'acheteur non listé voit les prix en euros, le thème annonce `EUR`, le bon est
 * calibré en euros et restreint aux marchés euro — dont le marché primaire. La boucle est
 * cohérente PAR CONSTRUCTION, et le resterait si le marchand changeait de marché primaire.
 */

const STATE_MARKETS = 'markets_by_currency'
const STATE_MARKETS_TS = 'markets_fetched_ts'
/**
 * Table des préfixes de vitrine, écrite par le MÊME appel que `markets_by_currency`.
 *
 * Clé SÉPARÉE et non un remplacement : au premier déploiement la ligne n'existe pas encore, et
 * une lecture qui échoue doit dégrader vers l'ancien comportement (préfixe de langue) plutôt
 * que d'empêcher l'envoi.
 */
const STATE_PRESENCES = 'market_presences'

/** Au-delà, on retente. En dessous, le cache suffit. */
const REFRESH_AFTER_HOURS = 24

/**
 * Palier entre deux tentatives de reconstruction de la table des préfixes.
 *
 * Sans lui, une boutique qui refuse la lecture ferait relire Shopify à CHAQUE envoi — inutile,
 * puisque le repli est déjà correct, et exactement le genre de boucle qui consomme un quota.
 */
const RETRY_AFTER_MINUTES = 60

export type MarketsByCurrency = Record<string, string[]>

export default class NewsletterMarkets {
  private shopify = new Shopify()

  private static memo: { at: number; map: MarketsByCurrency } | null = null
  private static memoTable: { at: number; table: MarketPathTable } | null = null
  /** Dernière tentative de reconstruction, pour ne pas relire Shopify à chaque envoi. */
  private static lastAttemptTs = 0

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

  /**
   * Le préfixe de chemin à mettre devant TOUS les liens d'un e-mail, pour ce pays et cette
   * langue. `null` = indécidable, l'appelant retombe sur le préfixe de langue.
   *
   * ⛔ NE LÈVE JAMAIS, contrairement à `idsFor`. Un bon mal ciblé est un bon inutilisable, donc
   * il vaut mieux ne pas l'émettre ; un préfixe manquant ne coûte qu'un lien vers le marché
   * primaire — exactement ce que faisait le dispositif avant. Faire échouer un envoi pour ça
   * serait un très mauvais échange.
   */
  public async pathPrefixFor(
    country: string | null | undefined,
    locale: string
  ): Promise<string | null> {
    try {
      return resolvePathPrefix(await this.table(), country, locale)
    } catch (error) {
      Logger.info(
        'newsletter marchés: préfixe non résolu pour %s/%s (repli sur la langue) — %s',
        country ?? '?',
        locale,
        (error as any)?.message ?? error
      )
      return null
    }
  }

  /** La table des vitrines, avec le même cycle de cache que la table des devises. */
  public async table(): Promise<MarketPathTable | null> {
    const nowTs = Math.floor(DateTime.now().toSeconds())

    if (
      NewsletterMarkets.memoTable &&
      nowTs - NewsletterMarkets.memoTable.at < REFRESH_AFTER_HOURS * 3600
    ) {
      return NewsletterMarkets.memoTable.table
    }

    const stored = await this.readTable()
    const fetchedTs = await NewsletterState.readNumber(STATE_MARKETS_TS)
    const fresh = fetchedTs !== null && nowTs - fetchedTs < REFRESH_AFTER_HOURS * 3600

    if (stored && fresh) {
      NewsletterMarkets.memoTable = { at: nowTs, table: stored }
      return stored
    }

    // ⛔ `refresh()` ET SURTOUT PAS `byCurrency()`. Au premier déploiement, `markets_by_currency`
    // est déjà là et frais : `byCurrency()` rendrait donc le cache SANS jamais appeler Shopify,
    // et la table des préfixes ne s'écrirait qu'au prochain entretien quotidien. Tous les envois
    // de la journée seraient retombés sur le préfixe de langue sans que rien ne le signale.
    // `refresh()` lit toujours, et ne lève jamais.
    if (nowTs - NewsletterMarkets.lastAttemptTs < RETRY_AFTER_MINUTES * 60) return stored
    NewsletterMarkets.lastAttemptTs = nowTs

    await this.refresh()

    const after = await this.readTable()
    if (after) NewsletterMarkets.memoTable = { at: nowTs, table: after }
    return after ?? stored
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

  private async readTable(): Promise<MarketPathTable | null> {
    try {
      const row = await NewsletterState.findBy('key', STATE_PRESENCES)
      if (!row?.value) return null
      const parsed = JSON.parse(row.value)
      if (!parsed || !Array.isArray(parsed.markets) || !parsed.markets.length) return null
      return parsed as MarketPathTable
    } catch {
      return null
    }
  }

  /**
   * UN SEUL APPEL, DEUX TABLES. Le ciblage par devise et les préfixes de vitrine décrivent le
   * même instantané des marchés : les lire séparément les ferait diverger le jour où le
   * marchand ouvre un marché entre les deux lectures.
   *
   * L'écriture de la table des préfixes est DÉLIBÉRÉMENT non bloquante : le ciblage du bon est
   * vital (§ `idsFor` lève), les liens ne le sont pas.
   */
  private async fetchFromShopify(): Promise<MarketsByCurrency> {
    const snapshot = await this.shopify.discount.getMarketsSnapshot()

    const map: MarketsByCurrency = {}
    for (const market of snapshot.markets) {
      // Seuls les marchés ACTIFS : cibler un marché désactivé rendrait le code inutilisable
      // partout, ce qui ne se voit qu'au paiement.
      if (market.status !== 'ACTIVE') continue
      if (!market.currencyCode || !market.id) continue
      ;(map[market.currencyCode] ??= []).push(market.id)
    }

    if (!Object.keys(map).length) {
      throw new Error('aucun marché actif renvoyé par Shopify')
    }

    try {
      const table: MarketPathTable = {
        primaryHandle: snapshot.primaryHandle,
        markets: snapshot.markets
          .filter((m) => m.status === 'ACTIVE' && m.handle)
          .map((m) => ({
            handle: m.handle,
            countries: m.countries,
            defaultLocale: m.defaultLocale,
            prefixes: m.prefixes,
          })),
      }
      await NewsletterState.write(STATE_PRESENCES, JSON.stringify(table))
      NewsletterMarkets.memoTable = { at: Math.floor(DateTime.now().toSeconds()), table }
    } catch (error) {
      Logger.warn(
        'newsletter marchés: table des préfixes non enregistrée — les liens retombent sur la langue (%s)',
        (error as any)?.message ?? error
      )
    }

    return map
  }
}
