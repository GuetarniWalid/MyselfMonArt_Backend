import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class ShopifyCreateDeleteWebhookSubscription extends BaseCommand {
  public static commandName = 'shopify:create_delete_webhook_subscription'
  public static description = 'Create a webhook subscription for products/delete events'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()

    console.log('🔧 Creating PRODUCTS_DELETE webhook subscription...')

    const webhook = await shopify.webhook.createWebhookSubscription('PRODUCTS_DELETE', [])

    console.log('✅ Webhook subscription created successfully!')
    console.log('📋 Details:', webhook)
  }
}
