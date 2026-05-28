import Shopify from 'App/Services/Shopify'

export interface IndexedProduct {
  handle: string
  title: string
  productType: string
  tagsNorm: string
  descriptionNorm: string
  titleNorm: string
  colorLabels: string[] // normalized color labels (e.g. "jaune")
  themeLabels: string[] // normalized theme labels (e.g. "zen")
  imageUrl?: string
  url: string
  bestSellerRank: number // lower = better seller; Infinity if unranked
}

export function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function thirdImageUrl(p: any): string | undefined {
  const nodes = p.media?.nodes ?? []
  const urls: string[] = []
  for (const n of nodes) if (n?.image?.url) urls.push(n.image.url)
  return urls[2] ?? urls[1] ?? urls[0]
}

function publicUrl(p: any): string {
  return p.onlineStoreUrl || `https://myselfmonart.com/products/${p.handle ?? ''}`
}

/**
 * Resolve a `list.metaobject_reference` metafield value into the GIDs it
 * points to. Shopify stores these as a JSON array of GID strings.
 */
function metafieldGids(p: any, key: string): string[] {
  const edges = p.metafields?.edges ?? []
  const node = edges.find((e: any) => e.node?.namespace === 'shopify' && e.node?.key === key)?.node
  if (!node?.value) return []
  try {
    const parsed = JSON.parse(node.value)
    if (Array.isArray(parsed)) return parsed.filter((g) => typeof g === 'string')
    if (typeof parsed === 'string') return [parsed]
  } catch {
    if (typeof node.value === 'string' && node.value.startsWith('gid://')) return [node.value]
  }
  return []
}

/**
 * Cached, query-ready view of the catalog for conversational search.
 * Building it is expensive (full getAll + two metaobject fetches + a
 * best-seller pass), so we cache for CACHE_TTL and share across requests.
 */
export default class ProductIndex {
  private static cache: IndexedProduct[] | null = null
  private static builtAt = 0
  private static readonly CACHE_TTL = 10 * 60 * 1000 // 10 min
  private static building: Promise<IndexedProduct[]> | null = null

  public static async get(): Promise<IndexedProduct[]> {
    const fresh = ProductIndex.cache && Date.now() - ProductIndex.builtAt < ProductIndex.CACHE_TTL
    if (fresh) return ProductIndex.cache!
    // Collapse concurrent rebuilds into one.
    if (!ProductIndex.building) {
      ProductIndex.building = ProductIndex.build().finally(() => {
        ProductIndex.building = null
      })
    }
    return ProductIndex.building
  }

  private static async build(): Promise<IndexedProduct[]> {
    const shopify = new Shopify()

    const [products, colorMObjs, themeMObjs, bestSellerGids] = await Promise.all([
      shopify.product.getAll(false),
      shopify.metaobject.getAll('shopify--color-pattern'),
      shopify.metaobject.getAll('shopify--theme'),
      shopify.product.getBestSellerGids(),
    ])

    const labelByGid = new Map<string, string>()
    for (const mo of [...colorMObjs, ...themeMObjs] as any[]) {
      const label =
        mo.fields?.find((f: any) => f.key === 'label')?.value ||
        mo.fields?.find((f: any) => f.key === 'name')?.value ||
        mo.handle
      if (mo.id && label) labelByGid.set(mo.id, normalize(label))
    }

    const rankByGid = new Map<string, number>()
    bestSellerGids.forEach((gid, i) => rankByGid.set(gid, i))

    const index: IndexedProduct[] = (products as any[]).map((p) => {
      const colorLabels = metafieldGids(p, 'color-pattern')
        .map((g) => labelByGid.get(g))
        .filter((l): l is string => !!l)
      const themeLabels = metafieldGids(p, 'theme')
        .map((g) => labelByGid.get(g))
        .filter((l): l is string => !!l)

      return {
        handle: p.handle ?? '',
        title: p.title ?? '',
        productType: p.productType ?? '',
        titleNorm: normalize(p.title ?? ''),
        tagsNorm: normalize((p.tags ?? []).join(' ')),
        descriptionNorm: normalize(stripHtml(p.description ?? '')),
        colorLabels,
        themeLabels,
        imageUrl: thirdImageUrl(p),
        url: publicUrl(p),
        bestSellerRank: rankByGid.get(p.id) ?? Number.POSITIVE_INFINITY,
      }
    })

    ProductIndex.cache = index
    ProductIndex.builtAt = Date.now()
    console.info(
      `🗂️  ProductIndex built: ${index.length} products, ` +
        `${labelByGid.size} color/theme labels, ${bestSellerGids.length} ranked`
    )
    return index
  }
}
