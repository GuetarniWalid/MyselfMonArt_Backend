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
      product.options[0].optionValues.forEach((option) => {
        console.log('🚀 ~ Option id : ' + option.id)
        console.log('🚀 ~ Option name : ' + option.name)
      })
    } catch (error) {
      console.error('🚀 ~ Error getting product by ID', error)
    }
  }

  private async askForProductId() {
    const productId = await this.prompt.ask('Enter the product ID')
    return productId
  }
}
