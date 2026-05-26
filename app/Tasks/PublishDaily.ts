import { BaseTask } from 'adonis5-scheduler/build/src/Scheduler/Task'
import DailyPublication from 'App/Services/DailyPublication'
import { logTaskBoundary } from 'App/Utils/Logs'

// Day-of-week (0=Sun..6=Sat) → publication hours in Europe/Paris.
// adonis5-scheduler passes the cron string straight to node-schedule with no
// timezone option, so the cron fires in server local time. We fire hourly at
// :30 and gate inside handle() using Paris-anchored time — robust to any
// server timezone (UTC, Paris, or whatever the host decides).
const PUBLISH_HOURS_BY_DAY: Record<number, number[]> = {
  0: [10, 17, 20],
  1: [8, 12, 18],
  2: [8, 12, 18],
  3: [8, 12, 18],
  4: [8, 12, 18],
  5: [8, 12, 18],
  6: [10, 14, 20],
}

const PARIS_WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function parisDayAndHour(): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const weekday = parts.find((p) => p.type === 'weekday')!.value
  const hourRaw = Number(parts.find((p) => p.type === 'hour')!.value)
  return { day: PARIS_WEEKDAY[weekday], hour: hourRaw === 24 ? 0 : hourRaw }
}

export default class PublishDaily extends BaseTask {
  public static get schedule() {
    return '30 * * * *'
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    const { day, hour } = parisDayAndHour()
    if (!PUBLISH_HOURS_BY_DAY[day].includes(hour)) return

    try {
      logTaskBoundary(true, 'Publish Daily (Pinterest + IG chain)')

      const dailyPublication = new DailyPublication()
      await dailyPublication.run()

      console.log('============================')
      console.log('✅ Daily publication tick done')
    } catch (error) {
      console.log('❌ Daily publication failed:', error?.message || error)
    } finally {
      logTaskBoundary(false, 'Publish Daily (Pinterest + IG chain)')
    }
  }
}
