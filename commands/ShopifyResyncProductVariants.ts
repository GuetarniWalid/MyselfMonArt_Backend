import { BaseCommand, args } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

/**
 * Repair tool for artworks whose variant matrix did not finish being created.
 *
 * Context: Shopify throttles/limits bulk variant creation during heavy publishing
 * (and the 1,000-variants/day cap kicks in once a store passes 50,000 variants).
 * When that happens mid-batch, the later products keep only their default variant
 * (options copied, but the full size×border×frame matrix and prices are missing).
 *
 * This command re-runs the model copy on the given products. The copy is
 * differential, so it only creates the still-missing variants and fixes prices.
 * Products are spaced out to avoid re-hitting the same limit.
 *
 *   node ace shopify:resync_product_variants 10521810501979 10522001768795
 *
 * With no arguments it falls back to the two products known to be broken.
 */
export default class ShopifyResyncProductVariants extends BaseCommand {
  public static commandName = 'shopify:resync_product_variants'
  public static description =
    'Re-copy model data (options, variants, prices, metafields) onto artworks left with an incomplete variant matrix'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @args.spread({
    description:
      'Product IDs (numeric or gid://) to resync. Defaults to the known-broken products.',
    required: false,
  })
  public productIds: string[]

  // Delay between two products so we do not re-hit Shopify's variant-creation limit.
  private static readonly DELAY_BETWEEN_PRODUCTS_MS = 60_000

  public async run() {
    const shopify = new Shopify()

    const rawIds =
      this.productIds && this.productIds.length > 0
        ? this.productIds
        : ['10521810501979', '10522001768795']

    this.logger.info(`Resyncing ${rawIds.length} product(s): ${rawIds.join(', ')}`)

    for (let i = 0; i < rawIds.length; i++) {
      const id = rawIds[i].startsWith('gid://') ? rawIds[i] : `gid://shopify/Product/${rawIds[i]}`

      try {
        const product = await shopify.product.getProductById(id)
        const before = product.variants?.nodes?.length ?? 0
        this.logger.info(`[${id}] "${product.title}" — variants before: ${before}`)

        if (!shopify.product.artworkCopier.canProcessProductCreate(product)) {
          this.logger.warning(
            `[${id}] skipped: not a processable artwork (canProcessProductCreate=false)`
          )
          continue
        }

        await shopify.product.artworkCopier.copyModelDataFromImageRatio(product)

        const after = await shopify.product.getProductById(id)
        const count = after.variants?.nodes?.length ?? 0
        this.logger.success(`[${id}] variants after: ${count}`)
      } catch (error) {
        this.logger.error(`[${id}] failed: ${error?.message ?? error}`)
      }

      if (i < rawIds.length - 1) {
        this.logger.info(
          `Waiting ${ShopifyResyncProductVariants.DELAY_BETWEEN_PRODUCTS_MS / 1000}s before next product…`
        )
        await new Promise((resolve) =>
          setTimeout(resolve, ShopifyResyncProductVariants.DELAY_BETWEEN_PRODUCTS_MS)
        )
      }
    }

    this.logger.info('Done.')
  }
}
