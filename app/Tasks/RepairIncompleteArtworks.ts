import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Shopify from 'App/Services/Shopify'
import ChatGPT from 'App/Services/ChatGPT'
import PublishAlertMailer from 'App/Services/PublishAlertMailer'
import { logTaskBoundary } from 'App/Utils/Logs'

/**
 * Hourly safety net that re-creates the missing variants of any published artwork
 * whose matrix does not match its model's — whatever cut it short:
 *   - Shopify's daily variant-creation limit (1,000/day past 50,000 store variants),
 *     which leaves the tail of a burst publish with a lone default variant;
 *   - a products/create webhook that never landed, or whose async processing died in
 *     a redeploy;
 *   - images Shopify had not finished processing when the webhook ran, so the model
 *     copy never even started (the product then carries a single "Title" option).
 *
 * This is the single, persistent "retry later" mechanism. The in-process retry in
 * createVariantsBulkWithRetry fails fast (it did not survive redeploys), so the two
 * never run a competing wait. The copy is differential, so a re-run never creates a
 * variant that already exists.
 *
 * Runs hourly, not daily: an artwork is online and unsellable (one variant at 0,00 €)
 * for as long as it waits, so the exposure window is an hour rather than a full day.
 * The scan is cheap — a handful of paginated queries, no per-product model fetch.
 */
export default class RepairIncompleteArtworks extends BaseTask {
  public static get schedule() {
    // Minute 50: clear of the other hourly jobs (:05 custom-art, :20 pending posters,
    // :30 publish) so they never contend for the Shopify rate limit.
    return CronTimeV2.everyHourAt(50)
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
    const chatGPT = new ChatGPT()

    try {
      const incomplete = await shopify.product.getIncompleteArtworks()
      console.info(`🩹 Found ${incomplete.length} incomplete artwork(s) to repair`)

      let repaired = 0
      const failures: Array<{
        productId: string
        title: string
        variantsCount: number
        reason: string
      }> = []

      for (const candidate of incomplete.slice(0, RepairIncompleteArtworks.MAX_PER_RUN)) {
        try {
          const product = await shopify.product.getProductById(candidate.id)

          if (!shopify.product.artworkCopier.canProcessProductCreate(product)) {
            console.warn(`⏭️  Skipping ${candidate.id} "${candidate.title}" (not processable)`)
            failures.push({
              productId: candidate.id,
              title: candidate.title,
              variantsCount: candidate.variantsCount,
              reason: 'copie du modèle impossible (image ou metafield artwork.type manquant)',
            })
            continue
          }

          await shopify.product.artworkCopier.copyModelDataFromImageRatio(product)

          // The copy returns silently when no model matches the image ratio, so trust
          // the variant count rather than the absence of an exception: a run that
          // reports a repair it never made is what let these products rot for weeks.
          const after = await shopify.product.getProductById(candidate.id)
          const count = after.variants?.nodes?.length ?? 0

          if (count <= 1) {
            console.error(`❌ Repair had no effect on ${candidate.id} "${candidate.title}"`)
            failures.push({
              productId: candidate.id,
              title: candidate.title,
              variantsCount: count,
              reason: 'la copie du modèle est passée sans rien créer',
            })
            continue
          }

          repaired++
          console.info(`✅ Repaired "${candidate.title}" (${candidate.id}) — ${count} variants`)

          // A product that never reached the model copy never reached colour/theme
          // detection either — it would come back sellable but absent from every
          // colour and theme filter of the storefront. Both detections skip a product
          // that already carries the field, so this costs nothing on a product that
          // only lost its variants. Never fatal: the variants are the urgent part.
          try {
            const enriched = await shopify.product.getProductById(candidate.id)
            await chatGPT.colorPattern.detectAndSetColors(enriched)
            await chatGPT.theme.detectAndSetThemes(enriched)
          } catch (detectError: any) {
            const msg = detectError instanceof Error ? detectError.message : String(detectError)
            console.error(`⚠️  Colour/theme detection failed for ${candidate.id}: ${msg}`)
          }
        } catch (error: any) {
          const msg = error instanceof Error ? error.message : String(error)

          // Shopify's daily variant limit reached — stop for today, resume next run.
          // Not a failure to report: the next run finishes the job by itself.
          if (msg.includes('Daily variant')) {
            console.warn(
              `🛑 Daily variant limit reached after repairing ${repaired}. Stopping; will resume next run.`
            )
            break
          }

          console.error(`❌ Failed to repair ${candidate.id} "${candidate.title}": ${msg}`)
          failures.push({
            productId: candidate.id,
            title: candidate.title,
            variantsCount: candidate.variantsCount,
            reason: msg.slice(0, 200),
          })
        }

        // Gentle spacing between products
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      console.info(`🩹 Repair run done: ${repaired}/${incomplete.length} repaired`)

      // Only write to the owner when a product is still online and unsellable after
      // the automatic pass — a run that heals everything stays silent.
      if (failures.length > 0) {
        try {
          await new PublishAlertMailer().sendUnrepairableArtworks(failures)
          console.info(`📧 Alerted the owner about ${failures.length} unrepairable artwork(s)`)
        } catch (mailError: any) {
          const msg = mailError instanceof Error ? mailError.message : String(mailError)
          console.error(`⚠️  Could not send the unrepairable-artworks alert: ${msg}`)
        }
      }
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`❌ RepairIncompleteArtworks failed: ${msg}`)
    } finally {
      logTaskBoundary(false, 'Repair incomplete artworks')
    }
  }
}
