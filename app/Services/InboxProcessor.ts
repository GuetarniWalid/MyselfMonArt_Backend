import { DateTime } from 'luxon'
import Database from '@ioc:Adonis/Lucid/Database'
import InboxMessage from 'App/Models/InboxMessage'
import Conversation, { ConversationChannel } from 'App/Models/Conversation'
import ConversationMessage from 'App/Models/ConversationMessage'
import ConversationAgent from './ConversationAgent'
import MetaReplySender from './MetaReplySender'
import EscalationMailer from './EscalationMailer'
import IgAuthentication from './Instagram/Authentication'

const MAX_ATTEMPTS = 3
const REPLY_WINDOW_HOURS = 24
const HISTORY_LOAD = 24
const MAIL_TIMEOUT_MS = 15000
const MAX_REPLIES_PER_USER_24H = 5

export default class InboxProcessor {
  private static cachedSelfIgId: string | null = null

  /**
   * Process a single inbox_messages row. Idempotent and safe to call from
   * multiple call sites — uses an optimistic-lock UPDATE to claim the row.
   * If the row is already processing/replied/escalated/skipped, returns
   * without doing work.
   */
  public async process(inboxId: number): Promise<void> {
    const claimed = await this.claim(inboxId)
    if (!claimed) return

    let inbox: InboxMessage | null = null
    try {
      inbox = await InboxMessage.find(inboxId)
      if (!inbox) return

      const text = this.extractText(inbox)
      if (!text) {
        await this.finalize(inbox, 'skipped', 'no text content (likely attachment-only message)')
        return
      }

      if (await this.isOwnMessage(inbox)) {
        await this.finalize(inbox, 'skipped', 'message from our own account (self-loop)')
        return
      }

      if (this.isOutsideReplyWindow(inbox)) {
        await this.finalize(inbox, 'skipped', `outside ${REPLY_WINDOW_HOURS}h reply window`)
        return
      }

      const conversation = await this.getOrCreateConversation(inbox)

      // Hard cap: at most MAX_REPLIES_PER_USER_24H auto-replies to the same
      // conversation per rolling 24h. Protects against runaway Claude cost and
      // spam loops. Over the cap we skip silently (no Claude call, no reply).
      if (await this.isOverReplyCap(conversation.id)) {
        await this.finalize(
          inbox,
          'skipped',
          `rate limit: ${MAX_REPLIES_PER_USER_24H} replies/24h reached`
        )
        return
      }

      // Persist the incoming user turn first so the history table is the
      // source of truth even if the agent crashes later.
      await ConversationMessage.create({
        conversationId: conversation.id,
        role: 'user',
        content: text,
        externalMessageId: inbox.externalMessageId,
      })

      const history = await ConversationMessage.query()
        .where('conversation_id', conversation.id)
        .orderBy('created_at', 'asc')
        .limit(HISTORY_LOAD)

      const agent = new ConversationAgent()
      const result = await agent.respond(conversation, text, history.slice(0, -1))
      // (the user turn we just inserted is excluded from the history slice;
      //  ConversationAgent.buildHistory will append it as the current user input)

      // Reload conversation to see if a tool escalated it
      await conversation.refresh()

      // Always send something back. If the agent produced no text (e.g. it
      // stayed in tool-use mode), fall back to a safe, on-brand message so the
      // customer is never left without a reply.
      const replyText =
        result.replyText && result.replyText.trim().length > 0
          ? result.replyText
          : 'Merci pour ton message ✨ Je transmets ça à l’équipe et on revient vers toi très vite !'

      {
        await ConversationMessage.create({
          conversationId: conversation.id,
          role: 'assistant',
          content: replyText,
          toolCalls: result.toolCalls,
          costCents: this.estimateCostCents(result.tokensIn, result.tokensOut),
        })

        try {
          const sender = new MetaReplySender()
          const sendResult = await sender.send(
            inbox.channel as any,
            inbox.externalUserId!,
            replyText
          )
          console.info(
            `📤 Replied to ${inbox.channel} user=${inbox.externalUserId} ` +
              `inbox=${inbox.id} msg=${sendResult.messageId ?? '?'}`
          )

          // Follow the text with a product-card carousel when the agent chose
          // to present products. Non-fatal: a card-send failure must not flip
          // the inbox to 'failed' since the text reply already went out.
          if (result.cards && result.cards.length > 0) {
            try {
              const cardResult = await sender.sendProductCards(
                inbox.channel as any,
                inbox.externalUserId!,
                result.cards
              )
              console.info(
                `🛍️  Sent ${result.cards.length} product card(s) to inbox=${inbox.id} ` +
                  `msg=${cardResult.messageId ?? '?'}`
              )
            } catch (cardErr: any) {
              console.error(
                `⚠️  Product cards send failed for inbox=${inbox.id}:`,
                cardErr?.message
              )
            }
          }
        } catch (sendErr: any) {
          console.error(`❌ Send reply failed for inbox=${inbox.id}:`, sendErr?.message)
          await this.finalize(inbox, 'failed', `send error: ${sendErr?.message}`)
          // best-effort escalation notice even when the reply failed to send
          await this.notifyEscalationIfNeeded(conversation, replyText)
          return
        }
      }

      // Finalize the inbox status NOW — immediately after a successful send.
      // The escalation email is a non-critical side effect: it must never be
      // able to block finalization or, worse, leave the row in 'processing'
      // where the sweep cron would reprocess it and double-send the reply.
      const terminalStatus = conversation.status === 'escalated' ? 'escalated' : 'replied'
      await this.finalize(
        inbox,
        terminalStatus,
        terminalStatus === 'escalated' ? conversation.escalationReason ?? null : null
      )

      await this.notifyEscalationIfNeeded(conversation, result.replyText)
    } catch (err: any) {
      console.error(`❌ InboxProcessor failed for id=${inboxId}:`, err?.message ?? err)
      if (inbox) await this.handleFailure(inbox, err?.message ?? String(err))
    }
  }

  /**
   * Atomic claim: UPDATE … SET status='processing' WHERE id=? AND status IN ('pending','failed').
   * Returns true if we got the lock.
   */
  private async claim(inboxId: number): Promise<boolean> {
    const result = (await Database.from('inbox_messages')
      .where('id', inboxId)
      .whereIn('status', ['pending', 'failed'])
      .update({ status: 'processing', updated_at: new Date() })) as unknown as number
    return Number(result) > 0
  }

  private async finalize(
    inbox: InboxMessage,
    status: 'replied' | 'escalated' | 'failed' | 'skipped',
    note: string | null
  ): Promise<void> {
    inbox.status = status
    inbox.processedAt = DateTime.now()
    if (note) inbox.lastError = note
    await inbox.save()
  }

  private async handleFailure(inbox: InboxMessage, error: string): Promise<void> {
    inbox.attempts = (inbox.attempts ?? 0) + 1
    inbox.lastError = error.slice(0, 1000)
    if (inbox.attempts >= MAX_ATTEMPTS) {
      inbox.status = 'failed'
      inbox.processedAt = DateTime.now()
    } else {
      inbox.status = 'pending' // let the sweep cron retry later
    }
    await inbox.save()
  }

  /**
   * True if we've already sent MAX_REPLIES_PER_USER_24H assistant replies in
   * this conversation within the last rolling 24h. One conversation == one
   * (channel, external_thread_id) == one user, so this is effectively a
   * per-user daily reply cap.
   */
  private async isOverReplyCap(conversationId: number): Promise<boolean> {
    const since = DateTime.now().minus({ hours: 24 })
    const result = await Database.from('conversation_messages')
      .where('conversation_id', conversationId)
      .where('role', 'assistant')
      .where('created_at', '>=', since.toSQL()!)
      .count('* as total')
    const total = Number((result[0] as any)?.total ?? 0)
    return total >= MAX_REPLIES_PER_USER_24H
  }

  private extractText(inbox: InboxMessage): string | null {
    const payload = inbox.rawPayload as any
    const text = payload?.message?.text
    if (typeof text === 'string' && text.trim().length > 0) return text.trim()
    return null
  }

  private async isOwnMessage(inbox: InboxMessage): Promise<boolean> {
    if (inbox.channel !== 'instagram') return false
    try {
      if (!InboxProcessor.cachedSelfIgId) {
        const ig = new (class extends IgAuthentication {
          public async fetchSelfId() {
            return this.getInstagramUserId()
          }
        })()
        InboxProcessor.cachedSelfIgId = await ig.fetchSelfId()
      }
      return inbox.externalUserId === InboxProcessor.cachedSelfIgId
    } catch {
      return false
    }
  }

  private isOutsideReplyWindow(inbox: InboxMessage): boolean {
    const ts = (inbox.rawPayload as any)?.timestamp
    if (!ts) return false
    const ageMs = Date.now() - Number(ts)
    return ageMs > REPLY_WINDOW_HOURS * 3600 * 1000
  }

  private async getOrCreateConversation(inbox: InboxMessage): Promise<Conversation> {
    const channel = inbox.channel as ConversationChannel
    const threadId = inbox.externalThreadId ?? inbox.externalUserId!
    const existing = await Conversation.query()
      .where('channel', channel)
      .where('external_thread_id', threadId)
      .first()

    if (existing) {
      existing.lastMessageAt = DateTime.now()
      await existing.save()
      return existing
    }

    return await Conversation.create({
      channel,
      externalUserId: inbox.externalUserId!,
      externalThreadId: threadId,
      status: 'active',
      lastMessageAt: DateTime.now(),
    })
  }

  /**
   * Fire the escalation email only when the conversation is escalated.
   * Time-boxed and fully swallowed: a slow or unreachable SMTP server must
   * never hang the worker or affect the already-finalized inbox row.
   */
  private async notifyEscalationIfNeeded(
    conversation: Conversation,
    finalReplyText: string | null
  ): Promise<void> {
    if (conversation.status !== 'escalated') return
    try {
      const history = await ConversationMessage.query()
        .where('conversation_id', conversation.id)
        .orderBy('created_at', 'asc')
      const mailer = new EscalationMailer()
      await this.withTimeout(
        mailer.send(conversation, history, finalReplyText),
        MAIL_TIMEOUT_MS,
        'escalation email'
      )
      console.info(`✉️  Escalation email sent for conversation=${conversation.id}`)
    } catch (err: any) {
      console.error(`❌ EscalationMailer failed for conversation=${conversation.id}:`, err?.message)
    }
  }

  private withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ])
  }

  /**
   * Sonnet 4.6 pricing (Mar 2026): $3/Mtok in, $15/Mtok out.
   * Returned in cents (USD). Approximate.
   */
  private estimateCostCents(tokensIn: number, tokensOut: number): number {
    const usd = (tokensIn / 1_000_000) * 3 + (tokensOut / 1_000_000) * 15
    return Math.round(usd * 100)
  }
}
