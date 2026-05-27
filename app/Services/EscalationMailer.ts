import Env from '@ioc:Adonis/Core/Env'
import Mail from '@ioc:Adonis/Addons/Mail'
import type Conversation from 'App/Models/Conversation'
import type ConversationMessage from 'App/Models/ConversationMessage'

const CHANNEL_LABEL: Record<string, string> = {
  instagram: 'Instagram DM',
  messenger: 'Facebook Messenger',
}

export default class EscalationMailer {
  /**
   * Send an email summary of an escalated conversation to MAIL_RECIPIENT.
   * Includes the reason, the recap of the last messages, and a link the
   * human can use to jump to the IG/FB inbox.
   */
  public async send(
    conversation: Conversation,
    history: ConversationMessage[],
    finalReplyText: string | null
  ): Promise<void> {
    const channelLabel = CHANNEL_LABEL[conversation.channel] ?? conversation.channel
    const reason = conversation.escalationReason ?? 'unknown'
    const summary = (conversation.metadata as any)?.escalation_summary ?? '(no summary provided)'

    const inboxUrl = this.buildInboxUrl(conversation)

    const recap = history
      .slice(-8)
      .map((m) => {
        const who = m.role === 'user' ? 'CLIENT' : m.role === 'assistant' ? 'BOT' : 'TOOL'
        return `[${who}] ${m.content ?? ''}`
      })
      .join('\n\n')

    const body = [
      `Une conversation ${channelLabel} a été escaladée vers humain.`,
      ``,
      `Raison : ${reason}`,
      `Résumé : ${summary}`,
      ``,
      `Lien direct vers l'inbox :`,
      inboxUrl ?? '(lien non disponible)',
      ``,
      `--- Derniers échanges ---`,
      recap,
      ``,
      finalReplyText
        ? `--- Réponse auto envoyée au client ---\n${finalReplyText}`
        : '(aucune réponse auto envoyée)',
    ].join('\n')

    await Mail.send((message) => {
      message
        .to(Env.get('MAIL_RECIPIENT'))
        .from(Env.get('MAIL_SENDER'))
        .subject(`[SAV escalade ${channelLabel}] ${reason}`)
        .text(body)
    })
  }

  private buildInboxUrl(conversation: Conversation): string | null {
    if (conversation.channel === 'instagram') {
      return `https://www.instagram.com/direct/t/${conversation.externalThreadId}`
    }
    if (conversation.channel === 'messenger') {
      return `https://business.facebook.com/latest/inbox`
    }
    return null
  }
}
