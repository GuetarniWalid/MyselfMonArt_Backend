import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'

/**
 * Daily safety net that re-creates missing variants on artworks left incomplete
 * by Shopify's daily variant-creation limit (1,000/day once a store passes 50,000
 * variants). When a burst publish exhausts the quota, the later products keep only
 * their default variant; this cron repairs them once the quota is available again.
 *
 * This is the single, persistent "retry later" mechanism. The in-process retry in
 * createVariantsBulkWithRetry now fails fast (it did not survive redeploys), so the
 * two never run a competing wait. The copy is differential, so a re-run never
 * creates a variant that already exists.
 */
export default class RepairIncompleteArtworks extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(4, 0)
  }

  // Avoid overlapping runs (a run can be long if there is a backlog)
  public static get useLock() {
    return true
  }

  // Safety cap; the daily variant limit stops us first anyway.
  private static readonly MAX_PER_RUN = 30

  public async handle() {
    logTaskBoundary(true, 'Repair incomplete artworks')
    const shopify = new Shopify()

    try {
      const incomplete = await shopify.product.getIncompleteArtworks()
      console.info(`🩹 Found ${incomplete.length} incomplete artwork(s) to repair`)

      let repaired = 0
      for (const candidate of incomplete.slice(0, RepairIncompleteArtworks.MAX_PER_RUN)) {
        try {
          const product = await shopify.product.getProductById(candidate.id)

          if (!shopify.product.artworkCopier.canProcessProductCreate(product)) {
            console.warn(`⏭️  Skipping ${candidate.id} "${candidate.title}" (not processable)`)
            continue
          }

          await shopify.product.artworkCopier.copyModelDataFromImageRatio(product)
          repaired++
          console.info(`✅ Repaired "${candidate.title}" (${candidate.id})`)
        } catch (error: any) {
          const msg = error instanceof Error ? error.message : String(error)

          // Shopify's daily variant limit reached — stop for today, resume next run.
          if (msg.includes('Daily variant')) {
            console.warn(
              `🛑 Daily variant limit reached after repairing ${repaired}. Stopping; will resume next run.`
            )
            break
          }

          console.error(`❌ Failed to repair ${candidate.id} "${candidate.title}": ${msg}`)
        }

        // Gentle spacing between products
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      console.info(`🩹 Repair run done: ${repaired}/${incomplete.length} repaired`)
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`❌ RepairIncompleteArtworks failed: ${msg}`)
    } finally {
      logTaskBoundary(false, 'Repair incomplete artworks')
    }
  }
}
