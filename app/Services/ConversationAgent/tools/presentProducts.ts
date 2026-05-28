import type { ToolHandler } from './types'

const presentProducts: ToolHandler = {
  definition: {
    name: 'presentProducts',
    description:
      "Affiche des produits au client sous forme de jolies cartes cliquables (carrousel avec image, titre et bouton 'Voir'). À appeler APRÈS getProductByQuery, avec les handles des produits que tu veux montrer (max 5). Les cartes sont envoyées automatiquement après ton message texte. IMPORTANT : quand tu utilises ce tool, ton texte doit rester une courte intro chaleureuse SANS aucune URL ni liste de liens — les cartes portent déjà les liens.",
    input_schema: {
      type: 'object',
      properties: {
        handles: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 5,
          description:
            'Les handles des produits à montrer, tels que renvoyés par getProductByQuery (champ "handle").',
        },
      },
      required: ['handles'],
    },
  },

  async execute(input: { handles: string[] }, context): Promise<string> {
    const { scratch } = context
    const found: string[] = []
    const missing: string[] = []

    for (const handle of input.handles.slice(0, 5)) {
      const card = scratch.productsByHandle.get(handle)
      if (card) {
        // de-dupe in case the same handle is presented twice
        if (!scratch.cardsToSend.some((c) => c.url === card.url)) {
          scratch.cardsToSend.push(card)
        }
        found.push(handle)
      } else {
        missing.push(handle)
      }
    }

    if (found.length === 0) {
      return JSON.stringify({
        ok: false,
        message:
          "Aucun de ces handles n'est connu. Appelle d'abord getProductByQuery, puis réutilise les handles exacts qu'il renvoie.",
        missing,
      })
    }

    return JSON.stringify({
      ok: true,
      cards_queued: found.length,
      message: `${found.length} carte(s) seront envoyées après ton message. Écris une intro courte et chaleureuse, SANS URL ni liste de liens.`,
      ...(missing.length ? { ignored_unknown_handles: missing } : {}),
    })
  },
}

export default presentProducts
