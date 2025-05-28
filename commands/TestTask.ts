import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test task logic implementation'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    await this.handlePaintingCreate('gid://shopify/Product/9883853685083')
  }

  private async handlePaintingCreate(id: string) {
    const shopify = new Shopify()
    const product = await shopify.product.getProductById(id)
    const canProcess = shopify.product.modelCopier.canProcessPaintingCreate(product)
    if (!canProcess) return

    console.info(`🚀 Filling model data on product`)
    await shopify.product.modelCopier.copyModelDataFromImageRatio(product)
    console.info(`🚀 Data successfully copied on product ${id}`)
  }
}
