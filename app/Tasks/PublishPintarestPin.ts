import { BaseTask } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Pinterest from 'App/Services/Pinterest'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class PublishPinterestPin extends BaseTask {
  public static get schedule() {
    return '30 8,12,18 * * *'
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    try {
      logTaskBoundary(true, 'Publish Pinterest Pin')

      const shopify = new Shopify()
      const products = await shopify.product.getAll()

      const pinterest = new Pinterest(products)
      await pinterest.initialize()

      await pinterest.newProductHandler.processNewProducts()
      await pinterest.updateProductHandler.refreshBoardRecommendations()
      const { product, board } = await pinterest.publicationSelector.selectNextProductToPublish()

      const pinPayload = await pinterest.pinFormatter.buildPinPayload(product, board)
      const pin = await pinterest.poster.publishPin(pinPayload)

      await pinterest.pinFormatter.removeImage(pinPayload.media_source.url)

      console.log('🚀 ~ pin published:', pin)
      console.log('============================')
      console.log('✅ Pinterest Pin published')
    } catch (error) {
      console.log('❌ Pinterest Pin no published')
    } finally {
      logTaskBoundary(false, 'Publish Pinterest Pin')
    }
  }
}
