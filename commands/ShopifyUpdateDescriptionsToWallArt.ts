import type { Product, ProductUpdate } from 'types/Product'
import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
import SEO from 'App/Services/ChatGPT/SEO'

export default class ShopifyUpdateDescriptionsToWallArt extends BaseCommand {
  public static commandName = 'shopify:update_descriptions_to_wallart'
  public static description = 'Update product descriptions to reflect wall art terminology only'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shouldUpdateAllProducts = await this.askIfWeShouldUpdateAllProducts()
    let numberOfProducts = 0
    if (!shouldUpdateAllProducts) {
      numberOfProducts = await this.askForNumberOfProducts()
    }

    const shopify = new Shopify()
    const products = await shopify.product.getAll()
    const paintingProducts = this.getPaintingProducts(products)

    const productsToUpdate = shouldUpdateAllProducts
      ? paintingProducts
      : paintingProducts.slice(0, numberOfProducts)

    for (const product of productsToUpdate) {
      const seo = new SEO()
      const result = await seo.updateDescriptionsToWallArt(product)

      const newValuesFormattedForShopify: ProductUpdate = {
        descriptionHtml: result.description,
        seo: {
          title: product.seo.title,
          description: result.metaDescription,
        },
      }

      const updatedProductId = await shopify.product.update(
        product.id,
        newValuesFormattedForShopify
      )

      console.log('============================================')
      console.log('============================================')
      console.log('🚀 ~ Produit:', product.title)
      console.log('🚀 ~ Description originale:', product.description.substring(0, 100) + '...')
      console.log('🚀 ~ Description nouvelle:', result.description.substring(0, 100) + '...')
      console.log('🚀 ~ Méta-description originale:', product.seo.description)
      console.log('🚀 ~ Méta-description nouvelle:', result.metaDescription)
      console.log('🚀 ~ Longueur méta-description:', result.metaDescription.length, 'caractères')
      console.log('🚀 ~ updatedProduct:', updatedProductId)
      console.log('============================================')
      console.log('============================================')
    }
  }

  private async askIfWeShouldUpdateAllProducts() {
    const shouldUpdateAllProducts = await this.prompt.confirm(
      'Do you want to update all products? (y/n)'
    )
    return shouldUpdateAllProducts
  }

  private async askForNumberOfProducts() {
    const numberOfProducts = await this.prompt.ask('Enter the number of products to update')
    return Number(numberOfProducts)
  }

  private getPaintingProducts(products: Product[]) {
    return products.filter((product) => product.templateSuffix === 'painting')
  }
}
