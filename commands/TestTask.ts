import { BaseCommand } from '@adonisjs/core/build/standalone'
import Pinterest from 'App/Services/Pinterest'
import { logTaskBoundary } from 'App/Utils/Logs'
import Shopify from 'App/Services/Shopify'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test task logic implementation'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Publish Pinterest Pin')

    const shopify = new Shopify()
    const products = await shopify.product.getAll()

    const pinterest = new Pinterest(products)
    await pinterest.initialize()

    await pinterest.newProductHandler.processNewProducts()
    await pinterest.updateProductHandler.refreshBoardRecommendations()
    const { product, board } = await pinterest.publicationSelector.selectNextProductToPublish()

    const pinPayload = await pinterest.pinFormatter.buildPinPayload(product, board)
    console.dir(pinPayload, { depth: null })

    pinPayload.media_source.url = 'https://backend.myselfmonart.com/uploads/test.png'
    const pin = await pinterest.poster.publishPin(pinPayload)
    console.dir(pin, { depth: null })

    await pinterest.pinFormatter.removeImage(pinPayload.media_source.url)

    console.log('🚀 ~ pin published:', pin)
    console.log('============================')
    console.log('✅ Pinterest Pin published')

    logTaskBoundary(false, 'Publish Pinterest Pin')
  }
}
