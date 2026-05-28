import { BaseTask } from 'adonis5-scheduler/build/src/Scheduler/Task'
import InstagramPublication from 'App/Services/InstagramPublication'
import { logTaskBoundary } from 'App/Utils/Logs'

// Fire once a day at 18:00 Europe/Paris (strong evening engagement window).
// adonis5-scheduler passes the cron string straight to node-schedule with no
// timezone option, so the cron fires in server local time. We fire hourly at
// :30 and gate inside handle() using Paris-anchored time — robust to any
// server timezone (UTC, Paris, or whatever the host decides).
const PUBLISH_HOUR_PARIS = 18

function parisHour(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hourRaw = Number(parts.find((p) => p.type === 'hour')!.value)
  return hourRaw === 24 ? 0 : hourRaw
}

export default class PublishInstagramDaily extends BaseTask {
  public static get schedule() {
    return '30 * * * *'
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    if (parisHour() !== PUBLISH_HOUR_PARIS) return

    try {
      logTaskBoundary(true, 'Publish Instagram Daily')

      const instagramPublication = new InstagramPublication()
      await instagramPublication.run()

      console.log('============================')
      console.log('✅ Instagram publication tick done')
    } catch (error) {
      console.log('❌ Instagram publication failed:', error?.message || error)
    } finally {
      logTaskBoundary(false, 'Publish Instagram Daily')
    }
  }
}
