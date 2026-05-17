import type { Product, ProductUpdate } from 'types/Product'
import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
import SEO from 'App/Services/ChatGPT/SEO'

export default class ShopifyUpdateTitlesToWallArt extends BaseCommand {
  public static commandName = 'shopify:update_titles_to_wallart'
  public static description = 'Update product titles to reflect wall art terminology only'

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
      const result = await seo.updateToWallArtTerminology(product)

      // ⚠️ handle (URL slug) NON modifié intentionnellement.
      // Changer le handle d'un produit existant casse les liens externes, les bookmarks Google
      // et reset l'autorité SEO accumulée par cette URL. On garde le handle d'origine.
      const newValuesFormattedForShopify: ProductUpdate = {
        title: result.title,
        seo: {
          title: result.metaTitle,
          description: product.seo.description,
        },
      }

      const updatedProductId = await shopify.product.update(
        product.id,
        newValuesFormattedForShopify
      )

      console.log('============================================')
      console.log('============================================')
      console.log('🚀 ~ Titre original:', product.title)
      console.log('🚀 ~ Titre nouveau:', result.title)
      console.log('🚀 ~ Méta-titre original:', product.seo.title)
      console.log('🚀 ~ Méta-titre nouveau:', result.metaTitle)
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
    return products.filter((product) => product.artworkTypeMetafield?.value === 'painting')
  }
}
