import ProductIndex, { IndexedProduct, normalize } from '../ProductIndex'
import type { ToolHandler, ProductCard } from './types'

interface Criteria {
  theme?: string
  color?: string
  keyword?: string
}

function matchesTheme(p: IndexedProduct, t: string): boolean {
  return p.themeLabels.some((l) => l.includes(t) || t.includes(l))
}
function matchesColor(p: IndexedProduct, c: string): boolean {
  return p.colorLabels.some((l) => l.includes(c) || c.includes(l))
}
function matchesKeyword(p: IndexedProduct, k: string): boolean {
  return (
    p.titleNorm.includes(k) ||
    normalize(p.productType).includes(k) ||
    p.tagsNorm.includes(k) ||
    p.descriptionNorm.includes(k)
  )
}

function applyFilters(index: IndexedProduct[], c: Criteria): IndexedProduct[] {
  let pool = index
  if (c.theme) pool = pool.filter((p) => matchesTheme(p, c.theme!))
  if (c.color) pool = pool.filter((p) => matchesColor(p, c.color!))
  if (c.keyword) pool = pool.filter((p) => matchesKeyword(p, c.keyword!))
  return pool
}

const searchProducts: ToolHandler = {
  definition: {
    name: 'searchProducts',
    description:
      "Recherche des produits par critères structurés et renvoie les plus vendus en premier. Extrait les critères du message du client et appelle ce tool UNE SEULE FOIS (ne fais pas une recherche par critère). Le filtrage et le tri sont faits par le code, pas par toi. Si un critère ne donne rien, le tool relâche automatiquement le critère le moins important et te le signale (champ 'relaxed') — explique-le alors honnêtement au client. Pour MONTRER les résultats, appelle ensuite presentProducts avec les handles ; n'écris jamais d'URL dans ton texte.",
    input_schema: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          description:
            "Thème/ambiance recherché (ex: 'zen', 'bohème', 'japonais', 'enfant'). Optionnel.",
        },
        color: {
          type: 'string',
          description:
            "Couleur dominante souhaitée (ex: 'jaune', 'vert', 'noir et blanc'). Optionnel.",
        },
        keyword: {
          type: 'string',
          description:
            "Sujet libre si pas couvert par theme/color (ex: 'lion', 'cerisier', 'Frida'). Optionnel.",
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 5,
          default: 4,
          description: 'Nombre max de produits (garde-le bas, 3-4).',
        },
      },
    },
  },

  async execute(
    input: { theme?: string; color?: string; keyword?: string; limit?: number },
    context
  ): Promise<string> {
    const limit = Math.min(Math.max(input.limit ?? 4, 1), 5)
    const criteria: Criteria = {
      theme: input.theme ? normalize(input.theme) : undefined,
      color: input.color ? normalize(input.color) : undefined,
      keyword: input.keyword ? normalize(input.keyword) : undefined,
    }

    if (!criteria.theme && !criteria.color && !criteria.keyword) {
      return JSON.stringify({
        found: false,
        message: 'Aucun critère fourni. Demande au client de préciser ce qu’il cherche.',
      })
    }

    const index = await ProductIndex.get()

    // Try full AND match, then relax the least important criterion at a time:
    // color first (refinement), then keyword, then theme (primary intent).
    const relaxOrder: Array<keyof Criteria> = ['color', 'keyword', 'theme']
    let working: Criteria = { ...criteria }
    const relaxed: string[] = []
    let pool = applyFilters(index, working)

    while (pool.length === 0) {
      const next = relaxOrder.find((k) => working[k] !== undefined)
      if (!next) break
      relaxed.push(next)
      working = { ...working, [next]: undefined }
      pool = applyFilters(index, working)
    }

    if (pool.length === 0) {
      return JSON.stringify({
        found: false,
        message:
          "Rien ne correspond, même en relâchant les critères. Propose au client d'explorer un autre thème ou demande-lui de préciser.",
      })
    }

    pool = [...pool].sort((a, b) => a.bestSellerRank - b.bestSellerRank).slice(0, limit)

    const products = pool.map((p) => {
      const card: ProductCard = {
        title: p.title.slice(0, 80),
        subtitle: (p.productType || p.themeLabels.join(', ')).slice(0, 80),
        imageUrl: p.imageUrl,
        url: p.url,
      }
      context.scratch.productsByHandle.set(p.handle, card)
      return {
        handle: p.handle,
        title: p.title,
        product_type: p.productType,
        colors: p.colorLabels,
        themes: p.themeLabels,
        has_image: !!card.imageUrl,
      }
    })

    return JSON.stringify({
      found: true,
      count: products.length,
      sorted_by: 'best_selling',
      ...(relaxed.length ? { relaxed } : {}),
      products,
      hint: relaxed.length
        ? `Critère(s) relâché(s) faute de résultat exact : ${relaxed.join(', ')}. Mentionne-le honnêtement au client. Puis appelle presentProducts avec les handles choisis.`
        : 'Appelle presentProducts avec les handles choisis. Écris seulement une courte intro, sans URL.',
    })
  },
}

export default searchProducts
