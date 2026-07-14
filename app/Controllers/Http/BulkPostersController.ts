import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Shopify from 'App/Services/Shopify'
import ShopifyProductPublisher from 'App/Services/ShopifyProductPublisher'
import ClaudePublisher from 'App/Services/Claude/ProductPublisher'
import {
  composePosterMedia,
  slugFromAlt,
} from 'App/Services/ShopifyProductPublisher/composePosterMedia'
import {
  posterCollectionFor,
  expectedPosterTitleFromToile,
  normalizeCollectionTitle,
} from 'App/Services/BulkPosters/collectionMap'
import { expectedVariantCount, finalizePosterDraft } from 'App/Services/BulkPosters/finalizePoster'
import { CreateProduct } from 'Types/Product'

/**
 * Batch « posters en masse depuis les toiles ».
 *
 * L'orchestration vit dans le navigateur (page /bulk-posters, sur le PC) : il rend les mockups
 * favoris ★ + jumeaux passe-partout, appelle /api/shopify-product-publisher/publish en mode
 * `draft:true` (+ linkedPaintingId) pour créer un BROUILLON invisible, puis ce contrôleur :
 *   - candidates : pour un ratio, la liste des toiles à CRÉER + la liste des brouillons à FINALISER
 *                  (pending : créés mais variantes pas encore complètes, ex. cap atteint la veille) ;
 *   - status     : le brouillon a-t-il ses N variantes (ajoutées en asynchrone par le webhook) ;
 *   - finalize   : si complet → publie + pose les 2 liens (toile↔poster) + nettoie le marqueur ;
 *   - deleteDraft: supprime un brouillon raté + son marqueur (« tout ou rien »).
 *
 * Métafields de pilotage (namespace `link`, type product_reference) :
 *   - poster_draft (sur la TOILE) : un brouillon existe, en attente de finalize → anti-doublon à la reprise.
 *   - poster       (sur la TOILE) : TERMINÉ (poster publié). Posé UNIQUEMENT au finalize.
 *   - painting     (sur le POSTER): retour poster→toile.
 */

const MODEL_TAGS = ['portrait model', 'paysage model', 'square model']

export default class BulkPostersController {
  /**
   * GET /api/bulk-posters/candidates?ratio=portrait|landscape&limit=N
   * Retourne { pending, candidates, total } :
   *   - pending    : toiles avec un brouillon non finalisé (link.poster_draft, sans link.poster) ;
   *   - candidates : toiles à créer (ni poster, ni brouillon), du ratio, hors carré/modèles, plafonné à N ;
   *   - total      : nombre total de candidates éligibles (avant plafonnage).
   */
  public async candidates({ request, response }: HttpContextContract) {
    const ratio = request.input('ratio')
    const limit = Number(request.input('limit')) || 0 // 0 = toutes
    if (ratio !== 'portrait' && ratio !== 'landscape') {
      return response
        .status(422)
        .json({ success: false, message: 'ratio invalide (portrait|landscape)' })
    }

    const shopify = new Shopify()
    const all = (await shopify.product.getAll(false)) as any[]
    const pending: Array<{ toileId: string; posterId: string; title: string }> = []
    const eligible: Array<{
      toileId: string
      title: string
      artworkUrl: string
      collectionId: string | null
      collectionTitle: string
    }> = []
    const skipped: Array<{ toileId: string; title: string; collection: string }> = []

    for (const p of all) {
      if (p.artworkTypeMetafield?.value !== 'painting') continue
      if ((p.tags || []).some((t: string) => MODEL_TAGS.includes(t))) continue

      // Œuvre = media[1] (media[0] = fond blanc). Dimensions requises pour l'orientation.
      const art = p.media?.nodes?.[1]?.image
      if (!art?.url || !art.width || !art.height) continue
      const r = art.width / art.height
      if (Math.abs(r - 1) < 0.01) continue // carré : pas de modèle poster carré
      const ori = r > 1 ? 'landscape' : 'portrait'
      if (ori !== ratio) continue

      const edges = p.metafields?.edges || []
      const find = (key: string) =>
        edges.find((e: any) => e.node.namespace === 'link' && e.node.key === key)

      // Déjà terminé ?
      if (find('poster')?.node?.value) continue

      // Brouillon en cours (à finaliser, sans re-rendu) ?
      const draftEdge = find('poster_draft')
      if (draftEdge?.node?.value) {
        pending.push({ toileId: p.id, posterId: draftEdge.node.value, title: p.title })
        continue
      }

      // À créer — uniquement si la collection mère a un équivalent poster mappé (strict :
      // jamais de poster rangé dans une collection de toiles ; sinon on saute et on rapporte).
      const motherEdge = find('mother_collection')
      const toileCollectionId: string | null = motherEdge?.node?.value || null
      const toileCollectionTitle: string =
        motherEdge?.node?.reference?.title || p.collections?.nodes?.[0]?.title || ''
      const target = posterCollectionFor(toileCollectionId)
      if (!target) {
        skipped.push({ toileId: p.id, title: p.title, collection: toileCollectionTitle })
        continue
      }

      eligible.push({
        toileId: p.id,
        title: p.title,
        artworkUrl: art.url,
        collectionId: target.id,
        collectionTitle: target.title,
      })
    }

    const candidates = limit > 0 ? eligible.slice(0, limit) : eligible
    return { success: true, data: { ratio, total: eligible.length, pending, candidates, skipped } }
  }

  /**
   * POST /api/bulk-posters/create-one
   *   { toileId, ratio, collectionId, collectionTitle, title, descriptionHtml, seoTitle,
   *     seoDescription, images: [{ base64Image, type, mockupContext?, clientId?, passePartout?, passePartoutOf? }] }
   *
   * Mode COPIE (pivot 30/06) : crée le BROUILLON poster SANS AUCUN appel IA. Le texte (title H1,
   * descriptionHtml, SEO) est fourni par l'agent ; tout le reste est COPIÉ de la toile ou FORCÉ.
   * EXCEPTION — `transpose: true` (pipeline « toile → poster jumeau » du studio, 07/07) : le texte
   * n'est pas fourni, il est RÉÉCRIT ici depuis celui de la toile (1 appel Claude, PosterTransposer,
   * règles runbook §5 anti-cannibalisation). Le reste du comportement est strictement identique.
   *   - COPIÉ de la toile : title.short, painting.color, shopify.color-pattern, shopify.theme,
   *     painting.layout, mm-google-shopping/mc-facebook.google_product_category, tags.
   *   - FORCÉ : artwork.type=poster, templateSuffix=poster, link.mother_collection=collection POSTER
   *     (mapping, PAS celle de la toile), likes.number=0.
   *   - DU MODÈLE (webhook products/create, inchangé) : 7 variantes + frames_poster/sizes/fixations.
   *
   * Ordre clé « zéro IA payante » : on pose shopify.color-pattern / shopify.theme AVANT artwork.type.
   * Le webhook ne traite le poster (copie modèle + détection couleurs/thèmes OpenAI) QUE si
   * artwork.type=poster ; quand il lit ces metafields, color-pattern/theme sont déjà présents →
   * detectAndSetColors / detectAndSetThemes SAUTENT (hasExistingColors/hasExistingThemes). Aucun
   * appel OpenAI. (Le webhook attend en plus le chargement des médias, ce qui laisse une marge
   * confortable après cette requête.)
   *
   * Le brouillon reste invisible (status DRAFT) ; le batch le FINALISE (publish + liens) via
   * /finalize quand ses variantes sont complètes — réutilise status/finalize/delete-draft existants.
   */
  public async createOne({ request, response }: HttpContextContract) {
    const toileId: string = request.input('toileId')
    const ratio: string = request.input('ratio')
    const collectionId: string = request.input('collectionId')
    const collectionTitle: string = request.input('collectionTitle') || ''
    // Mode TRANSPOSE (pipeline « toile → poster jumeau » du studio) : le texte n'est PAS fourni —
    // il est RÉÉCRIT ici depuis celui de la toile (1 appel Claude, règles runbook §5). Sans ce
    // flag, comportement historique inchangé : les 4 champs texte sont exigés (agent bulk).
    const transpose: boolean = request.input('transpose') === true
    let title: string = request.input('title')
    let descriptionHtml: string = request.input('descriptionHtml')
    let seoTitle: string = request.input('seoTitle')
    let seoDescription: string = request.input('seoDescription')
    const images = request.input('images')

    // Validation déterministe (le contrôleur n'utilise pas le validator studio).
    if (!toileId || !/^gid:\/\/shopify\/Product\/\d+$/.test(toileId)) {
      return response.status(422).json({ success: false, message: 'toileId (GID produit) requis' })
    }
    if (ratio !== 'portrait' && ratio !== 'landscape') {
      return response
        .status(422)
        .json({ success: false, message: 'ratio invalide (portrait|landscape)' })
    }
    if (!collectionId || !/^gid:\/\/shopify\/Collection\/\d+$/.test(collectionId)) {
      return response
        .status(422)
        .json({ success: false, message: 'collectionId (GID collection) requis' })
    }
    if (!transpose && (!title || !descriptionHtml || !seoTitle || !seoDescription)) {
      return response.status(422).json({
        success: false,
        message: 'title, descriptionHtml, seoTitle, seoDescription requis',
      })
    }
    if (!Array.isArray(images) || images.length < 2) {
      return response
        .status(422)
        .json({ success: false, message: 'images: au moins 2 (mockup + œuvre)' })
    }
    const originalImageIndex = images.findIndex((i: any) => i?.type === 'original')
    if (originalImageIndex === -1) {
      return response
        .status(422)
        .json({ success: false, message: 'une image doit avoir type:"original"' })
    }

    const shopify = new Shopify()

    // Garde-fou anti-doublon : un poster terminé existe déjà pour cette toile ?
    const toile = (await shopify.product.getProductById(toileId)) as any
    if (!toile) {
      return response.status(404).json({ success: false, message: 'toile introuvable' })
    }
    const toileEdges = toile.metafields?.edges || []
    const findMf = (ns: string, key: string) =>
      toileEdges.find((e: any) => e.node?.namespace === ns && e.node?.key === key)?.node
    if (findMf('link', 'poster')?.value) {
      return response
        .status(409)
        .json({ success: false, message: 'cette toile a déjà un poster lié' })
    }
    // Anti-doublon AU NIVEAU BROUILLON : un brouillon est déjà en cours pour cette toile (reprise via
    // /finalize, pas une 2e création). Rend create-one idempotent face à un double déclenchement.
    // On renvoie le productId du brouillon (draftProductId) pour que le studio REPRENNE (poll +
    // finalize) au lieu de recréer — cas re-clic après un 524 où la 1re réponse s'est perdue.
    const existingDraft = findMf('link', 'poster_draft')?.value
    if (existingDraft) {
      return response.status(409).json({
        success: false,
        message: 'un brouillon poster est déjà en cours pour cette toile',
        draftProductId: existingDraft,
      })
    }

    // Mode TRANSPOSE : réécriture du texte de la toile en texte poster (anti-cannibalisation),
    // AVANT toute création — un échec IA ici ne laisse rien à annuler côté Shopify. Borné à 45 s
    // (Promise.race) pour que create-one reste SOUS la coupure proxy ~100 s : sinon un Claude lent
    // (429/backoff) allongerait la fenêtre où un re-clic crée un 2e brouillon orphelin (le marqueur
    // link.poster_draft n'est posé qu'en fin de requête). Sur timeout, l'owner re-clique (rien créé).
    if (transpose) {
      try {
        const transposed: any = await Promise.race([
          new ClaudePublisher().transposePosterText(
            {
              title: toile.title || '',
              descriptionHtml: toile.descriptionHtml || toile.description || '',
              seoTitle: toile.seo?.title || '',
              seoDescription: toile.seo?.description || '',
            },
            collectionTitle
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Délai de réécriture dépassé')), 45000)
          ),
        ])
        title = transposed.title
        descriptionHtml = transposed.descriptionHtml
        seoTitle = transposed.seoTitle
        seoDescription = transposed.seoDescription
      } catch (aiErr: any) {
        console.error('[bulk-posters] transpose error:', aiErr?.message, aiErr?.name)
        // ZodError = pavé JSON illisible dans l'overlay studio -> message court et actionnable.
        const friendly =
          aiErr?.name === 'ZodError'
            ? 'Le texte du poster n’a pas pu être réécrit correctement. Réessaie.'
            : 'Réécriture du texte impossible : ' + (aiErr?.message || 'erreur IA')
        return response.status(500).json({ success: false, message: friendly })
      }
    }

    // Le service ShopifyProductPublisher gère le stockage local des images (Shopify les fetche par URL)
    // + le renommage SEO. Aucun appel IA (pas de compression/data-uri ici).
    const productPublisher = new ShopifyProductPublisher({
      images,
      ratio: ratio as any,
      productType: 'poster',
      parentCollection: { id: collectionId, title: collectionTitle },
    })

    let backgrounded = false
    // Atomicité « tout-ou-rien » : si une étape ÉCHOUE APRÈS la création du brouillon (catégorie,
    // metafields, artwork.type…), on supprime ce brouillon — pas d'orphelin invisible non suivi.
    let createdId: string | null = null
    try {
      const originalImageUrls = await productPublisher.processAllImages()

      // Alts DÉTERMINISTES (zéro IA) : l'œuvre/1er mockup réutilisent le titre H1 ; les autres
      // mockups = titre + contexte du mockup. Filenames slugifiés ; l'unicité (suffixe d'index en
      // brouillon) + les jumeaux passe-partout sont gérés par composePosterMedia (PARTAGÉ studio).
      const mainArtworkAlt = title
      const mainArtworkFilename = slugFromAlt(title)
      const media = await composePosterMedia({
        originalImageUrls,
        imageMetas: images,
        originalImageIndex,
        draft: true,
        mainArtworkAlt,
        mainArtworkFilename,
        resolveMockupAlt: async (_index, mockupContext) => {
          const ctx = mockupContext || 'Mockup'
          return { alt: `${title} — ${ctx}`, filename: slugFromAlt(`${title}-${ctx}`) }
        },
        replaceSrcName: (url, filename) => productPublisher.replaceSrcName(url, filename),
      })

      // Métafields COPIÉS de la toile, posables AU MOMENT de la création (indépendants de la catégorie).
      const copyAtCreate: Array<{ namespace: string; key: string; value: string; type: string }> =
        []
      const pushCopy = (ns: string, key: string) => {
        const n = findMf(ns, key)
        if (n?.value) copyAtCreate.push({ namespace: ns, key, value: n.value, type: n.type })
      }
      pushCopy('title', 'short')
      pushCopy('mm-google-shopping', 'google_product_category')
      pushCopy('mc-facebook', 'google_product_category')

      const product = {} as CreateProduct
      product.title = title
      product.descriptionHtml = descriptionHtml
      product.seo = { title: seoTitle, description: seoDescription }
      product.tags = Array.isArray(toile.tags) ? toile.tags : [] // tags COPIÉS de la toile
      product.productType = 'poster'
      product.templateSuffix = 'poster' // FORCÉ : modèle de thème DÉDIÉ poster (décision owner 02/07)
      product.media = media
      product.status = 'DRAFT' // brouillon invisible (tout-ou-rien)
      product.metafields = [
        // FORCÉ : collection mère = la collection POSTER (mapping), JAMAIS celle de la toile.
        {
          namespace: 'link',
          key: 'mother_collection',
          value: collectionId,
          type: 'collection_reference',
        },
        { namespace: 'likes', key: 'number', value: '0', type: 'number_integer' },
        ...copyAtCreate,
      ]

      const created = await shopify.product.create(product)
      createdId = created.id

      // Catégorie depuis le modèle poster (requise AVANT les metafields taxonomie + artwork.type).
      const modelTag = ratio === 'landscape' ? 'paysage model' : 'portrait model'
      const model = (await shopify.product.getProductByTag(modelTag, 'poster')) as any
      if (model?.category?.id) {
        await shopify.category.setProductCategory(created.id, model.category.id)
      }

      // GUARDS « ZÉRO IA » (shopify.color-pattern + shopify.theme) : posés AVANT artwork.type pour que
      // le webhook saute la détection OpenAI (hasExistingColors/hasExistingThemes). Leur écriture est
      // BLOQUANTE : un échec remonte au catch → rollback du brouillon (repris au prochain run) plutôt
      // que de laisser le webhook lancer un appel IA payant qui écraserait en plus les valeurs copiées.
      let colorThemeFromAI = false
      for (const [ns, key] of [
        ['shopify', 'color-pattern'],
        ['shopify', 'theme'],
      ] as const) {
        const n = findMf(ns, key)
        if (n?.value) {
          await shopify.metafield.update(created.id, ns, key, n.value, n.type)
        } else {
          // La toile n'a pas ce metafield (détection jamais aboutie, import…) : le webhook fera UNE
          // détection IA. Rare ; le poster reste correct (couleurs/thèmes détectés), mais ce n'est pas
          // « zéro IA » → on le signale (log + drapeau renvoyé à l'agent pour son rapport).
          colorThemeFromAI = true
          console.warn(
            `[bulk-posters] toile ${toileId} sans ${ns}.${key} → le webhook fera une détection IA`
          )
        }
      }
      // painting.color (filtre couleur du storefront) + painting.layout (format) : best-effort, sans
      // incidence sur la détection IA — un échec ne justifie pas de tout annuler.
      for (const [ns, key] of [
        ['painting', 'color'],
        ['painting', 'layout'],
      ] as const) {
        const n = findMf(ns, key)
        if (n?.value) {
          try {
            await shopify.metafield.update(created.id, ns, key, n.value, n.type)
          } catch (e: any) {
            console.warn(`[bulk-posters] copie metafield ${ns}.${key} échouée:`, e?.message)
          }
        }
      }

      // FORCÉ : artwork.type=poster (déclenche la copie du modèle poster par le webhook). EN DERNIER.
      await shopify.metafield.update(created.id, 'artwork', 'type', 'poster')

      // Marqueur « brouillon en cours » sur la toile (anti-doublon/reprise) — BLOQUANT : sans lui, la
      // toile serait re-listée comme candidate neuve au prochain run → DOUBLON + orphelin invisible.
      // Un échec remonte donc au catch (rollback). link.poster/link.painting sont posés au finalize.
      await shopify.metafield.update(
        toileId,
        'link',
        'poster_draft',
        created.id,
        'product_reference'
      )

      // Réponse anticipée (anti-524). Le poll des médias + le nettoyage des fichiers locaux partent
      // en arrière-plan (supprimer trop tôt effacerait les images pendant que Shopify les fetche).
      backgrounded = true
      ;(async () => {
        try {
          await shopify.product.waitForMediaProcessing(created.id, 30, 2000)
        } catch (bgErr: any) {
          console.error('[bulk-posters] background media poll error:', bgErr?.message)
        } finally {
          try {
            await productPublisher.cleanupSavedImages()
          } catch (cleanupErr: any) {
            console.error('[bulk-posters] background cleanup error:', cleanupErr?.message)
          }
        }
      })()

      return { success: true, productId: created.id, colorThemeFromAI }
    } catch (error: any) {
      console.error('[bulk-posters] create-one error:', error?.message)
      // Rollback : pas de brouillon orphelin si l'échec survient après la création.
      if (createdId) {
        await shopify.product
          .delete(createdId)
          .catch((delErr: any) =>
            console.error('[bulk-posters] rollback delete failed:', delErr?.message)
          )
        await shopify.metafield.delete(toileId, 'link', 'poster_draft').catch(() => {})
      }
      return response
        .status(500)
        .json({ success: false, message: error?.message || 'Erreur création brouillon poster' })
    } finally {
      if (!backgrounded) {
        await productPublisher.cleanupSavedImages().catch(() => {})
      }
    }
  }

  /**
   * GET /api/bulk-posters/status?productId=...&ratio=...
   * Le brouillon a-t-il toutes ses variantes ? (ajoutées en asynchrone par le webhook products/create.)
   */
  public async status({ request, response }: HttpContextContract) {
    const productId = request.input('productId')
    const ratio = request.input('ratio')
    if (!productId) {
      return response.status(422).json({ success: false, message: 'productId requis' })
    }
    const shopify = new Shopify()
    const product = (await shopify.product.getProductById(productId)) as any
    const variantsCount = product?.variants?.nodes?.length ?? 0
    const expected = await expectedVariantCount(shopify, ratio)
    return {
      success: true,
      data: {
        exists: !!product,
        variantsCount,
        expected,
        complete: expected > 0 && variantsCount >= expected,
      },
    }
  }

  /**
   * POST /api/bulk-posters/finalize { toileId, productId, ratio }
   * Si le brouillon est complet (N variantes) → bascule ACTIVE + publie + pose les 2 liens + nettoie
   * le marqueur. Sinon → { pending:true }. TOUT OU RIEN : link.poster (mémoire de reprise) n'est
   * écrit QU'ICI, sur succès complet.
   *
   * ⚠️ Ne RECRÉE PAS les variantes manquantes : un brouillon resté à 1 variante (webhook
   * products/create raté) ne se terminera JAMAIS par un simple finalize. C'est le cron
   * `RepairPendingPosters` qui resynchronise d'abord, puis finalise.
   */
  public async finalize({ request, response }: HttpContextContract) {
    const toileId = request.input('toileId')
    const productId = request.input('productId')
    const ratio = request.input('ratio')
    if (!toileId || !productId) {
      return response.status(422).json({ success: false, message: 'toileId + productId requis' })
    }

    const shopify = new Shopify()
    const result = await finalizePosterDraft(shopify, toileId, productId, ratio)

    if (result.outcome === 'missing') return { success: true, missing: true }
    if (result.outcome === 'pending') {
      return {
        success: true,
        pending: true,
        variantsCount: result.variantsCount,
        expected: result.expected,
      }
    }
    return {
      success: true,
      published: true,
      variantsCount: result.variantsCount,
      expected: result.expected,
      link: result.link,
    }
  }

  /**
   * POST /api/bulk-posters/delete-draft { productId, toileId }
   * Suppression d'un brouillon raté + de son marqueur (rollback « tout ou rien »).
   *
   * Endpoint NON authentifié (comme /publish) : GARDE-FOU obligatoire — on ne supprime que si la toile
   * porte bien `link.poster_draft = productId`. Donc on ne peut effacer QUE le brouillon réellement
   * enregistré pour cette toile, jamais un produit publié ni un produit arbitraire passé par un tiers.
   */
  public async deleteDraft({ request, response }: HttpContextContract) {
    const productId = request.input('productId')
    const toileId = request.input('toileId')
    if (!productId || !toileId) {
      return response.status(422).json({ success: false, message: 'productId + toileId requis' })
    }
    const shopify = new Shopify()
    const toile = (await shopify.product.getProductById(toileId)) as any
    const draftRef = (toile?.metafields?.edges || []).find(
      (e: any) => e.node?.namespace === 'link' && e.node?.key === 'poster_draft'
    )?.node?.value
    if (draftRef !== productId) {
      // Le brouillon en cours de cette toile n'est pas ce productId (ou la toile n'en a aucun) :
      // on refuse — c'est exactement la garde qui empêche toute suppression non sollicitée.
      return response.status(409).json({
        success: false,
        message: "productId n'est pas le brouillon en cours de cette toile — suppression refusée",
      })
    }
    const deletedProductId = await shopify.product.delete(productId)
    await shopify.metafield.delete(toileId, 'link', 'poster_draft')
    return { success: true, deletedProductId }
  }

  /**
   * GET /api/bulk-posters/collection-map?collectionId=<gid|id numérique>&collectionTitle=<titre>
   * Résout la collection poster jumelle d'une collection TOILE :
   *   1. table figée POSTER_COLLECTION_MAP (rapide, source de vérité du bulk) ;
   *   2. REPLI par convention de nommage « Tableau(x) X » → « Poster & Affiche X » : si une
   *      collection poster de ce titre existe en boutique, on la prend (évite d'éditer la table +
   *      redéployer à chaque nouveau thème). Match tolérant (accents/casse), résultat UNIQUE exigé.
   * Utilisé par le studio pour décider d'enchaîner (ou non) sur l'étape poster après une toile.
   */
  public async collectionMap({ request, response }: HttpContextContract) {
    const raw = request.input('collectionId')
    const collectionTitle: string = request.input('collectionTitle') || ''
    if (!raw) {
      return response.status(422).json({ success: false, message: 'collectionId requis' })
    }
    const collectionId = /^\d+$/.test(String(raw)) ? `gid://shopify/Collection/${raw}` : String(raw)

    // 1. Table figée.
    const mapped = posterCollectionFor(collectionId)
    if (mapped) {
      return { success: true, data: { posterCollection: mapped } }
    }

    // 2. Repli par nom : « Tableau X » → collection poster « Poster & Affiche X » si elle existe.
    const expected = expectedPosterTitleFromToile(collectionTitle)
    if (expected) {
      try {
        const wanted = normalizeCollectionTitle(expected)
        const shopify = new Shopify()
        const all = (await shopify.collection.getAll()) as any[]
        const matches = all.filter((c) => normalizeCollectionTitle(c.title) === wanted)
        if (matches.length === 1) {
          return {
            success: true,
            data: { posterCollection: { id: matches[0].id, title: matches[0].title } },
          }
        }
      } catch (e: any) {
        console.warn('[bulk-posters] collection-map fallback error:', e?.message)
      }
    }

    return { success: true, data: { posterCollection: null } }
  }
}
