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

      // Flagged-spam conversations are a STICKY block: once the agent decided
      // a thread is commercial solicitation / a bot / pointless, we stop
      // engaging entirely — skip BEFORE any Claude call so it costs nothing.
      if ((conversation.metadata as any)?.blocked === true) {
        await this.finalize(inbox, 'skipped', 'blocked: flagged as spam/solicitation')
        return
      }

      // Escalation is evaluated PER MESSAGE, not as a sticky conversation flag.
      // Reset any prior escalation so a single past legal-threat message doesn't
      // keep marking every later (normal) message as escalated and re-emailing.
      // escalateToHuman will re-set 'escalated' only if THIS message warrants it.
      // (We preserve metadata.blocked — only the escalation fields are cleared.)
      if (conversation.status === 'escalated') {
        conversation.status = 'active'
        conversation.escalatedAt = null
        conversation.escalationReason = null
        const meta = conversation.metadata ?? {}
        delete (meta as any).escalation_summary
        conversation.metadata = meta
        await conversation.save()
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

      // Reload conversation to see if a tool escalated or flagged it
      await conversation.refresh()

      // If the agent flagged this conversation as spam/solicitation during the
      // run, send NOTHING — we stop engaging. Future messages are skipped
      // upfront by the blocked check above.
      if ((conversation.metadata as any)?.blocked === true) {
        const reason = (conversation.metadata as any)?.blocked_reason ?? 'spam'
        await this.finalize(inbox, 'skipped', `flagged during run: ${reason}`)
        console.info(`🚫 Flagged conversation=${conversation.id} (${reason}) — no reply sent`)
        return
      }

      // Always send something back. If the agent produced no text (e.g. it
      // stayed in tool-use mode), fall back to a safe, on-brand message so the
      // customer is never left without a reply.
      const replyText =
        result.replyText && result.replyText.trim().length > 0
          ? result.replyText
          : 'Je transmets votre demande à notre équipe, qui revient vers vous au plus vite.'

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

          // Follow with a CTA button card (e.g. order tracking) if the agent
          // set one. Non-fatal, like product cards.
          if (result.cta) {
            try {
              await sender.sendCtaButton(inbox.channel as any, inbox.externalUserId!, result.cta)
              console.info(`🔘 Sent CTA button "${result.cta.buttonLabel}" to inbox=${inbox.id}`)
            } catch (ctaErr: any) {
              console.error(`⚠️  CTA button send failed for inbox=${inbox.id}:`, ctaErr?.message)
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
      // Cast: TS narrowed status to 'active' from the reset assignment above,
      // but escalateToHuman may have flipped it during the agent run (reloaded
      // via conversation.refresh()).
      const escalatedNow = (conversation.status as string) === 'escalated'
      const terminalStatus = escalatedNow ? 'escalated' : 'replied'
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
