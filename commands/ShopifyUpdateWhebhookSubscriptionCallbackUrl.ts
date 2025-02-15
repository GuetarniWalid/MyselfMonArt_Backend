import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
import Env from '@ioc:Adonis/Core/Env'

export default class ShopifyUpdateWhebhookSubscriptionCallbackUrl extends BaseCommand {
  public static commandName = 'shopify:update_whebhook_subscription_callback_url'
  public static description = 'Update the webhook subscription callback url'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const shopify = new Shopify()
    const { userErrors, webhookSubscription } = await shopify.webhook.updateSubscription(
      'gid://shopify/WebhookSubscription/1812084425051',
      Env.get('SHOPIFY_WEBHOOK_URL')
    )
    console.log(userErrors)
    console.log(webhookSubscription)
  }
}
