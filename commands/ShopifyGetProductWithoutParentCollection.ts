import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class ShopifyGetProductWithoutParentCollection extends BaseCommand {
  public static commandName = 'shopify:get_product_without_parent_collection'
  public static description = 'Get Shopify product without parent collection'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()

    try {
      const products = await shopify.product.getAll()

      // Filter products without mother_collection
      const productsWithoutCollection = products.filter((product) => {
        // Check if product has metafields
        if (!product.metafields?.edges) return true

        // Look for mother_collection metafield
        const hasMotherCollection = product.metafields.edges.some(
          (edge) =>
            edge.node.namespace === 'link' &&
            edge.node.key === 'mother_collection' &&
            edge.node.reference?.title
        )

        // Return true for products that don't have a mother_collection
        return !hasMotherCollection
      })

      console.log(`Found ${productsWithoutCollection.length} products without collection`)
      productsWithoutCollection.forEach((product) => {
        console.log(product.id)
      })
    } catch (error) {
      console.error('Error getting products:', error)
    }
  }
}
