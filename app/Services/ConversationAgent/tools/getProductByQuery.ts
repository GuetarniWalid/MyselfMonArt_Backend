import Shopify from 'App/Services/Shopify'
import type { ToolHandler } from './types'

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

const getProductByQuery: ToolHandler = {
  definition: {
    name: 'getProductByQuery',
    description:
      "Recherche des produits de la boutique par mot-clé (titre, description, type, tags). Utilise ce tool dès qu'un client demande s'il existe une œuvre sur un sujet précis (chat, lion, japonais, salon, etc.). Retourne jusqu'à 5 produits avec titre, URL publique, prix et un court extrait de description.",
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
          description:
            'Nombre max de produits à retourner. Garde-le bas (3) pour rester lisible en DM.',
        },
      },
      required: ['query'],
    },
  },

  async execute(input: { query: string; limit?: number }): Promise<string> {
    const limit = Math.min(Math.max(input.limit ?? 3, 1), 5)
    const needle = normalize(input.query)

    const shopify = new Shopify()
    const products = await shopify.product.getAll(false)

    const scored: Array<{ score: number; p: any }> = []
    for (const p of products as any[]) {
      const title = normalize(p.title ?? '')
      const productType = normalize(p.productType ?? '')
      const tags = normalize((p.tags ?? []).join(' '))
      const description = normalize(stripHtml(p.bodyHtml ?? p.description ?? ''))

      let score = 0
      if (title.includes(needle)) score += 5
      if (productType.includes(needle)) score += 3
      if (tags.includes(needle)) score += 2
      if (description.includes(needle)) score += 1

      if (score > 0) scored.push({ score, p })
    }

    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, limit).map(({ p }) => {
      const handle = p.handle ?? ''
      const variants = p.variants?.edges?.map((e: any) => e.node) ?? p.variants ?? []
      const firstPrice = variants[0]?.price ?? p.price ?? null
      const desc = stripHtml(p.bodyHtml ?? p.description ?? '')
      return {
        title: p.title,
        url: `https://myselfmonart.com/products/${handle}`,
        price_eur: firstPrice,
        product_type: p.productType,
        excerpt: desc.length > 200 ? desc.slice(0, 200) + '…' : desc,
      }
    })

    if (top.length === 0) {
      return JSON.stringify({
        found: false,
        message: `Aucun produit ne correspond à "${input.query}". Préviens le client honnêtement, propose une alternative ou demande-lui de préciser ce qu'il cherche.`,
      })
    }

    return JSON.stringify({ found: true, count: top.length, products: top })
  },
}

export default getProductByQuery
