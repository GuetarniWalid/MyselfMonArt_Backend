import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
export default class ShopifyGetWebhookSubscriptions extends BaseCommand {
  public static commandName = 'shopify:get_webhook_subscriptions'
  public static description = 'Get all webhook subscriptions for the current shop'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()
    const webhookSubscriptions = await shopify.webhook.getSubscriptions()
    webhookSubscriptions.forEach((subscription) => {
      console.log(subscription.node)
    })
  }
}
