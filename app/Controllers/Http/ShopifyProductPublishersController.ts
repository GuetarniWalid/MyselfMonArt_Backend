import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import ExtensionShopifyProductPublisherRequestValidator from 'App/Validators/ExtensionShopifyProductPublisherRequestValidator'
import ReplaceProductImagesValidator from 'App/Validators/ReplaceProductImagesValidator'
import ShopifyProductPublisher from 'App/Services/ShopifyProductPublisher'
import ProductPublisher from 'App/Services/Claude/ProductPublisher'
import ProductReimage from 'App/Services/Shopify/ProductReimage'
import PublishAlertMailer from 'App/Services/PublishAlertMailer'
import IdempotencyStore from 'App/Services/IdempotencyStore'
import { CreateProduct } from 'Types/Product'
import Shopify from 'App/Services/Shopify'

export default class ShopifyProductPublishersController {
  // Idempotence PARTAGÉE entre workers (cluster PM2) via une table MySQL — cf. IdempotencyStore.
  // Une publication est lente (IA + Shopify) et peut dépasser le délai du proxy/CDN (~100s → 524) :
  // le navigateur voit un échec alors que le produit est déjà créé côté serveur, l'utilisateur
  // re-clique → doublon. Avant, des Map statiques EN MÉMOIRE dédupliquaient — mais en mode cluster
  // (`instances:'max'`) chaque worker a les siennes : un re-clic load-balancé vers un autre worker
  // ne voyait pas la clé et republiait. Le store en base rend la réservation atomique entre TOUS
  // les workers (clé en cours → « pending » ; clé terminée → renvoie le produit déjà créé).
  private idem = new IdempotencyStore()

  public async publishOnShopify({ request, response }: HttpContextContract) {
    const idempotencyKey: string | undefined = request.input('idempotencyKey')
    const idemKey = idempotencyKey ? `publish:${idempotencyKey}` : null

    // Mode brouillon (batch « posters en masse ») : crée le produit en DRAFT (invisible) et NE
    // publie PAS ici. Le finalize du batch basculera ACTIVE + publiera SEULEMENT quand le produit
    // sera 100 % complet (7 variantes + médias). Garantit qu'aucun semi-produit n'apparaît en ligne.
    // Le studio (draft absent/false) garde exactement son comportement.
    const draft = request.input('draft') === true
    // Batch posters : id de la toile source. En mode brouillon, on marque la toile
    // « link.poster_draft = ce brouillon » pour qu'une reprise (après cap) FINALISE ce brouillon
    // au lieu d'en recréer un (anti-doublon). link.poster (= terminé) n'est posé qu'au finalize.
    const linkedPaintingId: string | undefined = request.input('linkedPaintingId')

    // Garde d'idempotence PARTAGÉE entre workers : réservation atomique via la table MySQL
    // (la contrainte UNIQUE arbitre les requêtes concurrentes, quel que soit le worker touché).
    if (idemKey) {
      const begun = await this.idem.begin(idemKey)
      if (begun.state === 'done') {
        return { ...begun.result, deduped: true }
      }
      if (begun.state === 'pending') {
        return {
          success: true,
          pending: true,
          message: 'Publication déjà en cours, patiente un instant puis vérifie ta boutique.',
        }
      }
      // 'acquired' : c'est à CE worker de faire la publication.
    }

    let productPublisher: ShopifyProductPublisher | null = null
    let backgrounded = false

    try {
      const checkedRequest = await request.validate(
        ExtensionShopifyProductPublisherRequestValidator
      )
      const product = {} as CreateProduct
      productPublisher = new ShopifyProductPublisher(checkedRequest)
      const aiService = new ProductPublisher()
      const shopify = new Shopify()

      // Pas de poster carré : on n'en propose pas. Sortie AVANT toute génération IA et
      // toute création produit (aucun modèle « square model » + artwork.type=poster
      // n'existe — le copieur lèverait plus loin). On libère l'idempotence pour ne pas
      // bloquer un éventuel renvoi corrigé.
      if (
        productPublisher.getProductType() === 'poster' &&
        productPublisher.getRatio() === 'square'
      ) {
        if (idemKey) await this.idem.release(idemKey)
        return response.status(422).json({
          success: false,
          skipped: true,
          message: 'Format carré non proposé en poster — aucun produit créé.',
        })
      }

      // Save all images as originals (for Shopify publication)
      const originalImageUrls = await productPublisher.processAllImages()

      // Get compressed main artwork as base64 data URI for AI calls (saves API token costs)
      const compressedMainArtworkDataUri = await productPublisher.getCompressedMainArtworkDataUri()

      // Get original image index
      const originalImageIndex = productPublisher.getOriginalImageIndex()

      // Get collection context and product type for AI
      const collectionTitle = productPublisher.getCollectionTitle()
      const productType = productPublisher.getProductType()

      // Process AI operations on main artwork concurrently (using compressed data URI to save API costs)
      const [descriptionHtml, likesCount] = await Promise.all([
        aiService.generateHtmlDescription(
          compressedMainArtworkDataUri,
          collectionTitle,
          productType
        ),
        productPublisher.getLikesCount(),
      ])

      // Fetch tags in a single optimized call
      const { tags } = await shopify.product.getTagsAndProductTypes()

      // Process AI operations concurrently (using compressed data URI to save API costs)
      const [
        suggestedTags,
        { alt: mainArtworkAlt, filename: mainArtworkFilename },
        { shortTitle, title, metaTitle, metaDescription },
      ] = await Promise.all([
        aiService.suggestTags(tags, compressedMainArtworkDataUri, collectionTitle, productType),
        aiService.generateAlt(compressedMainArtworkDataUri, collectionTitle, productType),
        aiService.generateTitleAndSeo(descriptionHtml, collectionTitle, productType),
      ])

      // Build mockup metadata
      const mockupMetadata = {
        mainAlt: mainArtworkAlt,
        description: descriptionHtml,
        title: title,
        tags: suggestedTags,
        collectionTitle: collectionTitle,
        productType: productType,
      }

      // Build media array with AI-powered alt text generation
      // Use original high-quality images for Shopify (not compressed)
      // All images are sent to Shopify in the same order as received from extension
      //
      // Passe-partout (poster) : les jumeaux matés (passePartout=true) sont ajoutés EN FIN de
      // tableau et RÉUTILISENT l'alt/le filename de leur mockup source (suffixe « passe-partout »,
      // zéro appel IA). On procède en 2 passes : (1) les mockups normaux (alt IA, indexés par
      // clientId), (2) les jumeaux (lookup du clientId source). L'ordre final reste celui du payload.
      const imageMetas = checkedRequest.images
      const PP_ALT_SUFFIX = ' — passe-partout blanc'
      const PP_FILENAME_SUFFIX = '-passe-partout'
      const mediaByIndex: Array<{ src: string; alt: string } | null> = new Array(
        originalImageUrls.length
      ).fill(null)
      const altByClientId = new Map<string, { alt: string; filename: string }>()

      // Passe 1 : tout SAUF les jumeaux passe-partout
      await Promise.all(
        originalImageUrls.map(async (url, index) => {
          const meta = imageMetas[index]
          if (meta?.passePartout) return // -> passe 2

          let alt: string
          let filename: string
          if (index === originalImageIndex) {
            // Original artwork: Uses its generated alt and filename
            alt = mainArtworkAlt
            filename = mainArtworkFilename
          } else if (index === 0) {
            // First mockup (index 0): White background mockup - uses original artwork's alt.
            // Generate filename slug from alt text (not using mainArtworkFilename to avoid duplicates)
            alt = mainArtworkAlt
            filename = mainArtworkAlt
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
              .substring(0, 80)
          } else {
            // Other mockups: AI-powered contextual generation
            const mockupContext = productPublisher!.getMockupContext(index)
            ;({ alt, filename } = await aiService.generateMockupAlt(mockupContext, mockupMetadata))
          }

          mediaByIndex[index] = {
            src: await productPublisher!.replaceSrcName(url, filename),
            alt,
          }
          if (meta?.clientId) altByClientId.set(meta.clientId, { alt, filename })
        })
      )

      // Passe 2 : jumeaux passe-partout (réutilisent l'alt/filename du mockup source, pas d'IA)
      await Promise.all(
        originalImageUrls.map(async (url, index) => {
          const meta = imageMetas[index]
          if (!meta?.passePartout) return
          const base = (meta.passePartoutOf && altByClientId.get(meta.passePartoutOf)) || {
            alt: mainArtworkAlt,
            filename: mainArtworkFilename,
          }
          mediaByIndex[index] = {
            src: await productPublisher!.replaceSrcName(url, base.filename + PP_FILENAME_SUFFIX),
            alt: base.alt + PP_ALT_SUFFIX,
          }
        })
      )

      product.media = mediaByIndex.filter((m): m is { src: string; alt: string } => m !== null)

      product.title = title
      product.descriptionHtml = descriptionHtml
      product.seo = {
        title: metaTitle,
        description: metaDescription,
      }
      product.tags = suggestedTags
      product.productType = productType
      product.templateSuffix = productType

      // Step 1: Create product WITHOUT category-dependent metafields
      product.metafields = [
        {
          namespace: 'link',
          key: 'mother_collection',
          value: productPublisher.getParentCollectionID(),
          type: 'collection_reference',
        },
        {
          namespace: 'likes',
          key: 'number',
          value: likesCount.toString(),
          type: 'number_integer',
        },
        {
          namespace: 'title',
          key: 'short',
          value: shortTitle,
          type: 'single_line_text_field',
        },
      ]

      // Brouillon (batch) vs ACTIVE (studio) — cf. `draft` plus haut.
      product.status = draft ? 'DRAFT' : 'ACTIVE'
      const productCreated = await shopify.product.create(product)

      // Step 2: Get model product to copy category from
      const ratio = productPublisher.getRatio()
      // Convert ratio string to model tag
      const modelTag =
        ratio === 'landscape'
          ? 'paysage model'
          : ratio === 'portrait'
            ? 'portrait model'
            : 'square model'
      const modelProduct = await shopify.product.getProductByTag(modelTag, productType)

      // Step 3: Set category BEFORE setting artwork.type metafield
      // IMPORTANT: Category must be set first because artwork.type metafield
      // has constraints based on product category
      if (modelProduct.category?.id) {
        console.log(`🏷️  Setting category from model: ${modelProduct.category.id}`)
        await shopify.category.setProductCategory(productCreated.id, modelProduct.category.id)
      }

      // Step 4: Now set artwork.type metafield (requires category to be set first)
      await shopify.metafield.update(productCreated.id, 'artwork', 'type', productType)
      // En mode brouillon, on NE publie pas ici : le finalize du batch publiera après
      // vérification des 7 variantes — jamais de produit incomplet exposé.
      if (!draft) await shopify.publications.publishProductOnAll(productCreated.id)

      // Marqueur « brouillon en cours » sur la toile (best-effort : ne bloque pas la création).
      if (draft && linkedPaintingId) {
        try {
          await shopify.metafield.update(
            linkedPaintingId,
            'link',
            'poster_draft',
            productCreated.id,
            'product_reference'
          )
        } catch (markErr: any) {
          console.warn('[bulk-posters] poster_draft marker failed:', markErr?.message)
        }
      }

      // The product is created and published — respond NOW. Previously we polled
      // Shopify media processing here (up to ~60s), which kept the request open long
      // enough to hit the proxy/CDN timeout (524). The browser then retried and
      // created duplicates. The poll is best-effort status only, so move it off the
      // request path.
      const result = {
        success: true,
        // productId : exploité par le batch posters (status/finalize/liens). En mode brouillon,
        // onlineStoreUrl est null (produit pas encore publié) — attendu.
        productId: productCreated.id,
        data: { link: productCreated.onlineStoreUrl },
      }
      if (idemKey) {
        await this.idem.complete(idemKey, result)
      }

      // Finish in the background: wait for Shopify to fetch + process the media, THEN
      // clean up the locally-saved source images. Cleaning up earlier would delete the
      // images while Shopify is still fetching them. The response is already sent.
      backgrounded = true
      const publisherRef = productPublisher
      const createdProductId = productCreated.id
      ;(async () => {
        try {
          const { allReady, failedMedia } = await shopify.product.waitForMediaProcessing(
            createdProductId,
            30,
            2000
          )
          if (!allReady) {
            console.warn('[Product Publisher] Some media may still be processing after timeout')
          }
          if (failedMedia.length > 0) {
            console.error(`[Product Publisher] ${failedMedia.length} media failed to process`)
          }
        } catch (bgError: any) {
          console.error('[Product Publisher] background media poll error:', bgError?.message)
        } finally {
          try {
            await publisherRef?.cleanupSavedImages()
          } catch (cleanupError: any) {
            console.error('[Product Publisher] background cleanup error:', cleanupError?.message)
          }
        }
      })()

      return result
    } catch (error) {
      // Échec avant la fin : on libère la réservation pour qu'un nouvel essai puisse repartir.
      if (idemKey) await this.idem.release(idemKey)
      console.error('Product publisher error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        name: error.name,
      })

      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      console.error('Product publisher error:', error)
      return response.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message || 'An unexpected error occurred',
      })
    } finally {
      // La réservation n'est PAS supprimée ici : complete() (succès) la passe en « done » pour
      // dédupliquer les re-clics ; release() (échec, dans le catch) l'a déjà supprimée.
      // On success, cleanup is deferred to the background task (it must run after
      // Shopify has fetched the media). Only clean up here when we did NOT background,
      // i.e. an error happened before the product was published.
      if (!backgrounded && productPublisher) {
        await productPublisher.cleanupSavedImages()
      }
    }
  }

  /**
   * GET /api/products/search — combo produit du mode « reimage ».
   * q vide => les 20 produits les plus récemment modifiés.
   */
  public async searchProducts({ request, response }: HttpContextContract) {
    try {
      const q = String(request.input('q') || '')
      const products = await new ProductReimage().searchProducts(q)
      return { success: true, data: { products } }
    } catch (error) {
      console.error('[Reimage] product search error:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message || 'An unexpected error occurred',
      })
    }
  }

  /**
   * GET /api/products/reimage-context — contexte du produit à refaire :
   * orientation verrouillée, type, collection, images actuelles, présence vidéo.
   */
  public async reimageContext({ request, response }: HttpContextContract) {
    try {
      const id = String(request.input('id') || '')
      if (!id) {
        return response.status(400).json({ success: false, message: 'Paramètre id requis' })
      }
      const context = await new ProductReimage().getReimageContext(id)
      if (!context) {
        return response.status(404).json({ success: false, message: 'Produit introuvable' })
      }
      return { success: true, data: context }
    } catch (error) {
      console.error('[Reimage] context error:', error.message)
      return response.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message || 'An unexpected error occurred',
      })
    }
  }

  /**
   * POST /api/shopify-product-publisher/replace-images — remplace TOUTES les images
   * d'un produit existant (mode « reimage »). Seules les images changent : titre,
   * description, SEO, tags, metafields, variantes, prix et statut restent INTACTS ;
   * les vidéos ne sont jamais touchées.
   * Même patron anti-524 que publishOnShopify : réponse anticipée dès les nouveaux
   * médias attachés, puis poll -> suppression des anciens -> reorder en arrière-plan.
   */
  public async replaceImages({ request, response }: HttpContextContract) {
    const idempotencyKey: string | undefined = request.input('idempotencyKey')
    const requestProductId: string | undefined = request.input('productId')
    // Réservations PARTAGÉES entre workers (cluster). Deux clés distinctes :
    //  - scopedKey   : dédup des re-clics (renvoie le résultat déjà produit) ;
    //  - productKey  : verrou par produit — empêche DEUX remplacements simultanés du même produit
    //    (sinon chacun snapshote puis supprime les médias de l'autre = corruption). Per-worker en
    //    mémoire avant, donc inopérant en cluster ; désormais arbitré par MySQL pour TOUS les workers.
    const scopedKey =
      idempotencyKey && requestProductId ? `reimage:${requestProductId}:${idempotencyKey}` : null
    const productKey = requestProductId ? `reimage_product:${requestProductId}` : null

    // Garde de dédup (re-clic avec la même clé)
    if (scopedKey) {
      const begun = await this.idem.begin(scopedKey)
      if (begun.state === 'done') {
        return { ...begun.result, deduped: true }
      }
      if (begun.state === 'pending') {
        return {
          success: true,
          pending: true,
          message: 'Remplacement déjà en cours, patiente un instant puis vérifie ta boutique.',
        }
      }
    }

    // Verrou par produit : un seul remplacement à la fois par produit.
    if (productKey) {
      const lock = await this.idem.begin(productKey)
      if (lock.state !== 'acquired') {
        // Un autre remplacement travaille déjà sur ce produit : on libère la clé scopée qu'on
        // vient de réserver (elle ne démarrera jamais) et on répond « déjà en cours ».
        if (scopedKey) await this.idem.release(scopedKey)
        return {
          success: true,
          pending: true,
          message: 'Un remplacement est déjà en cours sur ce produit, patiente un instant.',
        }
      }
    }

    let productPublisher: ShopifyProductPublisher | null = null
    let backgrounded = false

    try {
      const checkedRequest = await request.validate(ReplaceProductImagesValidator)

      // Contrôles métier post-schema, AVANT tout appel IA payant (l'« afterValidation »
      // du validator publish n'est pas un hook Adonis 5 et ne s'exécutait jamais).
      // Payload MIXTE : chaque entrée porte SOIT base64Image (nouvelle image) SOIT
      // mediaId (média existant conservé) ; exactement une « original » ; un contexte
      // pour chaque NOUVEAU mockup (les conservés gardent leur alt, pas d'IA).
      const entries = checkedRequest.images
      const malformed = entries.findIndex((i) => !i.base64Image === !i.mediaId)
      const originalCount = entries.filter((i) => i.type === 'original').length
      const mockupSansContexte = entries.findIndex(
        (i) => i.type === 'mockup' && i.base64Image && !i.mockupContext
      )
      if (malformed !== -1 || originalCount !== 1 || mockupSansContexte !== -1) {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: {
            images: [
              malformed !== -1
                ? `Image at index ${malformed} must have exactly one of base64Image or mediaId`
                : originalCount !== 1
                  ? 'Exactly one image must have type "original"'
                  : `Image at index ${mockupSansContexte} with type "mockup" must have a mockupContext`,
            ],
          },
        })
      }
      // Découpage conservées / nouvelles. L'ordre du tableau `entries` est l'ordre
      // final voulu sur la fiche produit (le reorder d'arrière-plan l'applique).
      const keptIds = entries.filter((i) => i.mediaId).map((i) => i.mediaId!)
      const newEntries = entries
        .filter((i) => i.base64Image)
        .map((i) => ({
          base64Image: i.base64Image!,
          mockupContext: i.mockupContext,
          type: i.type,
          clientId: i.clientId,
          passePartout: i.passePartout,
          passePartoutOf: i.passePartoutOf,
        }))
      const originalEntry = entries.find((i) => i.type === 'original')!
      const originalIsKept = Boolean(originalEntry.mediaId)
      const shopify = new Shopify()
      const reimage = new ProductReimage()
      const aiService = new ProductPublisher()

      // Re-fetch du produit FRAIS : données existantes (réutilisées pour les alts IA)
      // + liste des médias IMAGE actuels (à supprimer après bascule) + onlineStoreUrl.
      const productContext = await reimage.getReplaceContext(checkedRequest.productId)
      if (!productContext) {
        return response.status(404).json({ success: false, message: 'Produit introuvable' })
      }
      // Type : metafield du produit, sinon choix manuel envoyé par le front (vieux
      // produits sans artwork.type), sinon « painting » par défaut.
      const productType = productContext.productType || checkedRequest.productType || 'painting'
      const collectionTitle = productContext.collectionTitle
      const oldImageMediaIds = productContext.imageMediaIds

      // Les médias conservés doivent appartenir au produit (ids relus à l'instant),
      // sans doublon — sinon le payload est périmé (produit modifié entre-temps) ou erroné.
      const oldIdSet = new Set(oldImageMediaIds)
      const unknownKept = keptIds.find((id) => !oldIdSet.has(id))
      if (unknownKept || new Set(keptIds).size !== keptIds.length) {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: {
            images: [
              unknownKept
                ? `Kept media ${unknownKept} does not belong to this product (refresh and retry)`
                : 'Duplicate kept mediaId in payload',
            ],
          },
        })
      }

      // Sauvegarde locale des NOUVELLES images uniquement (Shopify les fetchera par URL),
      // en réutilisant le composeur du publish. Aucune nouvelle image (pure curation :
      // suppression/réordonnancement) => pas de composeur du tout.
      if (newEntries.length) {
        productPublisher = new ShopifyProductPublisher({
          images: newEntries,
          ratio: checkedRequest.ratio,
          productType,
          // Pas de collection fournie par le client en mode reimage : seul le titre
          // (relu du produit) sert de contexte IA, l'id n'est jamais réécrit.
          parentCollection: { id: '', title: collectionTitle },
        })
      }
      const originalImageUrls = productPublisher ? await productPublisher.processAllImages() : []

      // Alt de l'oeuvre principale : régénéré seulement si l'œuvre est NOUVELLE (base64,
      // ancien front plein-remplacement). Œuvre CONSERVÉE (front v2) : alt existant relu
      // du média — zéro appel IA, l'image ne bouge pas sur Shopify.
      let mainArtworkAlt: string
      let mainArtworkFilename: string | null = null
      if (originalIsKept) {
        mainArtworkAlt =
          productContext.imageMedia.find((m) => m.id === originalEntry.mediaId)?.alt ||
          productContext.title
      } else {
        const compressedMainArtworkDataUri =
          await productPublisher!.getCompressedMainArtworkDataUri()
        ;({ alt: mainArtworkAlt, filename: mainArtworkFilename } = await aiService.generateAlt(
          compressedMainArtworkDataUri,
          collectionTitle,
          productType,
          { title: productContext.title, description: productContext.descriptionText }
        ))
      }

      // Métadonnées mockups : données EXISTANTES du produit + alt de l'œuvre
      const mockupMetadata = {
        mainAlt: mainArtworkAlt,
        description: productContext.descriptionText,
        title: productContext.title,
        tags: productContext.tags,
        collectionTitle,
        productType,
      }

      // Médias à ATTACHER = les nouvelles images seulement, mêmes conventions que le
      // publish : l'originale (si nouvelle) garde son alt/filename générés ; en plein-
      // remplacement legacy le 1er mockup (fond blanc) réutilise l'alt de l'oeuvre ;
      // les autres mockups passent par l'IA contextuelle. Noms de fichiers régénérés.
      // 2 passes comme le publish : (1) mockups normaux (alt IA, indexés par clientId),
      // (2) jumeaux passe-partout qui réutilisent l'alt/le filename de leur mockup source
      // (suffixe « passe-partout », zéro IA). En reimage, un jumeau ne référence QUE des
      // mockups (re)générés cette session — donc des entrées NOUVELLES (base64) portant un clientId.
      const PP_ALT_SUFFIX = ' — passe-partout blanc'
      const PP_FILENAME_SUFFIX = '-passe-partout'
      const slugFromAlt = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 80)
      const newOriginalIndex = newEntries.findIndex((i) => i.type === 'original')
      const attachByIndex: Array<{ src: string; alt: string } | null> = new Array(
        originalImageUrls.length
      ).fill(null)
      const reimageAltByClientId = new Map<string, { alt: string; filename: string }>()

      // Passe 1 : tout SAUF les jumeaux passe-partout
      await Promise.all(
        originalImageUrls.map(async (url, index) => {
          const entry = newEntries[index]
          if (entry.passePartout) return // -> passe 2

          let alt: string
          let filename: string
          if (index === newOriginalIndex) {
            alt = mainArtworkAlt
            filename = mainArtworkFilename!
          } else if (keptIds.length === 0 && index === 0) {
            alt = mainArtworkAlt
            filename = slugFromAlt(mainArtworkAlt)
          } else {
            const mockupContext = entry.mockupContext!
            ;({ alt, filename } = await aiService.generateMockupAlt(mockupContext, mockupMetadata))
          }

          attachByIndex[index] = {
            src: await productPublisher!.replaceSrcName(url, filename),
            alt,
          }
          if (entry.clientId) reimageAltByClientId.set(entry.clientId, { alt, filename })
        })
      )

      // Passe 2 : jumeaux passe-partout
      await Promise.all(
        originalImageUrls.map(async (url, index) => {
          const entry = newEntries[index]
          if (!entry.passePartout) return
          const base = (entry.passePartoutOf && reimageAltByClientId.get(entry.passePartoutOf)) || {
            alt: mainArtworkAlt,
            filename: mainArtworkFilename || slugFromAlt(mainArtworkAlt),
          }
          attachByIndex[index] = {
            src: await productPublisher!.replaceSrcName(url, base.filename + PP_FILENAME_SUFFIX),
            alt: base.alt + PP_ALT_SUFFIX,
          }
        })
      )

      const mediaToAttach = attachByIndex.filter(
        (m): m is { src: string; alt: string } => m !== null
      )

      // Attache des nouveaux médias dans l'ordre du payload. En cas d'échec en cours
      // de route : ROLLBACK (suppression des nouveaux déjà attachés) — les anciennes
      // images restent, le produit n'est jamais laissé sans visuels.
      const newMediaIds: string[] = []
      try {
        for (const media of mediaToAttach) {
          const mediaNodes = await shopify.product.createMedia(
            productContext.id,
            media.src,
            media.alt
          )
          const createdNode = mediaNodes?.[mediaNodes.length - 1]
          if (!mediaNodes?.length || !createdNode?.id) {
            // Id introuvable => média non suivi (ni poll, ni rollback, ni reorder) :
            // on avorte, le catch ci-dessous nettoie les médias déjà attachés.
            throw new Error(
              'Nouveau média attaché mais id introuvable dans la réponse productUpdate'
            )
          }
          newMediaIds.push(createdNode.id)
        }
      } catch (attachError: any) {
        if (newMediaIds.length) {
          try {
            await shopify.product.deleteMedia(productContext.id, newMediaIds)
          } catch (rollbackError: any) {
            console.error('[Reimage] rollback failed:', rollbackError?.message)
            try {
              await new PublishAlertMailer().sendReimageIssue({
                productId: productContext.id,
                title: productContext.title,
                issue: `Échec d'attache des nouveaux médias ET du rollback — nouveaux médias possiblement encore attachés (${attachError?.message})`,
                mediaIds: newMediaIds,
              })
            } catch (mailError: any) {
              console.error('[Reimage] alert mail failed:', mailError?.message)
            }
          }
        }
        throw attachError
      }

      // Réponse anticipée (anti-524) : les nouveaux médias sont attachés, le reste
      // (poll statut, suppression des anciens, reorder, cleanup) part en arrière-plan.
      const result = {
        success: true,
        data: { link: productContext.onlineStoreUrl || null },
      }

      backgrounded = true
      const publisherRef = productPublisher
      ;(async () => {
        const mailer = new PublishAlertMailer()
        try {
          // Poll scopé sur les NOUVEAUX médias uniquement (le produit porte encore
          // les anciens à ce stade, le helper générique pourrait les confondre).
          // Pure curation (suppression/réordonnancement sans nouvelle image) : rien à poller.
          let allReady = true
          let failedNewMedia: string[] = []
          if (newMediaIds.length) {
            ;({ allReady, failedMedia: failedNewMedia } = await reimage.waitForNewMediaProcessing(
              productContext.id,
              newMediaIds,
              30,
              2000
            ))
          }

          if (failedNewMedia.length > 0) {
            // Un nouveau média a échoué : rollback complet, le produit reste intact.
            console.error(`[Reimage] ${failedNewMedia.length} new media FAILED — rolling back`)
            let rolledBack = true
            try {
              await shopify.product.deleteMedia(productContext.id, newMediaIds)
            } catch (rollbackError: any) {
              rolledBack = false
              console.error('[Reimage] background rollback failed:', rollbackError?.message)
            }
            try {
              await mailer.sendReimageIssue({
                productId: productContext.id,
                title: productContext.title,
                issue: rolledBack
                  ? 'Remplacement échoué : un ou plusieurs nouveaux médias sont en statut FAILED. Rollback effectué, le produit garde ses anciennes images.'
                  : 'Remplacement échoué (médias FAILED) ET rollback impossible : les nouveaux médias sont possiblement encore attachés à côté des anciens — vérifier le produit.',
                mediaIds: rolledBack ? failedNewMedia : newMediaIds,
              })
            } catch (mailError: any) {
              console.error('[Reimage] alert mail failed:', mailError?.message)
            }
            return // pas de rememberCompleted : un nouvel essai doit pouvoir repartir
          }

          if (!allReady && failedNewMedia.length === 0) {
            // Timeout du poll : statut indéterminé. On ne supprime PAS les anciennes
            // images (risque de produit sans visuels) — alerte pour vérif humaine.
            console.warn('[Reimage] media still processing after timeout — old media kept')
            try {
              await mailer.sendReimageIssue({
                productId: productContext.id,
                title: productContext.title,
                issue:
                  "Statut des nouveaux médias indéterminé après ~60s de poll : anciennes images conservées (le produit a temporairement les deux jeux d'images).",
                mediaIds: newMediaIds,
              })
            } catch (mailError: any) {
              console.error('[Reimage] alert mail failed:', mailError?.message)
            }
            if (scopedKey) {
              await this.idem.complete(scopedKey, result)
            }
            return
          }

          // Nouveaux médias READY : suppression définitive des anciens médias IMAGE
          // NON CONSERVÉS (jamais les vidéos, jamais les médias gardés par le payload
          // mixte). deleteMedia média par média ; en cas d'échec (ex. fichier rattaché
          // ailleurs), tentative de detach, sinon alerte e-mail.
          const keptIdSet = new Set(keptIds)
          const toDelete = oldImageMediaIds.filter((id) => !keptIdSet.has(id))
          const remainingOldIds: string[] = []
          for (const mediaId of toDelete) {
            try {
              await shopify.product.deleteMedia(productContext.id, [mediaId])
            } catch (deleteError: any) {
              console.warn(
                `[Reimage] delete failed for ${mediaId}, trying detach:`,
                deleteError?.message
              )
              try {
                await shopify.product.detachMediaFromProduct(productContext.id, [mediaId])
              } catch (detachError: any) {
                console.error(`[Reimage] detach also failed for ${mediaId}:`, detachError?.message)
                remainingOldIds.push(mediaId)
              }
            }
          }
          if (remainingOldIds.length > 0) {
            try {
              await mailer.sendReimageIssue({
                productId: productContext.id,
                title: productContext.title,
                issue: `Nettoyage incomplet : ${remainingOldIds.length} ancien(s) média(s) n'ont pu être ni supprimés ni détachés.`,
                mediaIds: remainingOldIds,
              })
            } catch (mailError: any) {
              console.error('[Reimage] alert mail failed:', mailError?.message)
            }
          }

          // Ordre final attendu = l'ordre du payload ([mockup1, originale, mockup2…]),
          // conservées et nouvelles intercalées, la vidéo éventuelle après. Les entrées
          // mediaId mappent sur elles-mêmes, les base64 sur les médias fraîchement
          // attachés (newMediaIds suit l'ordre d'attache = l'ordre payload).
          try {
            const finalOrderIds: string[] = []
            let newCursor = 0
            for (const entry of entries) {
              finalOrderIds.push(entry.mediaId || newMediaIds[newCursor++])
            }
            const mediaNow = await reimage.listMedia(productContext.id)
            const currentIds = mediaNow.map((m) => m.id)
            const needsReorder = finalOrderIds.some((id, index) => currentIds[index] !== id)
            if (needsReorder) {
              await shopify.product.reorderMedia(
                productContext.id,
                finalOrderIds.map((id, index) => ({ id, newPosition: String(index) }))
              )
            }
          } catch (reorderError: any) {
            console.error('[Reimage] reorder failed:', reorderError?.message)
          }

          if (scopedKey) {
            await this.idem.complete(scopedKey, result)
          }
        } catch (bgError: any) {
          console.error('[Reimage] background error:', bgError?.message)
          try {
            await mailer.sendReimageIssue({
              productId: productContext.id,
              title: productContext.title,
              issue: `Erreur en arrière-plan pendant le remplacement : ${bgError?.message}`,
            })
          } catch (mailError: any) {
            console.error('[Reimage] alert mail failed:', mailError?.message)
          }
        } finally {
          try {
            await publisherRef?.cleanupSavedImages()
          } catch (cleanupError: any) {
            console.error('[Reimage] background cleanup error:', cleanupError?.message)
          }
          // Fin de l'arrière-plan : on libère le verrou produit. La clé scopée n'est libérée que
          // si elle est restée « pending » (chemin d'échec) ; sur les chemins de succès complete()
          // l'a passée en « done » -> release() est un no-op et la dédup des re-clics persiste.
          if (scopedKey) await this.idem.release(scopedKey)
          if (productKey) await this.idem.release(productKey)
        }
      })()

      return result
    } catch (error) {
      console.error('Replace images error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        name: error.name,
      })

      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      return response.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message || 'An unexpected error occurred',
      })
    } finally {
      // Quand le traitement part en arrière-plan, c'est LUI qui libère les réservations et nettoie
      // les fichiers locaux. Sinon (échec ou retour anticipé synchrone), on libère ici pour qu'un
      // nouvel essai puisse repartir.
      if (!backgrounded) {
        if (scopedKey) await this.idem.release(scopedKey)
        if (productKey) await this.idem.release(productKey)
        if (productPublisher) {
          await productPublisher.cleanupSavedImages()
        }
      }
    }
  }
}
