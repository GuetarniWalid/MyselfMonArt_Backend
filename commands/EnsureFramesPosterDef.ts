import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

/**
 * Create the PRODUCT metafield definition `painting_options.frames_poster`
 * (a list of `painting_option` metaobject references), so the theme can resolve
 * the poster frame-color swatches via `product.metafields.painting_options.frames_poster.value`.
 *
 * Reuses the existing Metafield.createProductMetaobjectListDefinition helper
 * (built for painting.color). Idempotent — a no-op if the definition already exists.
 *
 *   node ace shopify:ensure_frames_poster_def
 */
export default class EnsureFramesPosterDef extends BaseCommand {
  public static commandName = 'shopify:ensure_frames_poster_def'
  public static description =
    'Create the product metafield definition painting_options.frames_poster (list of painting_option metaobjects)'

  public static settings = { loadApp: true, stayAlive: false }

  public async run() {
    const shopify = new Shopify()

    const metaobjectDefinitionId =
      (await shopify.metafield.getMetaobjectDefinitionIdByType('painting_option')) ??
      'gid://shopify/MetaobjectDefinition/19684032859'

    const res = await shopify.metafield.createProductMetaobjectListDefinition({
      name: 'Painting options frames Poster',
      namespace: 'painting_options',
      key: 'frames_poster',
      metaobjectDefinitionId,
    })

    if (res.alreadyExisted) {
      this.logger.success(
        'painting_options.frames_poster definition already exists — nothing to do'
      )
    } else if (res.id) {
      this.logger.success(`painting_options.frames_poster definition created: ${res.id}`)
    } else {
      this.logger.error(`failed to create definition: ${res.errors.join('; ')}`)
    }
  }
}
