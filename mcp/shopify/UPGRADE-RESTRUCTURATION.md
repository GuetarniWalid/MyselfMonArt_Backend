# Upgrade — restructuration des variantes / options produit

Mise à niveau du proxy MCP Shopify (`mcp/shopify`) : le serveur sait désormais non
seulement **créer** des options/variantes, mais aussi les **restructurer** — supprimer
des variantes, supprimer/renommer des valeurs d'option, redéfinir l'état cible complet
d'un produit — directement via le MCP, sans script back-end dédié.

Objectif métier : migrer un poster « couleur de cadre = variante »
(`Cadres = {Sans cadre, blanc, noir, chêne, noyer}`, ~19 variantes) vers
`Cadres = {Sans cadre, Avec cadre}` (7 variantes) en **un seul appel**.

API Admin GraphQL : version **October25 (2025-10)** (déjà en place, cf.
`shopify-client.js` → `apiVersion: ApiVersion.October25`). Aucune nouvelle variable
d'environnement, aucun nouveau scope (`write_products` suffit).

## Résumé des ajouts

### Nouveaux tools (4)

| Tool | Mutation Admin GraphQL | Usage |
|------|------------------------|-------|
| `setProduct` | `productSet` | **DESTRUCTIF.** Définit l'état cible déclaratif (`productOptions` + `variants`). Shopify réconcilie : crée/màj le listé, **supprime toute variante non listée** et toute valeur d'option plus référencée. Un seul appel fait toute la migration. `synchronous` défaut `true`. |
| `deleteProductVariants` | `productVariantsBulkDelete` | **DESTRUCTIF.** Supprime 1 à 100 variantes ciblées par GID (chirurgical). |
| `updateProductOption` | `productOptionUpdate` | Renomme/ajoute/**supprime** des valeurs d'une option existante. Avec `variantStrategy: MANAGE` (défaut), supprimer une valeur **supprime les variantes associées**. |
| `deleteProductOptions` | `productOptionsDelete` | **DESTRUCTIF.** Supprime une ou plusieurs options entières (`strategy` `DEFAULT`/`POSITION`). Cas limite / nettoyage. |

### Tool étendu (1)

- `getProduct` expose maintenant les **IDs d'options et de valeurs d'option** (requis
  pour cibler `productOptionUpdate` / `setProduct`) :
  - ajout du bloc `options { id name position optionValues { id name } }` ;
  - ajout, sur chaque variante, de `selectedOptions { name value optionValue { id } }`.

### Fichiers modifiés

- `mcp/shopify/shopify-client.js` — méthodes `setProduct`, `deleteProductVariants`,
  `updateProductOption`, `deleteProductOptions`, helper `getProductVariantsCount`
  (résumé avant/après de `setProduct`) ; sélection de `getProduct` enrichie
  (`options`, `selectedOptions.optionValue.id`).
- `mcp/shopify/index.js` — enregistrement des 4 nouveaux tools.

Aucun tool existant n'est modifié dans son contrat : total **75 tools** (71 + 4).

## Contrats des tools

### `setProduct` (le plus puissant)
```
productId   (requis)  gid://shopify/Product/...
productOptions?       [{ name, position?, values: [string] }]   // liste COMPLÈTE, 1..3 options
variants?             [{ price, compareAtPrice?,
                         optionValues: [{ optionName, name }],   // 1 entrée / option
                         inventoryPolicy? }]                     // 1..100, POD par défaut
synchronous?          bool (défaut true)
```
- **Toute variante non listée dans `variants` est SUPPRIMÉE** (GID perdu). Pour garder
  une variante, la lister (mêmes `optionValues`).
- Défauts impression à la demande : `inventoryItem.tracked = false`,
  `inventoryPolicy = CONTINUE`.
- Idempotent : re-jouer la même cible = no-op.
- Réponse : `{ summary: { variantsBefore, variantsAfter, optionsCount },
  productSetOperation, product }` — `product.options[].id` et `optionValues[].id`
  directement réutilisables.

### `deleteProductVariants`
```
productId  (requis)
variantIds (requis)   [gid://shopify/ProductVariant/...]   // 1..100, mappé sur variantsIds
```

### `updateProductOption`
```
productId              (requis)
optionId               (requis)   gid://shopify/ProductOption/...  (getProduct → options[].id)
name?                              renomme l'option
optionValuesToAdd?                 [{ name }]
optionValuesToUpdate?              [{ id, name }]
optionValuesToDelete?              [id]      // MANAGE → supprime aussi les variantes liées
variantStrategy?                   'MANAGE' (défaut) | 'LEAVE_AS_IS'
```

### `deleteProductOptions`
```
productId  (requis)
optionIds  (requis)   [gid://shopify/ProductOption/...]
strategy?             'DEFAULT' (défaut) | 'POSITION'
```

## Pièges connus

- **Destructif = irréversible** : `setProduct`, `deleteProductVariants`,
  `deleteProductOptions` et `updateProductOption` (valeur supprimée en `MANAGE`)
  suppriment définitivement des variantes ; leurs `variantId` sont perdus. Toujours
  faire un `getProduct` de contrôle avant/après.
- **Casse exacte** : options et valeurs matchées au caractère près par le picker du
  thème — recopier les libellés du catalogue (métaobjets `border.name`), jamais de
  mémoire (cf. `UPGRADE-VARIANTES.md`).
- **`setProduct` = état COMPLET** : `productOptions` et `variants` sont la liste
  cible entière, pas un delta. Omettre `variants` laisse les variantes intactes ;
  passer une liste partielle supprime le reste.
- **`userErrors`** : chaque tool échoue proprement (`isError: true`) si
  `userErrors.length > 0` — ne jamais interpréter un `userErrors` non vide comme un
  succès.
- **Plafond variantes boutique** : au-delà de 50 000 variantes, la création est
  plafonnée à 1 000/jour ; un `setProduct` qui *crée* beaucoup de variantes peut être
  throttlé (voir `UPGRADE-VARIANTES.md`).

## Test d'acceptation (migration poster horoscope)

Sur un poster encore en ancien modèle (ex. Scorpion `gid://shopify/Product/9257365963099`,
~19 variantes `Tailles × {Sans cadre + couleurs}`), un **seul** `setProduct` produit
l'état cible :

- `productOptions` : `Tailles = [30x40 cm, 60x80 cm, 75x100 cm, 90x120 cm]`,
  `Cadres = [Sans cadre, Avec cadre]` ;
- `variants` = **7** exactement : 30×40 {39,90 / 62,90}, 60×80 {54,90 / 104,90},
  75×100 {64,90 / 134,90}, 90×120 {Sans cadre 79,90} ;
- toutes les variantes « Cadre <couleur> » supprimées ;
- `getProduct` renvoie ensuite `options[].id` et `optionValues[].id`.

En chirurgical : `deleteProductVariants` supprime une liste de GID ;
`updateProductOption` renomme/supprime des valeurs de l'option `Cadres` en
`variantStrategy: MANAGE`.

> ⚠️ Ne jamais exécuter ces mutations de test sur un produit **actif** sans GO explicite
> du propriétaire. Vérifier d'abord sur un produit DRAFT désigné.

## Vérification sans toucher à la boutique

```bash
cd mcp/shopify
node --check index.js && node --check shopify-client.js

SHOPIFY_STORE_DOMAIN=dummy.myshopify.com SHOPIFY_ACCESS_TOKEN=dummy \
  TRANSPORT_MODE=sse PORT=3999 node index.js
# Autre terminal : initialize + tools/list (JSON-RPC) sur http://127.0.0.1:3999/mcp
# → setProduct, deleteProductVariants, updateProductOption, deleteProductOptions
#   doivent apparaître (75 tools au total). tools/list n'appelle jamais l'API Shopify.
```

## Redéploiement du conteneur mcp-shopify

Identique à `UPGRADE-VARIANTES.md` : un push sur `main` déclenche
`.github/workflows/deploy.yml` (build image `mcp/shopify/Dockerfile` → Docker Hub →
`docker compose pull && up -d` sur la droplet, nginx `https://backend.myselfmonart.com/mcp/shopify/`).
Vérif : `curl -s https://backend.myselfmonart.com/mcp/shopify/health` → `{"status":"ok",...}`.
