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

      if (result.replyText) {
        await ConversationMessage.create({
          conversationId: conversation.id,
          role: 'assistant',
          content: result.replyText,
          toolCalls: result.toolCalls,
          costCents: this.estimateCostCents(result.tokensIn, result.tokensOut),
        })

        try {
          const sender = new MetaReplySender()
          const sendResult = await sender.send(
            inbox.channel as any,
            inbox.externalUserId!,
            result.replyText
          )
          console.info(
            `📤 Replied to ${inbox.channel} user=${inbox.externalUserId} ` +
              `inbox=${inbox.id} msg=${sendResult.messageId ?? '?'}`
          )
        } catch (sendErr: any) {
          console.error(`❌ Send reply failed for inbox=${inbox.id}:`, sendErr?.message)
          await this.finalize(inbox, 'failed', `send error: ${sendErr?.message}`)
          if (conversation.status === 'escalated') {
            await this.notifyEscalation(conversation, result.replyText)
          }
          return
        }
      }

      if (conversation.status === 'escalated') {
        await this.notifyEscalation(conversation, result.replyText)
        await this.finalize(inbox, 'escalated', conversation.escalationReason ?? null)
        return
      }

      await this.finalize(inbox, 'replied', null)
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

  private async notifyEscalation(
    conversation: Conversation,
    finalReplyText: string | null
  ): Promise<void> {
    try {
      const history = await ConversationMessage.query()
        .where('conversation_id', conversation.id)
        .orderBy('created_at', 'asc')
      const mailer = new EscalationMailer()
      await mailer.send(conversation, history, finalReplyText)
    } catch (err: any) {
      console.error(`❌ EscalationMailer failed for conversation=${conversation.id}:`, err?.message)
    }
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
