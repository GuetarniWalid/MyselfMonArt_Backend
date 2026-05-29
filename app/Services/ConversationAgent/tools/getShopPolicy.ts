import Shopify from 'App/Services/Shopify'
import type { ToolHandler } from './types'

const POLICY_HANDLE_KEYWORDS: Record<string, string[]> = {
  refund: ['refund', 'remboursement', 'return', 'retour'],
  shipping: ['shipping', 'livraison', 'expedition', 'expédition'],
  terms: ['terms', 'cgv', 'conditions', 'condition-generale', 'condition-générale'],
  privacy: ['privacy', 'confidentialite', 'confidentialité', 'donnees', 'données'],
  legal: ['legal', 'mentions-legales', 'mentions-légales', 'imprint'],
  faq: ['faq', 'questions-frequentes', 'questions'],
}

// Types that fall back to the FAQ page when no dedicated page exists.
// The shop has no standalone shipping page — delivery times, order tracking
// and similar operational answers live in the FAQ.
const FALLBACK_TO_FAQ = new Set(['shipping'])

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
      "Récupère le contenu d'une page d'information de la boutique. Utilise toujours ce tool avant d'affirmer quoi que ce soit sur une politique, un délai ou une modalité. Pour les questions de LIVRAISON, DÉLAIS et SUIVI DE COMMANDE, utilise type='shipping' (qui renvoie la FAQ si aucune page livraison dédiée n'existe) ou type='faq'. Retourne le titre, le contenu en texte brut, et l'URL publique.",
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['refund', 'shipping', 'terms', 'privacy', 'legal', 'faq'],
          description:
            "Type d'info : refund = remboursement/retour, shipping = livraison/délais/suivi (retombe sur la FAQ), terms = CGV, privacy = confidentialité, legal = mentions légales, faq = questions fréquentes (délais, suivi, tailles, paiement...).",
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

    const findBy = (kws: string[]) =>
      pages.find((p: any) => {
        const handle = (p.handle ?? '').toLowerCase()
        const title = (p.title ?? '').toLowerCase()
        return kws.some((k) => handle.includes(k) || title.includes(k))
      })

    let match = findBy(keywords)
    let usedFallback = false
    if (!match && FALLBACK_TO_FAQ.has(input.type)) {
      match = findBy(POLICY_HANDLE_KEYWORDS.faq)
      usedFallback = !!match
    }

    if (!match) {
      return JSON.stringify({
        found: false,
        message: `Aucune page trouvée pour "${input.type}". Préviens le client honnêtement et déclenche escalateToHuman uniquement si c'est un cas extrême.`,
      })
    }

    const body = stripHtml((match as any).body ?? '')
    const handle = (match as any).handle ?? ''

    return JSON.stringify({
      found: true,
      title: (match as any).title,
      handle,
      url: `https://myselfmonart.com/pages/${handle}`,
      ...(usedFallback
        ? {
            note: 'Pas de page livraison dédiée — voici la FAQ, qui couvre les délais/suivi. Extrais-en la réponse.',
          }
        : {}),
      content: body.length > 3000 ? body.slice(0, 3000) + '… [contenu tronqué]' : body,
    })
  },
}

export default getShopPolicy
