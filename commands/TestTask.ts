import { BaseCommand } from '@adonisjs/core/build/standalone'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test task logic implementation'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()
    const collectionsToTranslate = await shopify.translation.getOutdatedTranslations('collection')
    console.log('🚀 ~ collectionsToTranslate:', collectionsToTranslate.length)

    const chatGPT = new ChatGPT()

    for (const collection of collectionsToTranslate.slice(0, 10)) {
      console.log('============================')
      console.log('Id collection to translate => ', collection.id)
      const collectionTranslated = await chatGPT.translate(collection, 'collection', 'en')
      const responses = await shopify.translation.updateTranslation({
        resourceToTranslate: collection,
        resourceTranslated: collectionTranslated,
        resource: 'collection',
        isoCode: 'en',
      })
      responses.forEach((response) => {
        if (response.translationsRegister.userErrors.length > 0) {
          console.log('error => ', response.translationsRegister.userErrors)
        } else {
          console.log('translation updated')
        }
      })
      console.log('============================')
    }
    console.log('translations updated')
  }
}
