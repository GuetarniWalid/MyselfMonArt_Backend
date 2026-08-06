import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import NewsletterState from 'App/Models/NewsletterState'
import { FALLBACK_RATES, VOUCHER_CURRENCIES } from './currency'
import type { VoucherCurrency } from './currency'

/**
 * TAUX DE CHANGE — source Banque centrale européenne, gratuite et sans clé.
 *
 * ⛔ RÈGLE QUI PRIME SUR TOUTES LES AUTRES ICI : une inscription NE DOIT JAMAIS ÉCHOUER faute
 * de taux. La cascade est donc, dans l'ordre : cache du jour → dernier taux connu (quel que
 * soit son âge) → table de repli à froid. Le dernier étage n'est atteint que si le dispositif
 * n'a jamais réussi à joindre la BCE une seule fois, et il produit quand même un bon correct à
 * quelques centimes près — ce que la marge de 2 % absorbe.
 *
 * Un taux périmé de trois jours coûte, au pire, quelques centimes d'écart sur le montant posé.
 * Une inscription refusée coûte un client. L'arbitrage ne se discute pas.
 *
 * La BCE ne publie que les jours ouvrés TARGET : un appel le dimanche renvoie la cotation du
 * vendredi. `lastNObservations=1` s'en charge — on ne cherche jamais « la date du jour », on
 * prend la dernière observation publiée.
 */

/** Dernier jeu de taux connu, en JSON : `{"date":"2026-08-06","rates":{"USD":1.1542,…}}`. */
const STATE_FX_RATES = 'fx_rates'
/** Instant du dernier appel RÉUSSI à la BCE, en secondes epoch. */
export const STATE_FX_FETCHED_TS = 'fx_fetched_ts'

/** Au-delà, on retente un rafraîchissement. En dessous, le cache suffit. */
const REFRESH_AFTER_HOURS = 12

/** Une requête, tous les taux. Inutile d'en faire quatre. */
const ECB_SERIES = 'D.USD+CAD+CHF+GBP.EUR.SP00.A'
const ECB_URL = `https://data-api.ecb.europa.eu/service/data/EXR/${ECB_SERIES}?lastNObservations=1&detail=dataonly&format=csvdata`

/** La BCE est un service tiers : on ne la laisse jamais tenir une inscription en otage. */
const FETCH_TIMEOUT_MS = 5000

export interface RateSet {
  /** Date de l'observation BCE (`YYYY-MM-DD`), pas la date du rafraîchissement. */
  date: string
  rates: Record<string, number>
}

export default class NewsletterRates {
  /** Mémoire de process : évite de relire la base à chaque inscription. */
  private static memo: { at: number; set: RateSet } | null = null

  /**
   * Taux 1 EUR → `currency`. Ne lève JAMAIS.
   *
   * L'euro vaut toujours 1 et ne coûte aucun appel : c'est la devise de la boutique.
   */
  public async rateFor(currency: VoucherCurrency): Promise<number> {
    if (currency === 'EUR') return 1

    const set = await this.current()
    const rate = Number(set.rates?.[currency])
    if (Number.isFinite(rate) && rate > 0) return rate

    Logger.warn('newsletter fx: aucun taux %s dans le jeu courant — repli à froid', currency)
    return FALLBACK_RATES[currency] ?? 1
  }

  /**
   * Le jeu de taux courant, rafraîchi au plus une fois par demi-journée.
   *
   * Un échec de rafraîchissement N'EST PAS une erreur remontée : on journalise et on garde ce
   * qu'on a. C'est tout l'objet de ce service.
   */
  public async current(): Promise<RateSet> {
    const nowTs = Math.floor(DateTime.now().toSeconds())

    if (NewsletterRates.memo && nowTs - NewsletterRates.memo.at < REFRESH_AFTER_HOURS * 3600) {
      return NewsletterRates.memo.set
    }

    const stored = await this.read()
    const fetchedTs = await NewsletterState.readNumber(STATE_FX_FETCHED_TS)
    const fresh = fetchedTs !== null && nowTs - fetchedTs < REFRESH_AFTER_HOURS * 3600

    if (stored && fresh) {
      NewsletterRates.memo = { at: nowTs, set: stored }
      return stored
    }

    const fetched = await this.fetchFromEcb()
    if (fetched) {
      await NewsletterState.write(STATE_FX_RATES, JSON.stringify(fetched))
      await NewsletterState.write(STATE_FX_FETCHED_TS, nowTs)
      NewsletterRates.memo = { at: nowTs, set: fetched }
      return fetched
    }

    // ⛔ La BCE n'a pas répondu. On garde le dernier taux connu, quel que soit son âge.
    if (stored) {
      Logger.warn(
        'newsletter fx: BCE injoignable — on garde les taux du %s (aucune inscription bloquée)',
        stored.date
      )
      // Mémoïsé quand même : sinon chaque inscription retenterait un appel réseau qui échoue,
      // et la BCE en panne ajouterait 5 secondes à chaque réponse de l'encart.
      NewsletterRates.memo = { at: nowTs, set: stored }
      return stored
    }

    Logger.error(
      'newsletter fx: BCE injoignable ET aucun taux en base — repli sur la table à froid'
    )
    const cold: RateSet = { date: 'cold-start', rates: { ...FALLBACK_RATES } }
    NewsletterRates.memo = { at: nowTs, set: cold }
    return cold
  }

  /**
   * Rafraîchissement volontaire, appelé par l'entretien quotidien.
   *
   * Le but est que le cache soit TOUJOURS chaud quand une inscription arrive : le chemin
   * d'inscription ne doit jamais être le premier à découvrir que la BCE est lente.
   */
  public async refresh(): Promise<boolean> {
    const fetched = await this.fetchFromEcb()
    if (!fetched) return false
    await NewsletterState.write(STATE_FX_RATES, JSON.stringify(fetched))
    await NewsletterState.write(STATE_FX_FETCHED_TS, Math.floor(DateTime.now().toSeconds()))
    NewsletterRates.memo = { at: Math.floor(DateTime.now().toSeconds()), set: fetched }
    Logger.info('newsletter fx: taux BCE du %s rafraîchis', fetched.date)
    return true
  }

  // --- interne ---------------------------------------------------------------------

  private async read(): Promise<RateSet | null> {
    try {
      const row = await NewsletterState.findBy('key', STATE_FX_RATES)
      if (!row?.value) return null
      const parsed = JSON.parse(row.value)
      if (!parsed?.rates || typeof parsed.rates !== 'object') return null
      return { date: String(parsed.date ?? ''), rates: parsed.rates }
    } catch {
      // Valeur corrompue : on la traite comme absente. Le rafraîchissement la réécrira.
      return null
    }
  }

  /** `null` = échec, quelle qu'en soit la cause. L'appelant garde ce qu'il a. */
  private async fetchFromEcb(): Promise<RateSet | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(ECB_URL, {
        headers: { Accept: 'text/csv' },
        signal: controller.signal,
      })
      if (!response.ok) {
        Logger.warn('newsletter fx: BCE a répondu HTTP %s', response.status)
        return null
      }
      return this.parseCsv(await response.text())
    } catch (error) {
      Logger.warn('newsletter fx: appel BCE en échec — %s', (error as any)?.message ?? error)
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * CSV BCE en mode `dataonly` :
   *   KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE
   *
   * On lit les colonnes PAR LEUR NOM et jamais par leur position : la BCE ajoute et réordonne
   * des colonnes selon le paramètre `detail`, et un index figé lirait un jour une date à la
   * place d'un taux — silencieusement.
   */
  private parseCsv(csv: string): RateSet | null {
    const lines = String(csv ?? '')
      .split(/\r?\n/)
      .filter((line) => line.trim())
    if (lines.length < 2) return null

    const header = lines[0].split(',').map((h) => h.trim())
    const iCurrency = header.indexOf('CURRENCY')
    const iValue = header.indexOf('OBS_VALUE')
    const iDate = header.indexOf('TIME_PERIOD')
    if (iCurrency < 0 || iValue < 0) return null

    const rates: Record<string, number> = {}
    let date = ''

    for (const line of lines.slice(1)) {
      const cells = line.split(',')
      const currency = (cells[iCurrency] ?? '').trim().toUpperCase()
      const value = Number((cells[iValue] ?? '').trim())
      if (!(VOUCHER_CURRENCIES as readonly string[]).includes(currency)) continue
      if (!Number.isFinite(value) || value <= 0) continue
      rates[currency] = value
      if (iDate >= 0 && !date) date = (cells[iDate] ?? '').trim()
    }

    // Un jeu partiel est pire qu'inutile : il écraserait des taux valides par des trous, et
    // les devises manquantes retomberaient sur la table à froid sans que rien ne l'indique.
    const missing = VOUCHER_CURRENCIES.filter((c) => c !== 'EUR' && !rates[c])
    if (missing.length) {
      Logger.warn('newsletter fx: réponse BCE incomplète (manque %s) — ignorée', missing.join(', '))
      return null
    }

    return { date: date || DateTime.now().toFormat('yyyy-MM-dd'), rates }
  }
}
