import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class ShopifyGetProductVariantById extends BaseCommand {
  public static commandName = 'shopify:get_product_variant_by_id'
  public static description = 'Get Shopify product variant details by ID'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()

    try {
      const variantId = await this.askForVariantId()
      const variant = await shopify.variant.getVariantById(variantId)

      if (variant) {
        this.logger.info('Variant Details:')
        this.logger.info(`ID: ${variant.id}`)
        this.logger.info(`Title: ${variant.title}`)
        this.logger.info(`SKU: ${variant.sku}`)
        this.logger.info(`Price: ${variant.price}`)
        this.logger.info(`Product: ${variant.product.title}`)
      } else {
        this.logger.error('Variant not found')
      }
    } catch (error) {
      this.logger.error('Failed to fetch variant data')
      this.logger.error(error.message)
    }
  }

  private async askForVariantId() {
    const variantId = await this.prompt.ask('Enter the variant ID')
    return variantId
  }
}
