import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import EmailIngestion from 'App/Services/EmailIngestion'

/**
 * POST /webhooks/email
 *
 * Receives Gmail push notifications via a Google Pub/Sub push subscription.
 * The notification is only a trigger — we pull the actual new mail with the
 * stored historyId — so the body is not parsed. We ACK fast and sync async,
 * mirroring the Meta webhook pattern.
 *
 * The subscription's push endpoint must include `?token=<secret>` matching
 * GMAIL_PUBSUB_VERIFICATION_TOKEN.
 */
export default class EmailInboxController {
  public async receive({ request, response }: HttpContextContract) {
    // Dormant until the channel is explicitly enabled.
    if (!Env.get('EMAIL_CHANNEL_ENABLED')) {
      return response.status(204)
    }

    const token = request.qs().token
    const expected = Env.get('GMAIL_PUBSUB_VERIFICATION_TOKEN')
    if (expected && token !== expected && Env.get('NODE_ENV') !== 'development') {
      console.warn('🚫 Invalid Gmail Pub/Sub webhook token')
      return response.unauthorized({ error: 'invalid token' })
    }

    // ACK Pub/Sub immediately (2xx) so it doesn't retry; pull mail async.
    response.status(204)

    setImmediate(() => {
      new EmailIngestion()
        .sync()
        .then((r) => {
          if (r.ingested > 0) console.info(`📬 Gmail push: ingested ${r.ingested} message(s)`)
        })
        .catch((err) => console.error('❌ Gmail push sync failed:', err?.message ?? err))
    })

    return
  }
}
