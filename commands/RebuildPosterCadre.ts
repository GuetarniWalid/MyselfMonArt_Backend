import { BaseCommand, args } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

/**
 * One-time fix for poster MODELS whose "Cadres" option was built with metafield-LINKED
 * option values (linked to painting_option metaobjects). Shopify refuses to add a plain
 * "Avec cadre" value to such an option ("An option cannot have both metafield linked and
 * nonlinked option values"), so the plain `shopify:collapse_poster_frames` command fails
 * mid-way (it deletes the color variants, then can't update the option).
 *
 * This rebuilds the option as a PLAIN { Sans cadre, Avec cadre } (Shopify can't unlink in
 * place, so we delete + recreate the option), then RECONCILES to the exact 7-variant target
 * by diff (robust to whatever Shopify auto-creates), and sets the frames_poster metafield.
 *
 *   node ace shopify:rebuild_poster_cadre 10290792923483
 *   node ace shopify:rebuild_poster_cadre 10290792923483 10290790662491
 */
export default class RebuildPosterCadre extends BaseCommand {
  public static commandName = 'shopify:rebuild_poster_cadre'
  public static description =
    'Rebuild a poster Cadres option from metafield-linked values to a plain { Sans cadre, Avec cadre } + frames_poster'

  public static settings = { loadApp: true, stayAlive: false }

  @args.spread({ description: 'Poster product IDs (numeric or gid://)', required: true })
  public productIds: string[]

  // "Avec cadre" price per size. Sizes absent here get NO frame (e.g. 90x120 / 120x90).
  private static readonly AVEC_PRICE: Record<string, string> = {
    '30x40 cm': '47.90',
    '40x30 cm': '47.90',
    '60x80 cm': '94.90',
    '80x60 cm': '94.90',
    '75x100 cm': '134.90',
    '100x75 cm': '134.90',
  }

  // The 4 reused framePoster swatch metaobjects (Noir, Blanc, Chêne clair, Noyer).
  private static readonly FRAMES_POSTER = [
    'gid://shopify/Metaobject/138918297947',
    'gid://shopify/Metaobject/138917380443',
    'gid://shopify/Metaobject/138918855003',
    'gid://shopify/Metaobject/138919182683',
  ]

  public async run() {
    const shopify = new Shopify()
    for (const raw of this.productIds) {
      const id = raw.startsWith('gid://') ? raw : `gid://shopify/Product/${raw}`
      try {
        await this.rebuild(shopify, id)
      } catch (error) {
        this.logger.error(`[${id}] failed: ${error?.message ?? error}`)
      }
    }
    this.logger.info('Done.')
  }

  private async rebuild(shopify: Shopify, id: string) {
    let product = await shopify.product.getProductById(id)
    this.logger.info(
      `[${id}] "${product.title}" — ${product.variants?.nodes?.length ?? 0} variants`
    )

    const cadre = product.options?.find((o) => o.optionValues.some((v) => v.name === 'Sans cadre'))
    if (!cadre) {
      this.logger.warning(`[${id}] no option containing "Sans cadre" — skipped`)
      return
    }
    const cadreName = cadre.name
    const sizeOptionName = product.options.find((o) => o.id !== cadre.id)?.name ?? 'Taille'

    // Capture the Sans cadre price per size from the current variants (kept verbatim).
    const sansPriceBySize = new Map<string, string>()
    for (const v of product.variants.nodes) {
      const size = v.selectedOptions.find((o) => o.name === sizeOptionName)?.value ?? ''
      const frame = v.selectedOptions.find((o) => o.name === cadreName)?.value ?? ''
      if (frame === 'Sans cadre') sansPriceBySize.set(size, v.price)
    }
    this.logger.info(`[${id}] sizes (Sans cadre): ${[...sansPriceBySize.keys()].join(', ')}`)

    // Make the Cadres option PLAIN { Sans cadre, Avec cadre } unless it already is.
    const values = cadre.optionValues.map((v) => v.name)
    const alreadyPlain =
      values.length === 2 && values.includes('Sans cadre') && values.includes('Avec cadre')
    if (!alreadyPlain) {
      this.logger.info(`[${id}] deleting linked "${cadreName}" option (${cadre.id})`)
      await shopify.product.deleteOptions(id, [cadre.id])
      this.logger.info(`[${id}] recreating plain "${cadreName}" = [Sans cadre, Avec cadre]`)
      await shopify.product.createOptions(id, [
        { name: cadreName, values: ['Sans cadre', 'Avec cadre'] },
      ])
      product = await shopify.product.getProductById(id)
      this.logger.info(
        `[${id}] after recreate: ${product.variants.nodes.length} variants -> ${product.variants.nodes
          .map((v) => v.title)
          .join(' | ')}`
      )
    }

    // Desired exact variant set: key `${size}||${cadre}` -> price.
    const desired = new Map<string, string>()
    for (const [size, sansPrice] of sansPriceBySize) {
      desired.set(`${size}||Sans cadre`, sansPrice)
      const avec = RebuildPosterCadre.AVEC_PRICE[size]
      if (avec) desired.set(`${size}||Avec cadre`, avec)
    }

    // Actual variant set (after the option is plain).
    product = await shopify.product.getProductById(id)
    const actual = new Map<string, { id: string; price: string }>()
    for (const v of product.variants.nodes) {
      const size = v.selectedOptions.find((o) => o.name === sizeOptionName)?.value ?? ''
      const frame = v.selectedOptions.find((o) => o.name === cadreName)?.value ?? ''
      actual.set(`${size}||${frame}`, { id: v.id, price: v.price })
    }

    // Reconcile by diff: delete extras, create missing, fix prices.
    const toDelete = [...actual.entries()].filter(([k]) => !desired.has(k)).map(([, v]) => v.id)
    if (toDelete.length) {
      this.logger.info(`[${id}] deleting ${toDelete.length} variant(s) not in target`)
      await shopify.product.deleteVariants(id, toDelete)
    }

    const toCreate = [...desired.entries()]
      .filter(([k]) => !actual.has(k))
      .map(([k, price]) => {
        const [size, frame] = k.split('||')
        return {
          price,
          optionValues: [
            { optionName: sizeOptionName, name: size },
            { optionName: cadreName, name: frame },
          ],
        }
      })
    if (toCreate.length) {
      this.logger.info(`[${id}] creating ${toCreate.length} variant(s)`)
      await shopify.product.createVariantsBulk(id, toCreate)
    }

    const toReprice = [...desired.entries()]
      .filter(([k, price]) => actual.has(k) && actual.get(k)!.price !== price)
      .map(([k, price]) => ({ id: actual.get(k)!.id, price }))
    if (toReprice.length) {
      this.logger.info(`[${id}] repricing ${toReprice.length} variant(s)`)
      await shopify.product.updateVariantsPricesBulk(id, toReprice)
    }

    // frames_poster metafield (reuse the 4 framePoster swatches).
    await shopify.metafield.update(
      id,
      'painting_options',
      'frames_poster',
      JSON.stringify(RebuildPosterCadre.FRAMES_POSTER)
    )

    const after = await shopify.product.getProductById(id)
    this.logger.success(
      `[${id}] done — ${after.variants.nodes.length} variants: ${after.variants.nodes
        .map((v) => `${v.title} @${v.price}`)
        .join(' | ')}`
    )
  }
}
