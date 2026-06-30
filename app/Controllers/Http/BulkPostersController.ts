import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Shopify from 'App/Services/Shopify'
import { posterCollectionFor } from 'App/Services/BulkPosters/collectionMap'

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

// Cache process-wide du nombre de variantes attendu par ratio (lu sur le produit-modèle poster).
const expectedVariantsCache = new Map<string, number>()

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
    const expected = await this.expectedVariantCount(shopify, ratio)
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
   */
  public async finalize({ request, response }: HttpContextContract) {
    const toileId = request.input('toileId')
    const productId = request.input('productId')
    const ratio = request.input('ratio')
    if (!toileId || !productId) {
      return response.status(422).json({ success: false, message: 'toileId + productId requis' })
    }

    const shopify = new Shopify()
    const product = (await shopify.product.getProductById(productId)) as any

    // Brouillon disparu (supprimé à la main) : on nettoie le marqueur pour que la toile
    // redevienne une candidate normale, et on signale au front de la retirer du pending.
    if (!product) {
      await shopify.metafield.delete(toileId, 'link', 'poster_draft')
      return { success: true, missing: true }
    }

    const variantsCount = product?.variants?.nodes?.length ?? 0
    const expected = await this.expectedVariantCount(shopify, ratio)
    if (!expected || variantsCount < expected) {
      // Incomplet (souvent : cap quotidien). On NE publie pas, on NE pose pas link.poster :
      // le brouillon reste caché (marqueur conservé) et sera repris au prochain lancement.
      return { success: true, pending: true, variantsCount, expected }
    }

    // Complet → publier puis lier. link.poster en dernier = signal « terminé ».
    await shopify.product.update(productId, { status: 'ACTIVE' })
    await shopify.publications.publishProductOnAll(productId)
    await shopify.metafield.update(productId, 'link', 'painting', toileId, 'product_reference')
    await shopify.metafield.update(toileId, 'link', 'poster', productId, 'product_reference')
    // Nettoyage du marqueur « brouillon en cours » (best-effort).
    await shopify.metafield.delete(toileId, 'link', 'poster_draft')

    return { success: true, published: true, variantsCount, expected }
  }

  /**
   * POST /api/bulk-posters/delete-draft { productId, toileId? }
   * Suppression d'un brouillon raté + de son marqueur (rollback « tout ou rien »).
   */
  public async deleteDraft({ request, response }: HttpContextContract) {
    const productId = request.input('productId')
    const toileId = request.input('toileId')
    if (!productId) {
      return response.status(422).json({ success: false, message: 'productId requis' })
    }
    const shopify = new Shopify()
    const deletedProductId = await shopify.product.delete(productId)
    if (toileId) await shopify.metafield.delete(toileId, 'link', 'poster_draft')
    return { success: true, deletedProductId }
  }

  /** Nombre de variantes attendu = celui du produit-modèle poster pour ce ratio (mis en cache). */
  private async expectedVariantCount(shopify: Shopify, ratio: string): Promise<number> {
    const tag = ratio === 'landscape' ? 'paysage model' : 'portrait model'
    const cached = expectedVariantsCache.get(tag)
    if (cached !== undefined) return cached
    try {
      const model = (await shopify.product.getProductByTag(tag, 'poster')) as any
      const count = model?.variants?.nodes?.length ?? 0
      if (count > 0) expectedVariantsCache.set(tag, count)
      return count
    } catch {
      return 0
    }
  }
}
