import Env from '@ioc:Adonis/Core/Env'
import { google, gmail_v1 } from 'googleapis'

const DEFAULT_BUSINESS_EMAIL = 'team@myselfmonart.com'

export interface ParsedEmail {
  /** Gmail's internal message id — used for modify/label/get. */
  gmailMessageId: string
  /** Gmail thread id — the conversation key. */
  threadId: string
  /** RFC822 Message-ID header — used to build In-Reply-To / References. */
  rfcMessageId: string | null
  /** Raw From header, e.g. `"Jane Doe" <jane@x.com>`. */
  from: string
  /** Extracted, lowercased sender email. */
  fromEmail: string
  fromName: string | null
  to: string | null
  subject: string
  /** Cleaned plain-text body (quoted history + signatures trimmed). */
  body: string
  /** References header — needed to keep the reply in the same thread. */
  references: string | null
  /** Epoch ms. */
  internalDate: number | null
  labelIds: string[]
}

/**
 * Thin backend wrapper around the Gmail API (googleapis) for the SAV email
 * channel. Authenticates as the business mailbox via the offline refresh token
 * (gmail.modify scope) — independent from the separate mcp/gmail container,
 * which only serves Claude.ai.
 */
export default class Gmail {
  private gmail: gmail_v1.Gmail | null = null

  public static businessEmail(): string {
    return (Env.get('BUSINESS_EMAIL') || DEFAULT_BUSINESS_EMAIL).toLowerCase()
  }

  private client(): gmail_v1.Gmail {
    if (this.gmail) return this.gmail
    const clientId = Env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Env.get('GOOGLE_CLIENT_SECRET')
    const refreshToken = Env.get('GMAIL_REFRESH_TOKEN')
    if (!refreshToken) {
      throw new Error('GMAIL_REFRESH_TOKEN is not set — email channel is not configured')
    }
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
    oauth2.setCredentials({ refresh_token: refreshToken })
    this.gmail = google.gmail({ version: 'v1', auth: oauth2 })
    return this.gmail
  }

  // ---------------------------------------------------------------------------
  // Profile / watch
  // ---------------------------------------------------------------------------

  public async getProfile(): Promise<{
    emailAddress: string | null
    historyId: string | null
    messagesTotal: number
  }> {
    const res = await this.client().users.getProfile({ userId: 'me' })
    return {
      emailAddress: res.data.emailAddress ?? null,
      historyId: res.data.historyId != null ? String(res.data.historyId) : null,
      messagesTotal: res.data.messagesTotal ?? 0,
    }
  }

  /**
   * (Re)arm push notifications for new INBOX mail to the configured Pub/Sub
   * topic. Returns the baseline historyId + expiration (epoch ms, ~7 days).
   */
  public async watch(): Promise<{ historyId: string | null; expiration: number | null }> {
    const topicName = Env.get('GMAIL_PUBSUB_TOPIC')
    if (!topicName) throw new Error('GMAIL_PUBSUB_TOPIC is not set — cannot start gmail.watch')
    const res = await this.client().users.watch({
      userId: 'me',
      requestBody: { topicName, labelIds: ['INBOX'], labelFilterBehavior: 'INCLUDE' },
    })
    return {
      historyId: res.data.historyId != null ? String(res.data.historyId) : null,
      expiration: res.data.expiration != null ? Number(res.data.expiration) : null,
    }
  }

  public async stopWatch(): Promise<void> {
    await this.client().users.stop({ userId: 'me' })
  }

  // ---------------------------------------------------------------------------
  // Reading
  // ---------------------------------------------------------------------------

  /**
   * Return the ids of INBOX messages ADDED since `startHistoryId`. Skips our
   * own SENT mail and drafts. Throws if the startHistoryId is too old/expired
   * (Gmail returns 404) — the caller should then re-baseline.
   */
  public async historyMessageIdsAdded(
    startHistoryId: string
  ): Promise<{ ids: string[]; latestHistoryId: string | null }> {
    const ids = new Set<string>()
    let pageToken: string | undefined
    let latestHistoryId: string | null = null
    do {
      const res = await this.client().users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX',
        ...(pageToken ? { pageToken } : {}),
      })
      if (res.data.historyId != null) latestHistoryId = String(res.data.historyId)
      for (const h of res.data.history ?? []) {
        for (const added of h.messagesAdded ?? []) {
          const m = added.message
          if (!m?.id) continue
          const labels = m.labelIds ?? []
          if (labels.includes('SENT') || labels.includes('DRAFT')) continue
          ids.add(m.id)
        }
      }
      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)
    return { ids: [...ids], latestHistoryId }
  }

  public async getMessage(id: string): Promise<ParsedEmail> {
    const res = await this.client().users.messages.get({ userId: 'me', id, format: 'full' })
    const payload = res.data.payload ?? undefined
    const headers = this.headerMap(payload?.headers ?? [])
    const from = headers['from'] ?? ''
    const addr = this.parseAddress(from)
    const rawBody = this.extractBody(payload)
    return {
      gmailMessageId: res.data.id ?? id,
      threadId: res.data.threadId ?? id,
      rfcMessageId: headers['message-id'] ?? null,
      from,
      fromEmail: addr.email,
      fromName: addr.name,
      to: headers['to'] ?? null,
      subject: headers['subject'] ?? '(sans objet)',
      body: this.cleanBody(rawBody),
      references: headers['references'] ?? null,
      internalDate: res.data.internalDate != null ? Number(res.data.internalDate) : null,
      labelIds: res.data.labelIds ?? [],
    }
  }

  /** Search the Sent folder (e.g. to surface prior pricing/templates). */
  public async searchSentMail(query: string, maxResults = 5): Promise<ParsedEmail[]> {
    const res = await this.client().users.messages.list({
      userId: 'me',
      q: `in:sent ${query}`.trim(),
      maxResults,
    })
    const out: ParsedEmail[] = []
    for (const m of res.data.messages ?? []) {
      if (m.id) out.push(await this.getMessage(m.id))
    }
    return out
  }

  // ---------------------------------------------------------------------------
  // Labels
  // ---------------------------------------------------------------------------

  public async getOrCreateLabel(name: string): Promise<string> {
    const list = await this.client().users.labels.list({ userId: 'me' })
    const found = (list.data.labels ?? []).find((l) => l.name === name)
    if (found?.id) return found.id
    const created = await this.client().users.labels.create({
      userId: 'me',
      requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
    })
    return created.data.id!
  }

  public async modifyLabels(
    messageId: string,
    addLabelIds: string[],
    removeLabelIds: string[] = []
  ): Promise<void> {
    await this.client().users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds, removeLabelIds },
    })
  }

  // ---------------------------------------------------------------------------
  // Writing (drafts)
  // ---------------------------------------------------------------------------

  /**
   * Create a Gmail DRAFT reply (draft-first phase — never auto-sends). When a
   * threadId is provided plus In-Reply-To/References, Gmail keeps the draft in
   * the original conversation.
   */
  public async createDraft(opts: {
    to: string
    subject: string
    htmlBody: string
    threadId?: string
    inReplyTo?: string | null
    references?: string | null
  }): Promise<{ draftId: string | null; messageId: string | null }> {
    const mime = this.buildMime(opts)
    const raw = this.encodeBase64Url(mime)
    const message: gmail_v1.Schema$Message = { raw }
    if (opts.threadId) message.threadId = opts.threadId
    const res = await this.client().users.drafts.create({
      userId: 'me',
      requestBody: { message },
    })
    return { draftId: res.data.id ?? null, messageId: res.data.message?.id ?? null }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildMime(opts: {
    to: string
    subject: string
    htmlBody: string
    inReplyTo?: string | null
    references?: string | null
  }): string {
    const headers = [
      `From: ${Gmail.businessEmail()}`,
      `To: ${opts.to}`,
      `Subject: ${this.encodeHeaderWord(opts.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
    ]
    if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`)
    const refs = [opts.references, opts.inReplyTo].filter(Boolean).join(' ').trim()
    if (refs) headers.push(`References: ${refs}`)
    return [headers.join('\r\n'), '', Buffer.from(opts.htmlBody, 'utf8').toString('base64')].join(
      '\r\n'
    )
  }

  /** RFC 2047 encoded-word so non-ASCII subjects survive. */
  private encodeHeaderWord(value: string): string {
    return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
  }

  private encodeBase64Url(str: string): string {
    return Buffer.from(str, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

  private decodeBase64Url(data: string): string {
    return Buffer.from(data, 'base64url').toString('utf8')
  }

  private headerMap(headers: gmail_v1.Schema$MessagePartHeader[]): Record<string, string> {
    const map: Record<string, string> = {}
    for (const h of headers) {
      if (h.name) map[h.name.toLowerCase()] = h.value ?? ''
    }
    return map
  }

  private parseAddress(raw: string): { name: string | null; email: string } {
    const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
    if (m) {
      const name = m[1].replace(/^"|"$/g, '').trim()
      return { name: name || null, email: m[2].trim().toLowerCase() }
    }
    return { name: null, email: raw.trim().toLowerCase() }
  }

  /** Prefer text/plain anywhere in the MIME tree; fall back to stripped HTML. */
  private extractBody(payload?: gmail_v1.Schema$MessagePart): string {
    if (!payload) return ''
    const plain = this.findPart(payload, 'text/plain')
    if (plain) return plain
    const html = this.findPart(payload, 'text/html')
    if (html) return this.htmlToText(html)
    return ''
  }

  private findPart(node: gmail_v1.Schema$MessagePart, mime: string): string | null {
    if (node.mimeType === mime && node.body?.data) {
      return this.decodeBase64Url(node.body.data)
    }
    for (const part of node.parts ?? []) {
      const found = this.findPart(part, mime)
      if (found) return found
    }
    return null
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/ /g, ' ')
  }

  /**
   * Trim quoted reply history and obvious separators so the agent only sees the
   * customer's actual new message. Best-effort for FR + EN clients.
   */
  private cleanBody(text: string): string {
    if (!text) return ''
    let s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    const separators: RegExp[] = [
      /^On .+ wrote:\s*$/m, // Gmail EN
      /^Le .+ a écrit\s*:\s*$/m, // Gmail FR
      /^-{2,}\s*Original Message\s*-{2,}/im, // Outlook EN
      /^_{10,}\s*$/m, // Outlook divider
      /^De\s*:\s.+$/m, // Outlook FR header block
      /^From:\s.+$/m, // Outlook EN header block
      /^Envoyé\s*:\s.+$/m,
    ]
    let cut = s.length
    for (const re of separators) {
      const m = s.match(re)
      if (m && m.index != null && m.index < cut) cut = m.index
    }
    s = s.slice(0, cut)

    // Drop trailing quoted (">") lines.
    s = s
      .split('\n')
      .filter((line) => !/^\s*>/.test(line))
      .join('\n')

    return s.replace(/\n{3,}/g, '\n\n').trim()
  }
}
