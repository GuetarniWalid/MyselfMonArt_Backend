/**
 * PAYS + LANGUE → PRÉFIXE DE CHEMIN DE LA VITRINE. Module PUR, chargeable par les tests dorés
 * sans monter l'application ni toucher au réseau.
 *
 * ⛔ POURQUOI CE CALCUL EXISTE. Les préfixes nus `/en`, `/de`, `/es`, `/nl` n'appartiennent PAS
 * à « la version anglaise du site » : ils appartiennent au marché FRANCE, en euros. Un client
 * américain envoyé sur `/en/products/…` voit donc des prix en euros et les conditions de
 * livraison françaises, alors que l'e-mail qu'il vient de lire lui annonçait des dollars. C'est
 * exactement l'annonce trompeuse que le reste du dispositif s'interdit (cf. `Product.ts`, qui
 * refuse de convertir les prix lui-même). Son marché à lui, c'est `/en-us`.
 *
 * ⛔ LE MOTIF `/{langue}-{pays}` EST UN PIÈGE, PAS UNE RÈGLE. Il décrit bien `/en-us` et
 * `/fr-ca`, ce qui donne envie de le généraliser — mais au 2026-08-07 le marché USA n'a QUE
 * l'anglais, `europ` n'a ni allemand ni espagnol, et Allemagne n'a que l'allemand. `/de-us`,
 * `/es-eu` et `/nl-de` sont plausibles et n'existent pas. D'où une table LUE chez Shopify, et
 * une résolution qui préfère toujours un préfixe existant à un préfixe déduit.
 */

/** Un marché, réduit à ce qui permet de composer ses liens. */
export interface MarketPresence {
  handle: string
  /** Codes pays ISO explicitement rattachés à ce marché. */
  countries: string[]
  /** Langue de repli quand la langue demandée n'a pas de vitrine ici. */
  defaultLocale: string | null
  /** Langue → préfixe de chemin (`''` = racine du domaine). */
  prefixes: Record<string, string>
}

export interface MarketPathTable {
  /** Marché primaire : celui où Shopify range TOUT pays sans marché explicite. */
  primaryHandle: string | null
  markets: MarketPresence[]
}

/**
 * Le préfixe à mettre devant tous les chemins d'un e-mail. `null` = indécidable, et l'appelant
 * retombe alors sur le préfixe de LANGUE (`localePath`), c'est-à-dire le comportement d'avant.
 *
 * L'ordre des règles est le point important :
 *
 *   1. Le marché du PAYS. À égalité, le plus SPÉCIFIQUE gagne — l'Espagne figure à la fois dans
 *      le marché `espagne` (1 pays) et dans `europ` (7 pays), et sans ce départage le lien
 *      changerait au gré de l'ordre de réponse de Shopify.
 *   2. Dans ce marché, la langue demandée.
 *   3. Sinon la langue par défaut DU MÊME MARCHÉ. ⛔ C'est le marché qui l'emporte sur la
 *      langue, et c'est délibéré : les prix affichés dans l'e-mail viennent du marché. Un
 *      germanophone aux États-Unis lira `/en-us` en anglais — mais avec les montants qu'on
 *      vient de lui annoncer. L'envoyer sur `/de` lui donnerait sa langue et des euros.
 *   4. Pays inconnu ou sans marché : le marché PRIMAIRE, mêmes règles. C'est ce que Shopify
 *      fait de son côté pour les 18 pays livrés sans marché explicite — la boucle reste donc
 *      cohérente sans qu'on ait à énumérer ces pays.
 */
export function resolvePathPrefix(
  table: MarketPathTable | null | undefined,
  country: string | null | undefined,
  locale: string
): string | null {
  const markets = table?.markets
  if (!Array.isArray(markets) || !markets.length) return null

  const iso = String(country ?? '')
    .trim()
    .toUpperCase()

  const market =
    (/^[A-Z]{2}$/.test(iso) ? marketForCountry(markets, iso) : null) ??
    markets.find((m) => m.handle && m.handle === table?.primaryHandle) ??
    null

  if (!market) return null
  return prefixIn(market, locale)
}

/** Le marché qui sert ce pays. Le plus spécifique gagne ; le handle départage à égalité. */
function marketForCountry(markets: MarketPresence[], iso: string): MarketPresence | null {
  const matches = markets.filter((m) => Array.isArray(m.countries) && m.countries.includes(iso))
  if (!matches.length) return null

  // ⛔ Tri TOTAL, jamais partiel : deux marchés couvrant autant de pays l'un que l'autre
  // doivent départager sur le handle, sinon le lien dépend de l'ordre de la réponse Shopify et
  // change tout seul d'un envoi à l'autre.
  return [...matches].sort(
    (a, b) => a.countries.length - b.countries.length || a.handle.localeCompare(b.handle)
  )[0]
}

/** La langue demandée dans ce marché, sinon sa langue par défaut. */
function prefixIn(market: MarketPresence, locale: string): string | null {
  const prefixes = market.prefixes
  if (!prefixes || typeof prefixes !== 'object') return null

  // ⚠️ `typeof === 'string'`, jamais un test de vérité : le préfixe du marché primaire dans sa
  // langue source est la CHAÎNE VIDE. Un `if (prefixes[locale])` le rejetterait et renverrait
  // un client français vers la langue par défaut au lieu de la racine.
  if (typeof prefixes[locale] === 'string') return prefixes[locale]

  const fallback = market.defaultLocale ? prefixes[market.defaultLocale] : undefined
  return typeof fallback === 'string' ? fallback : null
}
