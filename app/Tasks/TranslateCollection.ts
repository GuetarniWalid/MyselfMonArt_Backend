import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'

export default class TranslateCollection extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(2, 30)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    const shopify = new Shopify()
    const collectionsToTranslate = await shopify.translation.getOutdatedTranslations('collection')
    const chatGPT = new ChatGPT()

    for (const collection of collectionsToTranslate) {
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
          console.log('🚨 Error => ', response.translationsRegister.userErrors)
        } else {
          console.log('✅ Translation updated')
        }
      })
      console.log('============================')
    }
    console.log('✅ Collections translations updated')
  }
}
