import Gmail, { ParsedEmail } from 'App/Services/Gmail'
import GmailSyncState from 'App/Models/GmailSyncState'
import InboxMessage from 'App/Models/InboxMessage'
import InboxProcessor from 'App/Services/InboxProcessor'

/**
 * Pulls new INBOX emails into inbox_messages using Gmail's incremental history
 * API, then kicks the shared InboxProcessor for each. Called by the Pub/Sub
 * webhook (instant) and by a poll fallback task. Idempotent and backlog-safe:
 * the first run only baselines the cursor and never floods on the existing
 * mailbox; subsequent runs process only messages added since.
 */
export default class EmailIngestion {
  private gmail = new Gmail()

  public async sync(): Promise<{ ingested: number }> {
    const state = await GmailSyncState.singleton()

    // First run (or after a stop): baseline the cursor, skip the backlog.
    if (!state.lastHistoryId) {
      const profile = await this.gmail.getProfile()
      state.lastHistoryId = profile.historyId
      state.emailAddress = profile.emailAddress
      await state.save()
      console.info(
        `📭 Gmail sync baselined at historyId=${profile.historyId} (no backlog processed)`
      )
      return { ingested: 0 }
    }

    let added: { ids: string[]; latestHistoryId: string | null }
    try {
      added = await this.gmail.historyMessageIdsAdded(state.lastHistoryId)
    } catch (err: any) {
      // 404 = startHistoryId too old/expired → re-baseline and skip backlog.
      const status = err?.code ?? err?.response?.status
      if (status === 404) {
        const profile = await this.gmail.getProfile()
        state.lastHistoryId = profile.historyId
        await state.save()
        console.warn(`⚠️  Gmail historyId expired — re-baselined at ${profile.historyId}`)
        return { ingested: 0 }
      }
      throw err
    }

    const newInboxIds: number[] = []
    for (const id of added.ids) {
      try {
        const email = await this.gmail.getMessage(id)
        if (email.fromEmail === Gmail.businessEmail()) continue // never ingest our own mail
        const inboxId = await this.persist(email)
        if (inboxId) newInboxIds.push(inboxId)
      } catch (err: any) {
        console.error(`❌ Gmail ingest failed for message=${id}:`, err?.message ?? err)
      }
    }

    // Advance the cursor to where we read up to (only after fetching the batch).
    if (added.latestHistoryId) {
      state.lastHistoryId = added.latestHistoryId
      await state.save()
    }

    // Fire-and-forget processing; SweepInbox is the safety net if Node dies.
    if (newInboxIds.length) {
      const processor = new InboxProcessor()
      for (const inboxId of newInboxIds) {
        console.info(`📥 inbox_messages id=${inboxId} queued (email)`)
        processor
          .process(inboxId)
          .catch((e) =>
            console.error(
              `❌ Async email processing crashed for inbox=${inboxId}:`,
              e?.message ?? e
            )
          )
      }
    }

    return { ingested: newInboxIds.length }
  }

  private async persist(email: ParsedEmail): Promise<number | null> {
    const existing = await InboxMessage.query()
      .where('channel', 'email')
      .where('external_message_id', email.gmailMessageId)
      .first()
    if (existing) return null

    try {
      const row = await InboxMessage.create({
        channel: 'email',
        externalMessageId: email.gmailMessageId,
        externalThreadId: email.threadId,
        externalUserId: email.fromEmail,
        rawPayload: {
          from: email.from,
          fromEmail: email.fromEmail,
          fromName: email.fromName,
          subject: email.subject,
          body: email.body,
          rfcMessageId: email.rfcMessageId,
          references: email.references,
          threadId: email.threadId,
          gmailMessageId: email.gmailMessageId,
          internalDate: email.internalDate,
        } as any,
        status: 'pending',
        attempts: 0,
      })
      return row.id
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') return null
      throw err
    }
  }
}
