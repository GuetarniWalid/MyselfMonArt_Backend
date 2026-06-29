# Upgrade — cycle de vie complet des collections

Mise à niveau du proxy MCP Shopify (`mcp/shopify`) : le serveur sait désormais
**créer** une collection de A à Z (la coquille SEO complète), la **lire** (idempotence),
**l'étendre** et la **supprimer** — en NON publié par défaut pour qu'une page vide ne
soit jamais indexée.

## Résumé des ajouts

### Nouveaux tools (3)

| Tool | Mutation/Query Admin GraphQL | Usage |
|------|------------------------------|-------|
| `createCollection` | `collectionCreate` | Crée une collection en UN appel : `title` (= H1 storefront), `handle`, `descriptionHtml`, `seo {title, description}`, `image {src, altText}` (URL publique), `templateSuffix`, `metafields[]` (ex. `custom.intro` / `custom.guide` / `custom.faq`), et `ruleSet` optionnel pour une collection SMART (auto-peuplée par tag). **`published` défaut FALSE** : Shopify crée la collection non publiée ; `published:true` la publie sur l'**Online Store**. Renvoie la collection (`id`, `handle`, …) + statut de publication ; `userErrors` remontées telles quelles. |
| `getCollection` | `collection(id:)` / `collections(query:"handle:…")` | Lit une collection par `id` OU `handle` : `id`, `handle`, `title`, `descriptionHtml`, `templateSuffix`, `sortOrder`, `seo`, `image`, `ruleSet`, `publishedOnOnlineStore`, et **tous les `metafields`** (namespaces `custom` + `global` inclus, aplatis en tableau). Sert à l'idempotence (le handle existe-t-il déjà ?) et à vérifier les metafields après écriture. |
| `deleteCollection` | `collectionDelete` | Supprime une collection par `id` (irréversible) — hygiène / rollback d'une coquille créée. Renvoie `deletedCollectionId`. |

### Tool étendu (1)

- `updateCollection` accepte en plus de `id` / `title` / `description` / `handle` /
  `seoTitle` / `seoDescription` :
  - `image` (`{src, altText}`) — remplace l'image représentative ;
  - `templateSuffix` — `""` remet le template collection par défaut (converti en `null`) ;
  - `metafields[]` — pose/écrase des metafields éditoriaux ;
  - `published` (bool) — **publie (`true`) / dépublie (`false`)** la collection sur
    l'Online Store ; omettre pour ne pas toucher à l'état de publication.
  - Seuls les champs passés sont modifiés ; la sélection de réponse est enrichie
    (mêmes champs que `getCollection`, hors flag de publication).

### Fichiers modifiés

- `mcp/shopify/shopify-client.js` — constante `COLLECTION_FIELDS` (sélection partagée
  create/update/get) ; méthodes `createCollection`, `deleteCollection`,
  `getCollection`, `getOnlineStorePublicationId` (résolution + cache de la publication
  « Online Store »), `setCollectionPublished` (`publishablePublish` /
  `publishableUnpublish`) ; sélection de `updateCollection` enrichie.
- `mcp/shopify/index.js` — enregistrement des 3 nouveaux tools + extension du schéma
  zod d'`updateCollection` ; helper `shapeCollection` (aplatit la connexion
  `metafields { edges { node } }` en tableau).
- `mcp/shopify/README.md` — scopes `read_publications` / `write_publications` ajoutés.

Aucun tool existant n'est cassé dans son contrat (64 → 67 tools, +3).

## Décisions clés (vérifiées sur la doc Admin API 2025-10)

- **Non publié par défaut, sans bidouille** : la doc `collectionCreate` indique
  explicitement « *The created collection is unpublished by default. To make it
  available to customers, use the `publishablePublish` mutation after creation.* ».
  `CollectionInput` **n'a aucun champ `published`** — la publication se fait donc
  toujours après coup via `publishablePublish` / `publishableUnpublish`. `published:false`
  est donc un no-op (état natif), ce qui rend la coquille « jamais indexée » garantie.
- **Cible = Online Store uniquement** : pour une coquille SEO, le canal pertinent est
  l'Online Store (indexation/storefront). On résout son `publicationId` via
  `publications(first: 50)` (match `name === "Online Store"`, insensible à la casse en
  repli) et on agit dessus. `getCollection` renvoie `publishedOnOnlineStore`
  (= `publishedOnPublication(publicationId: <online store>)`), signal fiable pour un
  token d'app privée — contrairement à `publishedOnCurrentPublication` (déprécié et
  ambigu pour une app qui n'est pas elle-même un canal).
- **Image** : `CollectionInput.image` est un `ImageInput { src, altText }` (le `src` est
  une URL publique) ; en lecture la collection expose `image { url altText }`.
- **Dégradation gracieuse** : si le token n'a pas (encore) `read_publications`,
  `getCollection` renvoie quand même la collection, sans le flag `publishedOnOnlineStore`,
  au lieu d'échouer. Un `published:true` sans le scope `write_publications` ne perd pas la
  création : la collection est créée et l'erreur de publication est remontée dans
  `publication.error`.
- **Enums passés en string** : `ruleSet.rules[].column` / `relation` sont des enums
  GraphQL fournis en chaîne via les variables (coercition standard), comme `status` /
  `sortKey` ailleurs dans ce serveur.

## ⚠️ Scope à ajouter côté app Shopify

Le `published` (publier/dépublier) et le `publishedOnOnlineStore` exigent
`write_publications` (qui implique `read_publications`). Le token a déjà `write_products`
(création/MAJ/suppression de collections + image OK). **Ajouter `write_publications`** dans
la config de l'app Shopify (admin → app) sinon la publication renvoie une erreur d'accès
(la création de la coquille, elle, fonctionne sans).

## Test d'acceptation (via le MCP déployé, sans token côté client — authless)

```
createCollection({ title: "TEST Poster Zzz", published: false,
  seo: { title: "x", description: "y" },
  metafields: [{ namespace: "custom", key: "guide",
                 type: "multi_line_text_field", value: "<p>hello</p>" }] })
  → renvoie un id, collection NON publiée, metafield custom.guide posé.
getCollection({ handle: "test-poster-zzz" })
  → relit le metafield custom.guide + publishedOnOnlineStore=false.
deleteCollection({ id: "<gid renvoyé>" })
  → nettoyage.
```

## Vérification sans toucher à la boutique

```bash
cd mcp/shopify
node --check shopify-client.js && node --check index.js
# Lancer avec des credentials factices puis initialize + tools/list :
SHOPIFY_STORE_DOMAIN=dummy.myshopify.com SHOPIFY_ACCESS_TOKEN=dummy \
  TRANSPORT_MODE=sse PORT=3999 node index.js
# tools/list n'appelle jamais l'API Shopify : doit exposer createCollection,
# getCollection, deleteCollection et un updateCollection avec image/templateSuffix/
# metafields/published.
```

## Redéploiement du conteneur mcp-shopify

Identique aux autres upgrades : un push sur `main` déclenche
`.github/workflows/deploy.yml` qui rebuild l'image `mcp/shopify/Dockerfile` →
Docker Hub → `docker compose pull && up -d` sur le serveur. Commit + push des fichiers
`mcp/shopify/*.js` suffit.

Vérif post-déploiement :

```bash
curl -s https://backend.myselfmonart.com/mcp/shopify/health   # -> {"status":"ok","mode":"sse"}
```
