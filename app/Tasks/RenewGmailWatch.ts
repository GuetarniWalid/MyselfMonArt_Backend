import { BaseTask } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Env from '@ioc:Adonis/Core/Env'
import Gmail from 'App/Services/Gmail'
import GmailSyncState from 'App/Models/GmailSyncState'

/**
 * Re-arms the Gmail push registration (users.watch) daily. A watch lapses after
 * ~7 days, so renewing every day keeps push notifications flowing with wide
 * margin. No-op until the email channel is enabled and Pub/Sub is configured.
 */
export default class RenewGmailWatch extends BaseTask {
  public static get schedule() {
    return '0 6 * * *' // every day at 06:00
  }

  public static get useLock() {
    return true
  }

  public async handle() {
    if (!Env.get('EMAIL_CHANNEL_ENABLED')) return
    if (!Env.get('GMAIL_REFRESH_TOKEN') || !Env.get('GMAIL_PUBSUB_TOPIC')) {
      console.warn('⏭️  RenewGmailWatch skipped: GMAIL_REFRESH_TOKEN / GMAIL_PUBSUB_TOPIC missing')
      return
    }

    const gmail = new Gmail()
    const res = await gmail.watch()
    const state = await GmailSyncState.singleton()
    if (!state.lastHistoryId && res.historyId) state.lastHistoryId = res.historyId
    state.watchExpiration = res.expiration
    if (!state.emailAddress) {
      const profile = await gmail.getProfile().catch(() => null)
      if (profile?.emailAddress) state.emailAddress = profile.emailAddress
    }
    await state.save()
    console.info(`🔔 Gmail watch renewed (expires=${res.expiration}, historyId=${res.historyId})`)
  }
}
