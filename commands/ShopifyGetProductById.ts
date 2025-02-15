import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class ShopifyGetProductById extends BaseCommand {
  public static commandName = 'shopify:get_product_by_id'
  public static description = 'Get Shopify product details by ID'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()

    try {
      const productId = await this.askForProductId()
      const product = await shopify.product.getProductById(productId)
      this.logger.info('Product details retrieved successfully')
      this.logger.info('Product details :')
      this.logger.log(product)
      this.logger.info('Options details :')
      this.logger.info('Options size : ' + product.options[0].optionValues.length)
      product.options[0].optionValues.forEach((option) => {
        this.logger.info('Option id : ' + option.id)
        this.logger.info('Option name : ' + option.name)
      })
      this.logger.info('Variants details :')
      this.logger.log(product.variants.nodes)
    } catch (error) {
      this.logger.error('Error getting product by ID', error)
    }
  }

  private async askForProductId() {
    const productId = await this.prompt.ask('Enter the product ID')
    return productId
  }
}
