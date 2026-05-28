import Shopify from 'App/Services/Shopify'
import type { ToolHandler, ProductCard } from './types'

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cardImageUrl(p: any): string | undefined {
  const nodes = p.media?.nodes ?? []
  const imageUrls: string[] = []
  for (const n of nodes) {
    if (n?.image?.url) imageUrls.push(n.image.url as string)
  }
  // Use the THIRD image (index 2) for the card — the preferred in-situ shot.
  // Fall back to earlier images when the product has fewer than three.
  return imageUrls[2] ?? imageUrls[1] ?? imageUrls[0]
}

function publicUrl(p: any): string {
  return p.onlineStoreUrl || `https://myselfmonart.com/products/${p.handle ?? ''}`
}

const getProductByQuery: ToolHandler = {
  definition: {
    name: 'getProductByQuery',
    description:
      "Recherche des produits de la boutique par mot-clé (titre, description, type, tags). Utilise ce tool dès qu'un client cherche une œuvre sur un sujet précis (chat, lion, japonais, salon, etc.). Retourne jusqu'à 5 produits avec titre, handle et extrait. Pour MONTRER ces produits au client, n'écris PAS les URLs dans ton texte — appelle plutôt le tool presentProducts avec les handles choisis.",
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Le mot-clé ou expression à chercher. Une seule notion à la fois (ex: "lion", "japonais", "salon bohème").',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 5,
          default: 3,
          description: 'Nombre max de produits à retourner (garde-le bas, 3).',
        },
      },
      required: ['query'],
    },
  },

  async execute(input: { query: string; limit?: number }, context): Promise<string> {
    const limit = Math.min(Math.max(input.limit ?? 3, 1), 5)
    const needle = normalize(input.query)

    const shopify = new Shopify()
    const products = await shopify.product.getAll(false)

    const scored: Array<{ score: number; p: any }> = []
    for (const p of products as any[]) {
      const title = normalize(p.title ?? '')
      const productType = normalize(p.productType ?? '')
      const tags = normalize((p.tags ?? []).join(' '))
      const description = normalize(stripHtml(p.description ?? ''))

      let score = 0
      if (title.includes(needle)) score += 5
      if (productType.includes(needle)) score += 3
      if (tags.includes(needle)) score += 2
      if (description.includes(needle)) score += 1

      if (score > 0) scored.push({ score, p })
    }

    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, limit)

    if (top.length === 0) {
      return JSON.stringify({
        found: false,
        message: `Aucun produit ne correspond à "${input.query}". Préviens le client honnêtement et propose de préciser ou explorer un autre thème.`,
      })
    }

    // Stash full card data so presentProducts can render cards by handle,
    // and return a lean list to Claude (no image URLs to copy around).
    const summary = top.map(({ p }) => {
      const handle = p.handle ?? ''
      const desc = stripHtml(p.description ?? '')
      const card: ProductCard = {
        title: (p.title ?? '').slice(0, 80),
        subtitle: (p.productType || desc).slice(0, 80),
        imageUrl: cardImageUrl(p),
        url: publicUrl(p),
      }
      context.scratch.productsByHandle.set(handle, card)
      return {
        handle,
        title: p.title,
        product_type: p.productType,
        has_image: !!card.imageUrl,
        excerpt: desc.length > 160 ? desc.slice(0, 160) + '…' : desc,
      }
    })

    return JSON.stringify({
      found: true,
      count: summary.length,
      products: summary,
      hint: 'Pour les montrer, appelle presentProducts avec les handles choisis. Écris seulement une courte intro, sans URL.',
    })
  },
}

export default getProductByQuery
