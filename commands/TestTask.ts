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
    await this.handleProductUpdate('gid://shopify/Product/9883554906459')
    return 'ok'
  }

  private async handleProductUpdate(id: string) {
    console.info(`🚀 Handling product update: ${id}`)

    await this.handlePaintingCreate(id)
    await this.updateRelatedProductsFromModel(id)
  }

  private async updateRelatedProductsFromModel(id: string) {
    const shopify = new Shopify()
    const product = await shopify.product.getProductById(id)
    const isModel = shopify.product.modelCopier.isModelProduct(product)
    if (!isModel) return

    console.info(`🚀 Updating related products from model: ${id}`)
    const tag = shopify.product.modelCopier.getTagFromModel(product)

    const products = await shopify.product.getAll()
    const relatedProducts = products.filter((p) => {
      if (p.templateSuffix !== 'painting') return false

      const pSecondImage = p.media.nodes[1]
      if (!pSecondImage?.image) return false

      const isModel = shopify.product.modelCopier.isModelProduct(p)
      if (isModel) return false

      const pTag = shopify.product.modelCopier.getTagFromProduct(p)
      return pTag === tag
    })

    for (const relatedProduct of relatedProducts) {
      await this.handlePaintingCreate(relatedProduct.id)
    }
    console.info(`🚀 Related products updated: ${relatedProducts.length}`)
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
