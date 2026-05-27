import Shopify from 'App/Services/Shopify'
import type { ToolHandler } from './types'

const POLICY_HANDLE_KEYWORDS: Record<string, string[]> = {
  refund: ['refund', 'remboursement', 'return', 'retour'],
  shipping: ['shipping', 'livraison', 'expedition', 'expédition'],
  terms: ['terms', 'cgv', 'conditions', 'condition-generale', 'condition-générale'],
  privacy: ['privacy', 'confidentialite', 'confidentialité', 'donnees', 'données'],
  legal: ['legal', 'mentions-legales', 'mentions-légales', 'imprint'],
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

const getShopPolicy: ToolHandler = {
  definition: {
    name: 'getShopPolicy',
    description:
      "Récupère le contenu d'une politique de la boutique (remboursement, livraison, CGV, confidentialité, mentions légales). Utilise toujours ce tool avant d'affirmer quoi que ce soit sur une politique. Retourne le titre, le contenu en texte brut, et l'URL publique de la page.",
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['refund', 'shipping', 'terms', 'privacy', 'legal'],
          description:
            'Le type de politique demandée. refund = remboursement/retour, shipping = livraison/expédition, terms = CGV, privacy = confidentialité, legal = mentions légales.',
        },
      },
      required: ['type'],
    },
  },

  async execute(input: { type: string }): Promise<string> {
    const keywords = POLICY_HANDLE_KEYWORDS[input.type]
    if (!keywords) {
      return JSON.stringify({ error: `Type de politique inconnu: ${input.type}` })
    }

    const shopify = new Shopify()
    const pages = await shopify.page.getAll()

    const match = pages.find((p: any) => {
      const handle = (p.handle ?? '').toLowerCase()
      const title = (p.title ?? '').toLowerCase()
      return keywords.some((k) => handle.includes(k) || title.includes(k))
    })

    if (!match) {
      return JSON.stringify({
        found: false,
        message: `Aucune page de politique trouvée pour le type "${input.type}". Préviens le client honnêtement que tu ne trouves pas l'info et déclenche escalateToHuman si nécessaire.`,
      })
    }

    const body = stripHtml((match as any).body ?? '')
    const handle = (match as any).handle ?? ''

    return JSON.stringify({
      found: true,
      title: (match as any).title,
      handle,
      url: `https://myselfmonart.com/pages/${handle}`,
      content: body.length > 3000 ? body.slice(0, 3000) + '… [contenu tronqué]' : body,
    })
  },
}

export default getShopPolicy
