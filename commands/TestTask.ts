import { BaseCommand } from '@adonisjs/core/build/standalone'
import ChatGPT from 'App/Services/ChatGPT'
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
