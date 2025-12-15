import type { Product } from 'types/Product'
import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class PhotoshopMockupAutomation extends BaseCommand {
  public static commandName = 'photoshop:mockup_automation'
  public static description = 'Automate Photoshop mockup generation for paintings'

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

    console.log('============================================')
    console.log('🎨 Photoshop Mockup Automation Test')
    console.log('============================================')
    console.log(`Total painting products found: ${paintingProducts.length}`)
    console.log(`Products selected for processing: ${productsToUpdate.length}`)
    console.log('============================================')

    for (const product of productsToUpdate) {
      console.log('--------------------------------------------')
      console.log(`📸 Processing product: ${product.title}`)
      console.log(`   Product ID: ${product.id}`)
      console.log(`   Template: ${product.templateSuffix}`)
      console.log('--------------------------------------------')
    }

    console.log('============================================')
    console.log('✅ Test completed successfully!')
    console.log('============================================')
  }

  private async askIfWeShouldUpdateAllProducts() {
    const shouldUpdateAllProducts = await this.prompt.confirm(
      'Do you want to process all paintings? (y/n)'
    )
    return shouldUpdateAllProducts
  }

  private async askForNumberOfProducts() {
    const numberOfProducts = await this.prompt.ask('Enter the number of paintings to process')
    return Number(numberOfProducts)
  }

  private getPaintingProducts(products: Product[]) {
    return products.filter((product) => product.templateSuffix === 'painting')
  }
}
