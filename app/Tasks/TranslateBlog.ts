import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class TranslateBlog extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(3, 0)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate blog')

    const shopify = new Shopify()
    const blogsToTranslate = await shopify.translator('blog').getOutdatedTranslations()
    console.log('🚀 ~ blogs to translate length:', blogsToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const blog of blogsToTranslate) {
      console.log('============================')
      console.log('Id blog to translate => ', blog.id)
      const blogTranslated = await chatGPT.translate(blog, 'blog', 'en')
      const responses = await shopify.translator('blog').updateTranslation({
        resourceToTranslate: blog,
        resourceTranslated: blogTranslated,
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
    console.log('✅ Blogs translations updated')

    logTaskBoundary(false, 'Translate blog')
  }
}
