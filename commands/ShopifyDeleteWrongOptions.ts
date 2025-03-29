import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class ShopifyDeleteWrongOptions extends BaseCommand {
  public static commandName = 'shopify:delete_wrong_options'
  public static description = 'Delete wrong options for Shopify products'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()
    const products = await shopify.product.getAll()

    for (const product of products) {
      for (const option of product.options) {
        if (option.values.length === 1 && option.values[0] === 'Default Title') {
          const optionId = option.id
          const deletedOptionIds = await shopify.product.deleteOptions(product.id, [optionId])
          console.log('🚀 ~ Option deleted', deletedOptionIds)
        }
      }
    }

    console.log('🚀 ~ All wrong options deleted')
  }
}
