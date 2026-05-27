import { BaseTask } from 'adonis5-scheduler/build/src/Scheduler/Task'
import { DateTime } from 'luxon'
import InboxMessage from 'App/Models/InboxMessage'
import InboxProcessor from 'App/Services/InboxProcessor'

const BATCH_SIZE = 5
const STUCK_PROCESSING_AGE_MIN = 5

/**
 * Safety net for the inbox pipeline. The webhook controller triggers
 * processing immediately on receipt, but if Node was down at the time or the
 * processor crashed mid-flight, the row stays in 'pending' or gets stuck in
 * 'processing'. This task sweeps both states every 5 minutes.
 */
export default class SweepInbox extends BaseTask {
  public static get schedule() {
    return '*/5 * * * *'
  }

  public static get useLock() {
    return true
  }

  public async handle() {
    // Reclaim rows stuck in 'processing' beyond the threshold.
    const stuckCutoff = DateTime.now().minus({ minutes: STUCK_PROCESSING_AGE_MIN })
    const stuck = await InboxMessage.query()
      .where('status', 'processing')
      .where('updated_at', '<', stuckCutoff.toSQL()!)
      .limit(BATCH_SIZE)
    for (const row of stuck) {
      row.status = 'pending'
      await row.save()
      console.warn(
        `🔁 SweepInbox: reset stuck inbox=${row.id} (was processing >${STUCK_PROCESSING_AGE_MIN}min)`
      )
    }

    // Process pending rows the controller didn't get to.
    const pending = await InboxMessage.query()
      .where('status', 'pending')
      .orderBy('created_at', 'asc')
      .limit(BATCH_SIZE)

    if (pending.length === 0) return

    console.info(`📬 SweepInbox: processing ${pending.length} pending message(s)`)
    const processor = new InboxProcessor()
    for (const row of pending) {
      try {
        await processor.process(row.id)
      } catch (err: any) {
        console.error(`❌ SweepInbox crash on inbox=${row.id}:`, err?.message ?? err)
      }
    }
  }
}
