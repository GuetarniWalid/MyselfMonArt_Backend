import type { LanguageCode } from 'Types/Translation'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { localePassesFor } from 'App/Services/i18n'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class TranslateBlog extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(3, 45)
  }

  public static get useLock() {
    return false
  }

  public async handle() {
    logTaskBoundary(true, 'Translate blog')

    for (const { locale } of localePassesFor('blog')) {
      await this.translateTo(locale)
    }

    logTaskBoundary(false, 'Translate blog')
  }

  private async translateTo(locale: LanguageCode) {
    const shopify = new Shopify()
    const blogsToTranslate = await shopify.translator('blog').getOutdatedTranslations(locale)
    console.log('🚀 ~ blogs to translate length:', blogsToTranslate.length)
    const chatGPT = new ChatGPT()

    for (const blog of blogsToTranslate) {
      console.log('============================')
      console.log('Id blog to translate => ', blog.id)
      const blogTranslated = await chatGPT.translate(blog, 'blog', locale)
      const responses = await shopify.translator('blog').updateTranslation({
        resourceToTranslate: blog,
        resourceTranslated: blogTranslated,
        isoCode: locale,
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
    console.log(`✅ Blogs translations updated to ${locale}`)
  }
}
