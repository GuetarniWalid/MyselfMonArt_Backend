import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class ShopifyRemoveOldVariantsFromProducts extends BaseCommand {
  public static commandName = 'shopify:remove_old_variants_from_products'
  public static description = 'Remove old variants from products'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()
    const products = await shopify.product.getAll()
    const productsWithOldVariants = products.filter((product) => product.options.length > 1)

    for (const product of productsWithOldVariants) {
      const deletedOptionsIds = await shopify.product.deleteOptions(
        product.id,
        product.options.map((option) => option.id)
      )
      console.log('🚀 ~ product:', product.title)
      console.log('🚀 ~ deletedOptionsIds:', deletedOptionsIds)
    }
  }
}
