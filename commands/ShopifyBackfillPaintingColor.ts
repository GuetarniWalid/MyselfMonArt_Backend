import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

/**
 * Migrate the storefront color filter off the taxonomy metafield (shopify.color-pattern)
 * onto a custom product metafield painting.color (list of references to the SAME
 * shopify--color-pattern metaobjects).
 *
 * Why: the taxonomy filter (filter.v.t.shopify.color-pattern) displays value labels from a
 * platform-side cache that is frozen — merchant translations, metaobject label edits and
 * product reindexing never refresh it (its EN labels are months stale). Metafield filters
 * (filter.p.m.*) resolve the metaobject label + translations live and update in minutes —
 * proven by the painting.layout format filter. Same metaobjects, working surface.
 *
 * Steps it performs:
 *   1. Ensures the PRODUCT metafield definition painting.color exists (list.metaobject_reference
 *      to the shopify--color-pattern metaobject definition).
 *   2. Copies every product's shopify.color-pattern value into painting.color (idempotent:
 *      skips products whose painting.color already equals the source).
 * Afterwards, the merchant switches the Search & Discovery color filter to the new metafield.
 * New products are covered by ColorPatternDetector, which now writes both metafields.
 *
 *   node ace shopify:backfill_painting_color --dry-run
 *   node ace shopify:backfill_painting_color
 */
export default class ShopifyBackfillPaintingColor extends BaseCommand {
  public static commandName = 'shopify:backfill_painting_color'
  public static description = 'Create painting.color definition and mirror shopify.color-pattern into it on all products'
  public static settings = { loadApp: true, stayAlive: false }

  @flags.boolean({ description: 'Scan and report without writing' })
  public dryRun: boolean

  public async run() {
    const shopify = new Shopify()

    // 1. Definition (idempotent)
    const moDefId = await shopify.metafield.getMetaobjectDefinitionIdByType('shopify--color-pattern')
    if (!moDefId) {
      this.logger.error('shopify--color-pattern metaobject definition not found — aborting')
      return
    }
    this.logger.info(`Metaobject definition: ${moDefId}`)
    if (!this.dryRun) {
      const def = await shopify.metafield.createProductMetaobjectListDefinition({
        name: 'Couleur (filtre)',
        namespace: 'painting',
        key: 'color',
        metaobjectDefinitionId: moDefId,
      })
      if (def.errors.length) {
        this.logger.error(`Definition creation failed: ${def.errors.join(' | ')} — aborting`)
        return
      }
      this.logger.success(
        def.alreadyExisted ? 'Definition painting.color already exists' : `Definition created: ${def.id}`
      )
    }

    // 2. Backfill
    const withColors = await shopify.product.getAllProductsWithMetafield('shopify', 'color-pattern')
    const withTarget = await shopify.product.getAllProductsWithMetafield('painting', 'color')
    const targetById = new Map(withTarget.map((p) => [p.id, p.value]))
    const todo = withColors.filter((p) => targetById.get(p.id) !== p.value)
    this.logger.info(
      `Products with colors: ${withColors.length} | already mirrored: ${withColors.length - todo.length} | to write: ${todo.length}`
    )
    if (this.dryRun) {
      this.logger.info('Dry run — nothing written.')
      return
    }

    let ok = 0
    let fail = 0
    for (const p of todo) {
      try {
        await shopify.metafield.update(p.id, 'painting', 'color', p.value)
        ok++
        if (ok % 25 === 0) this.logger.info(`  ...${ok}/${todo.length}`)
      } catch (error: any) {
        this.logger.error(`[${p.id}] ${error?.message ?? error}`)
        fail++
      }
    }
    this.logger.info(`Done. written=${ok} failed=${fail}`)
  }
}
