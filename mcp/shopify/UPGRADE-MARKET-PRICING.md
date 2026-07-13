# Upgrade — pricing PAR MARCHÉ (Markets → Catalogs → Price Lists)

Mise à niveau du proxy MCP Shopify (`mcp/shopify`) : le serveur sait désormais lire et
régler le **prix par marché** via l'ajustement en pourcentage d'une **price list** de
catalogue de marché — c.-à-d. augmenter (ou baisser) le prix sur Canada/US/etc. **sans
toucher au prix de base** (France).

⚠️ Ne PAS confondre avec `updateProductVariantPrices`, qui change le prix **GLOBAL** de la
variante (toutes régions). Le prix par marché passe par une price list dont
`parent.adjustment` décale chaque prix d'un `%` relatif au prix de base.

API Admin GraphQL : version **October25 (2025-10)** (déjà en place, cf.
`shopify-client.js` → `apiVersion: ApiVersion.October25`). Aucune nouvelle variable
d'environnement. Scopes requis **déjà présents** sur le token prod (vérifié en live) :
`write_products` (pour `priceListCreate` / `priceListUpdate`) + `read_markets` (+ `read_products`).

## Résumé des ajouts

### Nouveaux tools (2)

| Tool | Opération Admin GraphQL | Usage |
|------|-------------------------|-------|
| `getMarketPricing` | `query { markets … catalogs.priceList.parent.adjustment }` | **LECTURE.** Liste chaque marché avec le 1ᵉʳ catalogue, sa price list et son ajustement `%`. Sert à voir la majoration Canada/US et à récupérer `marketId` / `priceListId`. |
| `setMarketPriceAdjustment` | `priceListUpdate` (existe) / `priceListCreate` (sinon) | **ÉCRITURE.** Applique un `percent` signé (`+18` = +18 %, `-10` = −10 %) au 1ᵉʳ catalogue du marché. Met à jour **en place** si une price list existe (idempotent, pas de doublon), sinon en crée une attachée au catalogue, libellée dans la devise de base du marché. Remonte toujours `userErrors`. |

### Sortie de `getMarketPricing` (par marché)

`{ marketId, name, handle, status, currency (base du marché), catalogId, catalogTitle,
priceListId|null, priceListCurrency, adjustment|null }`

### Entrée de `setMarketPriceAdjustment`

`{ marketId (requis, GID), percent (Float signé) }` — `percent >= 0` ⇒
`PERCENTAGE_INCREASE`, sinon `PERCENTAGE_DECREASE` ; `value = abs(percent)`.

## ⚠️ Piège confirmé en live : Canada et USA partagent UNE seule price list

Sur cette boutique, les marchés **Canada** (`Market/106045604187`, base CAD) et **USA**
(`Market/106011361627`, base USD) pointent vers le **même** `MarketCatalog/159114494299`
(intitulé « USA ») et donc la **même** `PriceList/31632589147` (devise **USD**).
Conséquence : **régler Canada règle aussi USA** (et inversement) — impossible de leur
donner deux pourcentages différents sans d'abord scinder le catalogue. C'est cohérent
avec l'objectif « augmenter Canada/US ». La devise de la price list (USD) diffère de la
devise de base de Canada (CAD) ; sur le chemin `update` la devise n'est pas modifiée.

## Fichiers modifiés

- `mcp/shopify/shopify-client.js` — méthodes `getMarketPricing`,
  `priceListUpdateAdjustment`, `priceListCreateAdjustment`.
- `mcp/shopify/index.js` — helper `shapeMarketPricing` + enregistrement des 2 tools.

## Test d'acceptation (exécuté en live le 2026-07-13)

- `getMarketPricing` → Canada + USA renvoient bien leur `priceList` (`PriceList/31632589147`).
- `setMarketPriceAdjustment({ marketId: <Canada>, percent: 18 })` → `userErrors` vide,
  contrôle : `adjustment { PERCENTAGE_INCREASE, 18 }` (état précédent : +5 %).
- Prix de base France inchangé (aucune price list sur le marché France, variantes intactes).
- USA également passé à +18 % (price list partagée).
