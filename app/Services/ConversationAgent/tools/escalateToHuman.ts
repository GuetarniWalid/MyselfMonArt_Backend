import { DateTime } from 'luxon'
import type { ToolHandler } from './types'

const escalateToHuman: ToolHandler = {
  definition: {
    name: 'escalateToHuman',
    description:
      "Marque la conversation comme nécessitant une intervention humaine. À appeler UNIQUEMENT pour les cas extrêmes définis dans <escalation_policy> du prompt système : menace légale, produit endommagé avec demande de geste, demande explicite d'humain, insultes, ou cas vraiment hors de portée des autres tools. NE PAS escalader pour une question de remboursement ou de livraison (utiliser getShopPolicy à la place). Continue à répondre poliment au client APRÈS avoir appelé ce tool — un membre de l'équipe verra l'escalade par email.",
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description:
            "Code court qui catégorise l'escalade. Exemples : 'menace_legale', 'produit_endommage', 'demande_humain', 'insultes', 'info_indisponible'.",
        },
        summary: {
          type: 'string',
          description:
            "Résumé en 1-2 phrases du problème à résoudre côté humain. C'est ce que l'équipe lira en premier dans l'email.",
        },
      },
      required: ['reason', 'summary'],
    },
  },

  async execute(input: { reason: string; summary: string }, context): Promise<string> {
    const { conversation } = context
    conversation.status = 'escalated'
    conversation.escalatedAt = DateTime.now()
    conversation.escalationReason = input.reason.slice(0, 190)
    await conversation.save()

    // The actual email is sent by the InboxProcessor after the agent loop
    // finishes, so the email can include the final assistant reply too.
    // Here we just flip the state and stash the summary in metadata.
    const metadata = conversation.metadata ?? {}
    metadata.escalation_summary = input.summary
    conversation.metadata = metadata
    await conversation.save()

    return JSON.stringify({
      ok: true,
      message:
        "Conversation marquée pour escalade. L'équipe sera notifiée par email. Continue à répondre au client avec empathie et indique qu'un humain reviendra vers eux rapidement.",
    })
  },
}

export default escalateToHuman
