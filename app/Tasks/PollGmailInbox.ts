import { BaseTask } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Env from '@ioc:Adonis/Core/Env'
import EmailIngestion from 'App/Services/EmailIngestion'

/**
 * Fallback poller for the email channel: pulls new mail via the Gmail history
 * cursor in case a Pub/Sub push was missed (or before push is configured).
 * Idempotent and backlog-safe (first run only baselines the cursor). No-op
 * until the channel is enabled.
 */
export default class PollGmailInbox extends BaseTask {
  public static get schedule() {
    return '*/10 * * * *' // every 10 minutes
  }

  public static get useLock() {
    return true
  }

  public async handle() {
    if (!Env.get('EMAIL_CHANNEL_ENABLED')) return
    if (!Env.get('GMAIL_REFRESH_TOKEN')) return

    const res = await new EmailIngestion().sync()
    if (res.ingested > 0) {
      console.info(`📬 Gmail poll fallback: ingested ${res.ingested} message(s)`)
    }
  }
}
