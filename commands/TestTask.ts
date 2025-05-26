import { BaseCommand } from '@adonisjs/core/build/standalone'
import Logger from '@ioc:Adonis/Core/Logger'
import Shopify from 'App/Services/Shopify'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test task logic implementation'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    await this.handleProductCreate('gid://shopify/Product/9883853685083')
    return 'ok'
  }

  private async handleProductCreate(id: string) {
    Logger.info(`🚀 Handling painting create: ${id}`)
    Logger.info(`🚀 Filling model data on product`)
    const shopify = new Shopify()
    const product = await shopify.product.getProductById(id)
    if (!product) {
      Logger.warn(`Product not found: ${id}`)
      return
    }

    if (product.templateSuffix !== 'painting') return
    if (product.media.nodes.length < 1) return
    if (!product.media.nodes[1].image) return

    const imageWidth = product.media.nodes[1].image.width
    const imageHeight = product.media.nodes[1].image.height
    const ratio = imageWidth / imageHeight

    const isPersonalized = product.tags.includes('personnalisé')

    const tag = shopify.product.getTagByRatio(ratio, isPersonalized)
    const model = await shopify.product.getProductByTag(tag)
    await shopify.product.modelCopier.copyModelDataOnProduct(product, model)
    Logger.info(`🚀 Data successfully copied on product ${id}`)
  }
}
