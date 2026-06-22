import Env from '@ioc:Adonis/Core/Env'
import axios from 'axios'
import type Conversation from 'App/Models/Conversation'
import type ConversationMessage from 'App/Models/ConversationMessage'

const CHANNEL_LABEL: Record<string, string> = {
  instagram: 'Instagram DM',
  messenger: 'Facebook Messenger',
  email: 'Email',
}

// DigitalOcean blocks outbound SMTP on the droplet, so we send transactional
// mail over Resend's HTTPS API instead of @adonisjs/mail's SMTP transport.
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

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

    const recapHtml = history
      .slice(-8)
      .map((m) => {
        const who = m.role === 'user' ? 'CLIENT' : m.role === 'assistant' ? 'BOT' : 'TOOL'
        return `<p style="margin:0 0 10px"><strong>[${who}]</strong> ${this.escapeHtml(
          m.content ?? ''
        )}</p>`
      })
      .join('')

    // Plain-text fallback (some clients prefer it). Kept for completeness.
    const text = [
      `Une conversation ${channelLabel} a été escaladée vers humain.`,
      ``,
      `Raison : ${reason}`,
      `Résumé : ${summary}`,
      ``,
      `Lien direct vers l'inbox : ${inboxUrl ?? '(lien non disponible)'}`,
      ``,
      `--- Derniers échanges ---`,
      ...history.slice(-8).map((m) => {
        const who = m.role === 'user' ? 'CLIENT' : m.role === 'assistant' ? 'BOT' : 'TOOL'
        return `[${who}] ${m.content ?? ''}`
      }),
      ``,
      finalReplyText
        ? `--- Réponse auto envoyée ---\n${finalReplyText}`
        : '(aucune réponse auto envoyée)',
    ].join('\n')

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 4px">Escalade SAV — ${channelLabel}</h2>
  <p style="margin:0 0 16px;color:#666">Une conversation a été escaladée vers un humain.</p>
  <table style="border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:2px 12px 2px 0;color:#666">Raison</td><td><strong>${this.escapeHtml(
      reason
    )}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#666;vertical-align:top">Résumé</td><td>${this.escapeHtml(
      summary
    )}</td></tr>
  </table>
  ${
    inboxUrl
      ? `<p style="margin:0 0 16px"><a href="${inboxUrl}" style="background:#0095f6;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none">Ouvrir la conversation</a></p>`
      : ''
  }
  <h3 style="margin:16px 0 8px;border-top:1px solid #eee;padding-top:16px">Derniers échanges</h3>
  ${recapHtml}
  ${
    finalReplyText
      ? `<h3 style="margin:16px 0 8px;border-top:1px solid #eee;padding-top:16px">Réponse auto envoyée au client</h3><p style="margin:0">${this.escapeHtml(
          finalReplyText
        )}</p>`
      : ''
  }
</body></html>`

    await axios.post(
      RESEND_ENDPOINT,
      {
        from: Env.get('RESEND_FROM'),
        to: [Env.get('MAIL_RECIPIENT')],
        subject: `[SAV escalade ${channelLabel}] ${reason}`,
        html,
        text,
      },
      {
        headers: {
          'Authorization': `Bearer ${Env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        timeout: 10000,
      }
    )
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
  }

  private buildInboxUrl(conversation: Conversation): string | null {
    if (conversation.channel === 'instagram') {
      return `https://www.instagram.com/direct/t/${conversation.externalThreadId}`
    }
    if (conversation.channel === 'messenger') {
      return `https://business.facebook.com/latest/inbox`
    }
    if (conversation.channel === 'email') {
      return `https://mail.google.com/mail/u/0/#all/${conversation.externalThreadId}`
    }
    return null
  }
}
