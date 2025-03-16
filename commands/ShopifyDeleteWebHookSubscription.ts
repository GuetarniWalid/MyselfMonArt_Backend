import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class ShopifyDeleteWebHookSubscription extends BaseCommand {
  public static commandName = 'shopify:delete_web_hook_subscription'
  public static description = 'Delete a web hook subscription'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()
    const { userErrors } = await shopify.webhook.deleteWebhookSubscription(
      'gid://shopify/WebhookSubscription/1817565200731'
    )

    if (userErrors.length > 0) {
      console.log('🚀 ~ Web hook subscription not deleted')
      console.log('🚀 ~ ', userErrors)
    } else {
      console.log('🚀 ~ Web hook subscription deleted')
    }
  }
}
