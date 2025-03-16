import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class ShopifyCreateWebHookSubscription extends BaseCommand {
  public static commandName = 'shopify:create_web_hook_subscription'
  public static description = 'Create a web hook subscription'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()
    const webhook = await shopify.webhook.createWebhookSubscription('PRODUCTS_UPDATE', [
      'meta_object',
    ])

    console.log('🚀 ~ Web hook subscription created')
    console.log('🚀 ~ ', webhook)
  }
}
