import Gmail from 'App/Services/Gmail'
import type { ProductCard, CtaButton } from 'App/Services/ConversationAgent/tools'

export interface IncomingEmailMeta {
  /** Customer email to reply to. */
  to: string
  /** Original subject (we prefix with "Re:" if needed). */
  subject: string
  /** Gmail thread id, to keep the reply in the same conversation. */
  threadId?: string
  /** Original RFC822 Message-ID, for the In-Reply-To header. */
  rfcMessageId?: string | null
  /** Original References header, to extend the thread chain. */
  references?: string | null
}

export interface EmailDraftResult {
  draftId: string | null
  messageId: string | null
}

const SIGNATURE = `L'équipe MyselfMonArt`

/**
 * Renders the agent's reply as an HTML email (text + product cards + CTA) and
 * saves it as a Gmail DRAFT in the original thread — the draft-first phase, so
 * a human reviews before anything goes to the customer. The Meta-only rich
 * formats (carousel, button card) become inline HTML here.
 */
export default class EmailReplySender {
  private gmail = new Gmail()

  public async createDraftReply(
    meta: IncomingEmailMeta,
    replyText: string,
    cards: ProductCard[] = [],
    cta: CtaButton | null = null
  ): Promise<EmailDraftResult> {
    const html = this.buildHtml(replyText, cards, cta)
    const res = await this.gmail.createDraft({
      to: meta.to,
      subject: this.replySubject(meta.subject),
      htmlBody: html,
      threadId: meta.threadId,
      inReplyTo: meta.rfcMessageId ?? null,
      references: meta.references ?? null,
    })
    return { draftId: res.draftId, messageId: res.messageId }
  }

  private replySubject(subject: string): string {
    const s = (subject || '').trim()
    return /^re\s*:/i.test(s) ? s : `Re: ${s || '(sans objet)'}`
  }

  private buildHtml(replyText: string, cards: ProductCard[], cta: CtaButton | null): string {
    const text = this.escapeHtml(replyText).replace(/\n/g, '<br>')
    const cardsHtml = cards.length ? this.renderCards(cards) : ''
    const ctaHtml = cta && cta.url ? this.renderCta(cta) : ''
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff">
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.6;font-size:15px;max-width:600px;margin:0 auto;padding:8px 4px">
    <p style="margin:0 0 16px">${text}</p>
    ${cardsHtml}
    ${ctaHtml}
    <p style="margin:24px 0 0;color:#444">${SIGNATURE}</p>
  </div>
</body></html>`
  }

  private renderCards(cards: ProductCard[]): string {
    const cells = cards
      .slice(0, 6)
      .filter((c) => c.url)
      .map((c) => {
        const title = this.escapeHtml(c.title || 'Découvrir')
        const subtitle = c.subtitle
          ? `<div style="color:#666;font-size:13px;margin:2px 0 8px">${this.escapeHtml(c.subtitle)}</div>`
          : ''
        const img = c.imageUrl
          ? `<a href="${this.escapeAttr(c.url)}"><img src="${this.escapeAttr(
              c.imageUrl
            )}" alt="${this.escapeAttr(c.title || '')}" style="width:100%;max-width:260px;border-radius:8px;display:block"></a>`
          : ''
        return `<td style="vertical-align:top;padding:8px;width:50%">
          ${img}
          <div style="font-weight:600;margin:8px 0 0">${title}</div>
          ${subtitle}
          <a href="${this.escapeAttr(
            c.url
          )}" style="display:inline-block;color:#0a7d33;text-decoration:none;font-weight:600">Voir l'œuvre →</a>
        </td>`
      })

    const rows: string[] = []
    for (let i = 0; i < cells.length; i += 2) {
      rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td style="width:50%"></td>'}</tr>`)
    }
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 16px">${rows.join(
      ''
    )}</table>`
  }

  private renderCta(cta: CtaButton): string {
    const label = this.escapeHtml(cta.buttonLabel || 'Ouvrir')
    const title = cta.title
      ? `<div style="font-weight:600;margin:0 0 6px">${this.escapeHtml(cta.title)}</div>`
      : ''
    const subtitle = cta.subtitle
      ? `<div style="color:#666;font-size:13px;margin:0 0 8px">${this.escapeHtml(cta.subtitle)}</div>`
      : ''
    return `<div style="margin:8px 0 16px;padding:16px;border:1px solid #eee;border-radius:8px">
      ${title}${subtitle}
      <a href="${this.escapeAttr(
        cta.url
      )}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">${label}</a>
    </div>`
  }

  private escapeHtml(s: string): string {
    return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  private escapeAttr(s: string): string {
    return (s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
}
