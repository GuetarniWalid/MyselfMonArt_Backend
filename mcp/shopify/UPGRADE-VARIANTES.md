# Upgrade — accès programmatique aux variantes produit

Mise à niveau du proxy MCP Shopify (`mcp/shopify`) : le serveur sait désormais créer
des options produit, créer des variantes en masse, mettre à jour des prix de variantes,
et poser le `templateSuffix` / la catégorie taxonomique via `updateProduct`.

## Résumé des ajouts

### Nouveaux tools (3)

| Tool | Mutation Admin GraphQL | Usage |
|------|------------------------|-------|
| `createProductOptions` | `productOptionsCreate` | Crée 1 à 3 options (ex. `Tailles`, `Cadres`) avec leurs valeurs. `variantStrategy` : `LEAVE_AS_IS` (défaut, ne touche pas aux variantes) ou `CREATE` (Shopify génère toute la matrice). |
| `createProductVariantsBulk` | `productVariantsBulkCreate` | Crée 1 à 100 variantes en un appel (`price` + `optionValues` par variante, `compareAtPrice` optionnel). `strategy: REMOVE_STANDALONE_VARIANT` supprime la variante « Default Title » à la pose de la matrice. Défauts stock : non suivi, `inventoryPolicy: CONTINUE` (impression à la demande). |
| `updateProductVariantPrices` | `productVariantsBulkUpdate` | Met à jour `price` (et `compareAtPrice` optionnel) de 1 à 100 variantes existantes en un appel. Les GID de variantes s'obtiennent via `getProduct` → `variants`. |

### Tool étendu (1)

- `updateProduct` accepte deux nouveaux champs optionnels :
  - `templateSuffix` — ex. `"personalized"` rend `templates/product.personalized.json` ;
    passer `""` remet le template produit par défaut (converti en `null` côté serveur).
  - `category` — GID de la Standard Product Taxonomy
    (ex. `gid://shopify/TaxonomyCategory/ae-2-1`).
  - La réponse de la mutation renvoie maintenant aussi `templateSuffix` et
    `category { id fullName }` pour confirmation immédiate.

### Fichiers modifiés

- `mcp/shopify/shopify-client.js` — méthodes `createProductOptions`,
  `createProductVariantsBulk`, `updateProductVariantPrices` ; sélection de réponse
  d'`updateProduct` enrichie (`templateSuffix`, `category`).
- `mcp/shopify/index.js` — enregistrement des 3 nouveaux tools ; schéma zod
  d'`updateProduct` étendu (`templateSuffix`, `category`).

Aucun tool existant n'est modifié dans son contrat : total 60 tools (57 + 3).
Aucune nouvelle variable d'environnement (mêmes scopes : `write_products` suffit
pour options/variantes/template/catégorie).

## Pièges connus (vécus sur ce projet)

- **Casse exacte des options/valeurs** : le picker du thème matche les libellés
  (`border.name` des métaobjets) au caractère près — ex. `Cadre noir Mat` (M majuscule),
  `Cadre chêne clair` (accents). Toujours recopier les libellés du catalogue, jamais
  les retaper de mémoire.
- **Ordre des opérations** : options d'abord (`LEAVE_AS_IS`), puis variantes
  (`REMOVE_STANDALONE_VARIANT`). Les metafields liés à la catégorie
  (ex. `painting.layout`) sont **refusés tant que la catégorie n'est pas posée** —
  poser `category` via `updateProduct` avant `setMetafield`.
- **Limite quotidienne Shopify** : au-delà de 50 000 variantes boutique, la création
  est plafonnée à 1 000 variantes/jour — un échec `productVariantsBulkCreate` en
  rafale peut venir de là (voir le cron RepairIncompleteArtworks du backend).

## Redéploiement du conteneur mcp-shopify

Le conteneur tourne sur le serveur de prod (DigitalOcean), routé par nginx sur
`https://backend.myselfmonart.com/mcp/shopify/` (port interne 3001).

### Voie normale (CI)

Un push sur `main` déclenche `.github/workflows/deploy.yml`, qui :
1. build l'image `mcp/shopify/Dockerfile` → push Docker Hub (`<user>/mcp-shopify:latest`),
2. `docker compose pull && docker compose up -d` sur le serveur.

Rien d'autre à faire : commit + push des fichiers `mcp/shopify/*.js`.

### Voie manuelle (sans CI)

```bash
# Depuis la racine du repo backend
docker build -f mcp/shopify/Dockerfile -t <DOCKERHUB_USERNAME>/mcp-shopify:latest mcp/shopify
docker push <DOCKERHUB_USERNAME>/mcp-shopify:latest

# Sur le serveur
cd /opt/MyselfMonArt_Dashboard
docker compose pull mcp-shopify
docker compose up -d mcp-shopify
```

### Vérification post-déploiement (sans toucher à la boutique)

```bash
curl -s https://backend.myselfmonart.com/mcp/shopify/health
# -> {"status":"ok","mode":"sse"}
```

Puis dans un client MCP (Claude…), vérifier que `tools/list` expose bien
`createProductOptions`, `createProductVariantsBulk`, `updateProductVariantPrices`,
et que le schéma d'`updateProduct` contient `templateSuffix` et `category`.

### Test local (sans credentials réels)

```bash
cd mcp/shopify
SHOPIFY_STORE_DOMAIN=dummy.myshopify.com SHOPIFY_ACCESS_TOKEN=dummy \
  TRANSPORT_MODE=sse PORT=3999 node index.js
# Dans un autre terminal : initialize + tools/list sur http://127.0.0.1:3999/mcp
# (tools/list n'appelle jamais l'API Shopify)
```

## PROMPT prêt à l'emploi (agent externe — refaire/vérifier ce travail)

> Tu interviens sur le repo backend AdonisJS de MyselfMonArt
> (`MyselfMonArt_Backend`). Objectif : vérifier (ou refaire si absent) l'upgrade
> « variantes produit » du proxy MCP Shopify situé dans `mcp/shopify`
> (serveur MCP authless, SSE, déployé en conteneur `mcp-shopify` derrière nginx sur
> `https://backend.myselfmonart.com/mcp/shopify/`).
>
> Attendu dans `mcp/shopify/shopify-client.js` (classe `ShopifyClient`, méthodes
> async retournant `this.graphql(mutation, variables)`) :
> 1. `createProductOptions(productId, options, variantStrategy = 'LEAVE_AS_IS')`
>    → mutation `productOptionsCreate($productId: ID!, $options: [OptionCreateInput!]!,
>    $variantStrategy: ProductOptionCreateVariantStrategy)` ; `options` est un tableau
>    `{ name, values: string[] }` à mapper en `{ name, values: [{ name }] }` ;
>    sélectionner `product { id options { id name position optionValues { id name } } }`
>    et `userErrors { field message code }`.
> 2. `createProductVariantsBulk(productId, variants, strategy = 'DEFAULT')`
>    → mutation `productVariantsBulkCreate($productId: ID!, $variants:
>    [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy)` ;
>    chaque variante : `{ price, optionValues: [{ optionName, name }],
>    inventoryItem: { tracked: false } par défaut, inventoryPolicy: 'CONTINUE' par
>    défaut, compareAtPrice optionnel }` ; sélectionner
>    `productVariants { id title price selectedOptions { name value } }` + `userErrors`.
> 3. `updateProductVariantPrices(productId, variants)`
>    → mutation `productVariantsBulkUpdate` ; chaque variante : `{ id, price,
>    compareAtPrice optionnel }` ; sélectionner
>    `productVariants { id title price compareAtPrice }` + `userErrors`.
> 4. La sélection de la mutation `updateProduct` existante doit inclure
>    `templateSuffix` et `category { id fullName }`.
>
> Attendu dans `mcp/shopify/index.js` (fonction `registerTools`, suivre le pattern
> des tools existants : `server.tool(name, description, zodShape, handler)` ; handler
> qui try/catch, teste `result.data.<mutation>.userErrors.length > 0` et renvoie
> `{ content: [{ type: 'text', text: JSON.stringify(...) }] }` ou `isError: true`) :
> 1. Tool `createProductOptions` : `{ productId: string, options: array(1..3) de
>    { name: string, values: array(min 1) de string }, variantStrategy:
>    enum('LEAVE_AS_IS','CREATE') défaut LEAVE_AS_IS }`.
> 2. Tool `createProductVariantsBulk` : `{ productId: string, variants: array(1..100)
>    de { price: string, compareAtPrice?: string, optionValues: array(min 1) de
>    { optionName: string, name: string }, inventoryPolicy: enum('DENY','CONTINUE')
>    défaut CONTINUE }, strategy: enum('DEFAULT','REMOVE_STANDALONE_VARIANT')
>    défaut DEFAULT }`.
> 3. Tool `updateProductVariantPrices` : `{ productId: string, variants: array(1..100)
>    de { id: string, price: string, compareAtPrice?: string } }`.
> 4. Le tool `updateProduct` doit accepter en plus `templateSuffix?: string`
>    (si `""` → convertir en `null` avant l'appel : retour au template par défaut)
>    et `category?: string` (GID `gid://shopify/TaxonomyCategory/...`), passés tels
>    quels dans le `ProductInput`.
>
> Contraintes : ne casser AUCUN tool existant (57 tools avant upgrade, 60 après) ;
> ne pas ajouter de variable d'environnement ; ne jamais lire les valeurs du `.env`.
> Vérification sans toucher à la boutique : `node --check` sur les deux fichiers,
> puis lancer le serveur avec des credentials factices
> (`SHOPIFY_STORE_DOMAIN=dummy.myshopify.com SHOPIFY_ACCESS_TOKEN=dummy
> TRANSPORT_MODE=sse PORT=3999 node index.js`) et faire `initialize` +
> `tools/list` en JSON-RPC sur `http://127.0.0.1:3999/mcp` : les 3 nouveaux tools
> doivent apparaître et le schéma d'`updateProduct` doit contenir `templateSuffix`
> et `category`. `tools/list` n'appelle jamais l'API Shopify. Toute mutation réelle
> de test est interdite sauf sur un produit DRAFT explicitement désigné.
> Redéploiement : push sur `main` (workflow `.github/workflows/deploy.yml`) ou
> build/push manuel de l'image `mcp-shopify` puis `docker compose pull && up -d`
> sur le serveur.
