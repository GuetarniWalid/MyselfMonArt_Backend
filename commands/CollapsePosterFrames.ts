import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

/**
 * Collapse a poster product's "Cadre" option from per-color variants to a flat
 * { Sans cadre, Avec cadre } 2-value option. The frame COLOR leaves the variant
 * axis (it becomes a line-item property handled by the theme), so the variant
 * count drops (e.g. 19 -> 7) and adding new colors never creates variants again.
 *
 * Order matters — productOptionUpdate here runs with the default LEAVE_AS_IS
 * variant strategy (see Product.updateOptionValues: no variantStrategy passed),
 * so it never auto-creates/destroys variants. We therefore:
 *   1. DELETE every framed color variant (Cadre value not in {Sans cadre, Avec cadre}).
 *      Their option values become unused.
 *   2. updateOptionValues -> Cadre = { Sans cadre, Avec cadre } (adds "Avec cadre",
 *      deletes the now-unused color values). No variant is touched here.
 *   3. CREATE one "Avec cadre" variant per FRAMED size at that size's frame price.
 *      Sizes that only had "Sans cadre" (e.g. 90x120) get no "Avec cadre".
 *
 * Idempotent (re-running on an already-collapsed product is a no-op) and dry-run
 * aware. Reusable on the poster MODELS later.
 *
 *   node ace shopify:collapse_poster_frames 10552796119387 --dry-run
 *   node ace shopify:collapse_poster_frames 10552796119387
 */
export default class CollapsePosterFrames extends BaseCommand {
  public static commandName = 'shopify:collapse_poster_frames'
  public static description =
    'Collapse a poster "Cadre" option to { Sans cadre, Avec cadre }; frame color moves to a line-item property'

  public static settings = { loadApp: true, stayAlive: false }

  @args.spread({
    description: 'Poster product IDs (numeric or gid://) to collapse',
    required: true,
  })
  public productIds: string[]

  @flags.boolean({ description: 'Print the plan without mutating anything' })
  public dryRun: boolean

  private static readonly KEEP_VALUES = ['Sans cadre', 'Avec cadre']

  public async run() {
    const shopify = new Shopify()
    for (const raw of this.productIds) {
      const id = raw.startsWith('gid://') ? raw : `gid://shopify/Product/${raw}`
      try {
        await this.collapse(shopify, id)
      } catch (error) {
        this.logger.error(`[${id}] failed: ${error?.message ?? error}`)
      }
    }
    this.logger.info('Done.')
  }

  private async collapse(shopify: Shopify, id: string) {
    const product = await shopify.product.getProductById(id)
    this.logger.info(
      `[${id}] "${product.title}" — ${product.variants?.nodes?.length ?? 0} variants`
    )

    const options = product.options ?? []
    this.logger.info(
      `[${id}] options: ${options
        .map((o) => `${o.name}=[${o.optionValues.map((v) => v.name).join(', ')}]`)
        .join(' | ')}`
    )

    // Detect the frame option by its values (the one carrying "Sans cadre"), not by a
    // hardcoded name — poster option names vary. The size option is the other one.
    const frameOption = options.find((o) => o.optionValues.some((v) => v.name === 'Sans cadre'))
    if (!frameOption) {
      this.logger.warning(`[${id}] no option containing "Sans cadre" — skipped`)
      return
    }
    const frameOptionName = frameOption.name
    const sizeOptionName = options.find((o) => o.id !== frameOption.id)?.name ?? 'Taille'

    const currentValues = frameOption.optionValues.map((v) => v.name)
    const colorValues = currentValues.filter((v) => !CollapsePosterFrames.KEEP_VALUES.includes(v))
    if (colorValues.length === 0) {
      this.logger.success(
        `[${id}] already collapsed (${frameOptionName} = ${currentValues.join(', ')}) — nothing to do`
      )
      return
    }

    const colorVariantIds: string[] = []
    const framePriceBySize = new Map<string, string>()
    const sizesAlreadyAvecCadre = new Set<string>()

    for (const v of product.variants.nodes) {
      const size = v.selectedOptions.find((o) => o.name === sizeOptionName)?.value ?? ''
      const frame = v.selectedOptions.find((o) => o.name === frameOptionName)?.value ?? ''
      if (frame === 'Avec cadre') sizesAlreadyAvecCadre.add(size)
      if (colorValues.includes(frame)) {
        colorVariantIds.push(v.id)
        if (!framePriceBySize.has(size)) framePriceBySize.set(size, v.price)
      }
    }

    // One "Avec cadre" variant per framed size that doesn't already have one.
    const toCreate = [...framePriceBySize.entries()]
      .filter(([size]) => !sizesAlreadyAvecCadre.has(size))
      .map(([size, price]) => ({
        price,
        optionValues: [
          { optionName: sizeOptionName, name: size },
          { optionName: frameOptionName, name: 'Avec cadre' },
        ],
      }))

    this.logger.info(
      `[${id}] plan: delete ${colorVariantIds.length} color variants; ` +
        `set Cadre = [Sans cadre, Avec cadre]; create ${toCreate.length} "Avec cadre" variant(s) ` +
        `(${toCreate.map((c) => `${c.optionValues[0].name} @${c.price}`).join(', ') || 'none'})`
    )

    if (this.dryRun) {
      this.logger.info(`[${id}] --dry-run: no mutation performed`)
      return
    }

    // 1) delete the framed color variants
    await shopify.product.deleteVariants(id, colorVariantIds)
    // 2) collapse the option (now-unused color values are safe to delete under LEAVE_AS_IS)
    await shopify.product.updateOptionValues(
      id,
      frameOption.id,
      frameOptionName,
      ['Sans cadre', 'Avec cadre'],
      currentValues
    )
    // 3) create the "Avec cadre" variant for each framed size
    if (toCreate.length > 0) await shopify.product.createVariantsBulk(id, toCreate)

    const after = await shopify.product.getProductById(id)
    this.logger.success(
      `[${id}] done — ${after.variants?.nodes?.length ?? 0} variants: ` +
        after.variants.nodes.map((v) => v.title).join(' | ')
    )
  }
}
