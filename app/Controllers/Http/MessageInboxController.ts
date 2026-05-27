import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import crypto from 'crypto'
import Env from '@ioc:Adonis/Core/Env'
import InboxMessage, { InboxChannel } from 'App/Models/InboxMessage'

// Meta webhook payload structure.
//
// Two delivery shapes for the same logical event depending on the underlying
// auth/product:
//   - Messenger (Page-based, `object: "page"`): events under `entry[].messaging[]`.
//   - Instagram Login (`object: "instagram"`): events under `entry[].changes[]`
//     as `{ field: "messages", value: <same shape as messaging entry> }`.
// We normalize both into MetaMessagingEvent below.
interface MetaMessagingEvent {
  sender?: { id?: string }
  recipient?: { id?: string }
  timestamp?: number
  message?: {
    mid?: string
    text?: string
    is_echo?: boolean
    attachments?: any[]
  }
}

interface MetaWebhookChange {
  field?: string
  value?: MetaMessagingEvent
}

interface MetaWebhookEntry {
  id?: string
  time?: number
  messaging?: MetaMessagingEvent[]
  changes?: MetaWebhookChange[]
}

interface MetaWebhookPayload {
  object?: string
  entry?: MetaWebhookEntry[]
}

export default class MessageInboxController {
  /**
   * GET /webhooks/meta
   *
   * Meta subscription handshake. Returns hub.challenge as plain text when
   * the verify token matches the one configured on the Meta App side.
   */
  public async verify({ request, response }: HttpContextContract) {
    const qs = request.qs()
    const mode = qs['hub.mode']
    const token = qs['hub.verify_token']
    const challenge = qs['hub.challenge']

    if (mode === 'subscribe' && token === Env.get('META_VERIFY_TOKEN')) {
      return response.status(200).send(challenge)
    }

    return response.status(403).send('forbidden')
  }

  /**
   * POST /webhooks/meta
   *
   * Verifies signature, persists each messaging event into `inbox_messages`
   * with idempotence on (channel, external_message_id), then ACKs Meta
   * within milliseconds. Actual reply generation runs async (Phase 1).
   */
  public async receive({ request, response }: HttpContextContract) {
    const rawBody = (await request.raw()) ?? ''

    const isAuthentic = this.verifySignature(request, rawBody)
    if (!isAuthentic && Env.get('NODE_ENV') !== 'development') {
      console.warn('🚫 Invalid Meta webhook signature')
      return response.unauthorized({ error: 'invalid signature' })
    }

    let payload: MetaWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      console.warn('🚫 Meta webhook: invalid JSON body')
      return response.status(200).send({ ok: true })
    }

    const channel = this.resolveChannel(payload.object)
    if (!channel) {
      return response.status(200).send({ ok: true })
    }

    const persisted: number[] = []
    const events = this.collectEvents(payload)

    if (events.length === 0) {
      console.info(
        `ℹ️  Meta webhook received with no extractable events. object=${payload.object} ` +
          `entries=${payload.entry?.length ?? 0} body=${rawBody.slice(0, 500)}`
      )
    }

    for (const event of events) {
      const saved = await this.persistEvent(channel, event)
      if (saved) persisted.push(saved)
    }

    response.status(200).send({ ok: true })

    // Fire-and-forget: trigger async processing for each new message.
    // Wired in Phase 1 — kept as a log so we can see the inbox filling up.
    setImmediate(() => {
      for (const id of persisted) {
        console.info(`📥 inbox_messages id=${id} queued (processor not wired yet — Phase 1)`)
      }
    })

    return
  }

  /**
   * Flatten the two possible delivery shapes into a single list of messaging
   * events. Messenger uses `entry[].messaging[]`. Instagram Login uses
   * `entry[].changes[]` where each change of `field: messages` has a `value`
   * whose shape matches a messaging entry.
   */
  private collectEvents(payload: MetaWebhookPayload): MetaMessagingEvent[] {
    const out: MetaMessagingEvent[] = []
    for (const entry of payload.entry ?? []) {
      for (const event of entry.messaging ?? []) out.push(event)
      for (const change of entry.changes ?? []) {
        if (change.field === 'messages' && change.value) out.push(change.value)
      }
    }
    return out
  }

  /**
   * INSERT-OR-IGNORE on (channel, external_message_id). Skips:
   *   - echo messages (our own outgoing replies bouncing back)
   *   - events without a message id
   *
   * The 24h Meta reply-window check lives in the Phase 1 processor, not here —
   * we want a complete audit trail at the ingestion layer.
   */
  private async persistEvent(
    channel: InboxChannel,
    event: MetaMessagingEvent
  ): Promise<number | null> {
    const message = event.message
    if (!message?.mid) return null
    if (message.is_echo === true) return null

    const externalMessageId = message.mid
    const externalUserId = event.sender?.id ?? null
    const externalThreadId = externalUserId

    try {
      const existing = await InboxMessage.query()
        .where('channel', channel)
        .where('external_message_id', externalMessageId)
        .first()

      if (existing) return null

      const row = await InboxMessage.create({
        channel,
        externalMessageId,
        externalThreadId,
        externalUserId,
        rawPayload: event as any,
        status: 'pending',
        attempts: 0,
      })

      return row.id
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') return null
      console.error(`Failed to persist inbox message ${externalMessageId}:`, error?.message)
      return null
    }
  }

  private resolveChannel(metaObject: string | undefined): InboxChannel | null {
    if (metaObject === 'instagram') return 'instagram'
    if (metaObject === 'page') return 'messenger'
    return null
  }

  /**
   * Meta uses HMAC SHA256 of the raw request body keyed by the App Secret.
   * Header: `X-Hub-Signature-256: sha256=<hex>`.
   */
  private verifySignature(request: HttpContextContract['request'], rawBody: string): boolean {
    try {
      const header = request.header('X-Hub-Signature-256')
      if (!header) return false

      const [scheme, providedHash] = header.split('=')
      if (scheme !== 'sha256' || !providedHash) return false

      const expectedHash = crypto
        .createHmac('sha256', Env.get('INSTAGRAM_APP_SECRET'))
        .update(rawBody, 'utf-8')
        .digest('hex')

      const a = Buffer.from(expectedHash, 'hex')
      const b = Buffer.from(providedHash, 'hex')
      if (a.length !== b.length) return false
      return crypto.timingSafeEqual(new Uint8Array(a), new Uint8Array(b))
    } catch (error) {
      console.error('Error verifying Meta signature:', error)
      return false
    }
  }
}
