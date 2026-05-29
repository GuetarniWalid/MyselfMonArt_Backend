import type { ToolHandler } from './types'

const flagSpam: ToolHandler = {
  definition: {
    name: 'flagSpam',
    description:
      "Marque la conversation comme non-légitime pour qu'on cesse d'y répondre (et qu'on ne gaspille plus de tokens). À utiliser UNIQUEMENT quand tu as une vraie certitude qu'il ne s'agit pas d'un client : démarchage commercial (SEO, marketing, influenceurs, crypto, \"boostez vos ventes\"...), bot/spam automatisé, ou conversation manifestement sans objet qui tourne en rond. NE FLAGUE PAS un vrai client, même mécontent, confus ou hors-sujet de bonne foi. Une fois flaggée, le système n'enverra plus aucune réponse à cette personne — donc sois sûr de toi.",
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description:
            "Catégorie courte : 'demarchage_commercial', 'bot_spam', 'conversation_sans_objet'.",
        },
        summary: {
          type: 'string',
          description: 'Une phrase expliquant pourquoi cette conversation est jugée non-légitime.',
        },
      },
      required: ['reason'],
    },
  },

  async execute(input: { reason: string; summary?: string }, context): Promise<string> {
    const { conversation } = context
    const metadata = conversation.metadata ?? {}
    metadata.blocked = true
    metadata.blocked_reason = input.reason
    if (input.summary) metadata.blocked_summary = input.summary
    conversation.metadata = metadata
    conversation.status = 'closed'
    await conversation.save()

    return JSON.stringify({
      ok: true,
      message:
        'Conversation flaggée et fermée. AUCUNE réponse ne sera envoyée à cette personne (ni maintenant ni ensuite). Ne rédige pas de réponse.',
    })
  },
}

export default flagSpam
