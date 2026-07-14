import Env from '@ioc:Adonis/Core/Env'
import Shopify from 'App/Services/Shopify'

/**
 * Cœur PARTAGÉ de la finalisation d'un brouillon poster.
 *
 * Deux appelants, une seule implémentation (sinon divergence garantie) :
 *   - `BulkPostersController.finalize` (HTTP, piloté par le studio / le driver bulk) ;
 *   - le cron `RepairPendingPosters` (reprise automatique).
 *
 * TOUT OU RIEN : on ne publie QUE si le brouillon a toutes ses variantes, et `link.poster`
 * (la mémoire « terminé ») n'est écrit qu'ici, sur succès complet.
 */

// Cache process-wide du nombre de variantes attendu par ratio (lu sur le produit-modèle poster).
// TTL OBLIGATOIRE : le cron vit des semaines dans son process PM2. Si le owner change la grille du
// modèle poster (déjà arrivé : 4 → 7 variantes), un cache éternel jugerait la complétude sur
// l'ancienne grille → publication de posters incomplets, ou brouillons bloqués à vie.
const EXPECTED_VARIANTS_TTL_MS = 60 * 60 * 1000
const expectedVariantsCache = new Map<string, { count: number; at: number }>()

/**
 * Nombre de variantes que le modèle poster de ce ratio impose (7 aujourd'hui).
 * Renvoie 0 si le modèle est illisible → l'appelant NE DOIT PAS publier (complétude injugeable).
 */
export async function expectedVariantCount(shopify: Shopify, ratio: string): Promise<number> {
  const tag = ratio === 'landscape' ? 'paysage model' : 'portrait model'
  const cached = expectedVariantsCache.get(tag)
  if (cached && Date.now() - cached.at < EXPECTED_VARIANTS_TTL_MS) return cached.count
  try {
    const model = (await shopify.product.getProductByTag(tag, 'poster')) as any
    const count = model?.variants?.nodes?.length ?? 0
    // On ne met en cache qu'une lecture PLAUSIBLE (0 = modèle illisible → on retentera).
    if (count > 0) expectedVariantsCache.set(tag, { count, at: Date.now() })
    return count
  } catch {
    return 0
  }
}

export type FinalizeOutcome =
  | { outcome: 'missing' }
  | { outcome: 'pending'; variantsCount: number; expected: number }
  | { outcome: 'published'; variantsCount: number; expected: number; link: string }

/**
 * Publie le brouillon SI (et seulement si) il est complet, puis pose les 2 liens toile↔poster
 * et nettoie le marqueur `poster_draft`.
 *
 *   - `missing`  : le brouillon n'existe plus (supprimé à la main) → on nettoie le marqueur pour
 *                  que la toile redevienne une candidate normale.
 *   - `pending`  : variantes incomplètes (ou modèle illisible) → on ne publie PAS, le brouillon
 *                  reste caché, marqueur conservé (reprise plus tard). Rien n'est supprimé.
 *   - `published`: en ligne + lié.
 */
export async function finalizePosterDraft(
  shopify: Shopify,
  toileId: string,
  productId: string,
  ratio: string
): Promise<FinalizeOutcome> {
  const product = (await shopify.product.getProductById(productId)) as any

  if (!product) {
    await shopify.metafield.delete(toileId, 'link', 'poster_draft')
    return { outcome: 'missing' }
  }

  const variantsCount = product?.variants?.nodes?.length ?? 0
  const expected = await expectedVariantCount(shopify, ratio)
  if (!expected || variantsCount < expected) {
    return { outcome: 'pending', variantsCount, expected }
  }

  // Complet → publier puis lier. link.poster en dernier = signal « terminé ».
  await shopify.product.update(productId, { status: 'ACTIVE' })
  await shopify.publications.publishProductOnAll(productId)
  await shopify.metafield.update(productId, 'link', 'painting', toileId, 'product_reference')
  await shopify.metafield.update(toileId, 'link', 'poster', productId, 'product_reference')
  // Nettoyage du marqueur « brouillon en cours » (best-effort).
  await shopify.metafield.delete(toileId, 'link', 'poster_draft')

  // link : « Voir le produit » côté studio (pipeline toile → poster jumeau). Admin plutôt que
  // storefront : onlineStoreUrl peut mettre quelques secondes à exister après la publication.
  const link = `${Env.get('SHOPIFY_SHOP_URL')}/admin/products/${String(productId).split('/').pop()}`
  return { outcome: 'published', variantsCount, expected, link }
}
