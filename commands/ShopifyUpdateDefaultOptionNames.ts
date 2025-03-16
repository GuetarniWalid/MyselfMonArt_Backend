import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class ShopifyUpdateDefaultOptionNames extends BaseCommand {
  public static commandName = 'shopify:update_default_option_names'
  public static description = 'Update default option names for Shopify products'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()
    const products = await shopify.product.getAll()

    for (const product of products) {
      const defaultOptionName = product.options[0].name

      if (defaultOptionName === 'Title') {
        const optionId = product.options[0].id
        const { userErrors } = await shopify.product.updateOption(product.id, optionId, {
          name: 'Titre',
        })

        if (userErrors.length > 0) {
          console.log('🚀 ~ Error updating product: ', product.title)
          console.log('🚀 ~ ', userErrors)
          console.log('--------------------------------')
        } else {
          console.log('🚀 ~ Updated option name')
        }
      }
    }

    console.log('🚀 ~ All product option names updated')
  }
}
