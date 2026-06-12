import { BaseCommand } from '@adonisjs/core/build/standalone'
import Env from '@ioc:Adonis/Core/Env'
import Shopify from 'App/Services/Shopify'

/**
 * Enregistrement IDEMPOTENT du webhook orders/paid (M9, plan §9) :
 *   1. lit les abonnements existants (webhookSubscriptions, lecture seule) ;
 *   2. si ORDERS_PAID pointe déjà vers SHOPIFY_WEBHOOK_URL -> ne touche à rien ;
 *   3. sinon crée l'abonnement (webhookSubscriptionCreate — la seule mutation
 *      Shopify de la mission M9) et logue clairement ce qui a été fait.
 *
 * Usage : node ace custom_art:register_orders_paid_webhook
 */
export default class CustomArtRegisterOrdersPaidWebhook extends BaseCommand {
  public static commandName = 'custom_art:register_orders_paid_webhook'
  public static description =
    "Vérifie/crée l'abonnement webhook orders/paid vers le backend (idempotent)"

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    const callbackUrl = Env.get('SHOPIFY_WEBHOOK_URL')
    if (!callbackUrl) {
      this.logger.error('SHOPIFY_WEBHOOK_URL absent du .env — abandon.')
      return
    }

    const shopify = new Shopify()

    // 1) Lecture seule : l'abonnement existe-t-il déjà ?
    this.logger.info('Lecture des abonnements webhook existants…')
    const subscriptions = await shopify.webhook.getSubscriptions()
    const ordersPaid = subscriptions.filter((s: any) => s.node?.topic === 'ORDERS_PAID')

    const existing = ordersPaid.find((s: any) => s.node?.endpoint?.callbackUrl === callbackUrl)
    if (existing) {
      this.logger.success(
        `Déjà en place : ORDERS_PAID -> ${callbackUrl} (id ${existing.node.id}) — aucune mutation.`
      )
      return
    }

    if (ordersPaid.length > 0) {
      // ORDERS_PAID existe mais pointe ailleurs (autre app/URL) : on n'y touche pas,
      // on crée NOTRE abonnement (Shopify accepte plusieurs abonnements par topic).
      for (const s of ordersPaid) {
        this.logger.warning(
          `ORDERS_PAID existant vers une autre cible : ${s.node?.endpoint?.callbackUrl || s.node?.endpoint?.arn || '?'} (id ${s.node?.id}) — conservé tel quel.`
        )
      }
    }

    // 2) Création (unique mutation autorisée de la mission M9)
    this.logger.info(`Création de l'abonnement ORDERS_PAID -> ${callbackUrl}…`)
    const created = await shopify.webhook.createWebhookSubscription('ORDERS_PAID')
    if (!created?.id) {
      this.logger.error('Réponse inattendue de webhookSubscriptionCreate (pas d’id).')
      return
    }
    this.logger.success(
      `Abonnement créé : ORDERS_PAID -> ${callbackUrl} (id ${created.id}, format ${created.format}, API ${created.apiVersion?.handle}).`
    )
  }
}
