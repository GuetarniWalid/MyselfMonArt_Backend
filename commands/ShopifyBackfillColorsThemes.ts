import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
import ChatGPT from 'App/Services/ChatGPT'

/**
 * Backfill the AI-detected colors (shopify.color-pattern) and themes (shopify.theme)
 * on artworks that were published while Shopify's daily variant-creation limit was
 * blocking the model copy.
 *
 * Context: before the daily-limit decoupling fix, a daily-limit hit threw out of the
 * model copy and the webhook's `if (copyFailed) return` skipped color + theme
 * detection entirely. The RepairIncompleteArtworks cron only re-creates variants, so
 * those products kept their variants/metafields but never got colors or themes.
 *
 * Detection is idempotent: detectAndSetColors / detectAndSetThemes skip any product
 * that already has the field, so re-running is safe and only calls OpenAI for the
 * fields that are actually missing.
 *
 *   node ace shopify:backfill_colors_themes                 # scan the whole store
 *   node ace shopify:backfill_colors_themes 10522001768795  # specific product(s)
 */
export default class ShopifyBackfillColorsThemes extends BaseCommand {
  public static commandName = 'shopify:backfill_colors_themes'
  public static description =
    'Detect & set missing colors (shopify.color-pattern) and themes (shopify.theme) on artworks left without them by a daily variant-limit hit'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @args.spread({
    description:
      'Product IDs (numeric or gid://) to backfill. With none, scans the store for paintings/posters missing colors or themes.',
    required: false,
  })
  public productIds: string[]

  @flags.boolean({
    description:
      'Only list the products that would be backfilled, without calling OpenAI or writing anything',
  })
  public dryRun: boolean

  // Spacing between products: detection calls OpenAI Vision twice per product.
  private static readonly DELAY_BETWEEN_PRODUCTS_MS = 3_000

  public async run() {
    const shopify = new Shopify()
    const chatGPT = new ChatGPT()

    const ids = await this.resolveTargetIds(shopify)

    if (ids.length === 0) {
      this.logger.info('Nothing to backfill — every artwork already has colors and themes.')
      return
    }

    if (this.dryRun) {
      this.logger.info(`Dry run: ${ids.length} product(s) would be backfilled. Nothing written.`)
      return
    }

    this.logger.info(`Backfilling colors/themes on ${ids.length} product(s)`)

    let processed = 0
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i].startsWith('gid://') ? ids[i] : `gid://shopify/Product/${ids[i]}`

      try {
        const product = await shopify.product.getProductById(id)

        if (!shopify.product.artworkCopier.canProcessProductCreate(product)) {
          this.logger.warning(`[${id}] skipped: not a processable artwork`)
          continue
        }

        // Both detectors are idempotent (skip if the field is already set) and never
        // throw, so a product that already has one of the two is only topped up.
        await chatGPT.colorPattern.detectAndSetColors(product)
        await chatGPT.theme.detectAndSetThemes(product)

        processed++
        this.logger.success(`[${id}] "${product.title}" — colors/themes detection done`)
      } catch (error) {
        this.logger.error(`[${id}] failed: ${error?.message ?? error}`)
      }

      if (i < ids.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, ShopifyBackfillColorsThemes.DELAY_BETWEEN_PRODUCTS_MS)
        )
      }
    }

    this.logger.info(`Done. Detection ran on ${processed}/${ids.length} product(s).`)
  }

  private async resolveTargetIds(shopify: Shopify): Promise<string[]> {
    if (this.productIds && this.productIds.length > 0) {
      return this.productIds
    }

    this.logger.info('No IDs given — scanning the store for artworks missing colors or themes…')
    const candidates = await shopify.product.getArtworksMissingColorsOrThemes()

    candidates.forEach((c) => {
      const gaps = [c.missingColors ? 'colors' : null, c.missingThemes ? 'themes' : null]
        .filter(Boolean)
        .join(' + ')
      this.logger.info(`  • ${c.id} "${c.title}" — missing ${gaps}`)
    })

    return candidates.map((c) => c.id)
  }
}
