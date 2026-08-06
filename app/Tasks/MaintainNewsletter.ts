import Logger from '@ioc:Adonis/Core/Logger'
import { BaseTask, CronTimeV2 } from 'adonis5-scheduler/build/src/Scheduler/Task'
import Shopify from 'App/Services/Shopify'
import NewsletterErasure from 'App/Services/Newsletter/Erasure'
import NewsletterHealth from 'App/Services/Newsletter/Health'
import NewsletterMarkets from 'App/Services/Newsletter/Markets'
import NewsletterRates from 'App/Services/Newsletter/Rates'

/**
 * Entretien quotidien de la newsletter. Quatre travaux, du plus au moins urgent.
 *
 * ⛔ LE PREMIER EST LE PLUS IMPORTANT, ET C'EST LE MOINS ÉVIDENT — la réconciliation des
 * abonnements webhook.
 *
 * Shopify SUPPRIME définitivement un abonnement après 8 échecs consécutifs en 4 heures. Une
 * indisponibilité de quatre heures détruit donc `ORDERS_PAID` : le service revient, tout
 * paraît normal, et E2 comme E3 partent désormais à des gens QUI VIENNENT D'ACHETER. Panne
 * parfaitement silencieuse, et exactement le message qui déclenche une plainte.
 *
 * 05:45 : après la rotation du code promo (05:15), avant l'heure de bureau.
 */
export default class MaintainNewsletter extends BaseTask {
  public static get schedule() {
    return CronTimeV2.everyDayAt(5, 45)
  }

  public static get useLock() {
    return true
  }

  public async handle() {
    await this.reconcileWebhooks()

    // Taux de change et table des marchés : rafraîchis ICI pour que le chemin d'inscription
    // trouve toujours un cache chaud. L'encart doit répondre en moins de 2 secondes — il ne
    // doit jamais être le premier à découvrir que la BCE est lente. Les deux échouent en
    // silence utile : le dernier état connu reste en place (cf. `Rates.ts` et `Markets.ts`).
    await new NewsletterRates().refresh()
    await new NewsletterMarkets().refresh()

    const health = new NewsletterHealth()

    // Rejeu des propagations Shopify en attente (désabonnements en tête).
    try {
      const done = await health.retryPendingSync()
      if (done) Logger.info('newsletter: %s synchronisation(s) Shopify rattrapée(s)', done)
    } catch (error) {
      Logger.error('newsletter: rejeu de synchronisation en échec — %s', (error as any)?.message)
    }

    // Sondes de santé : transforment un silence en alerte.
    try {
      await health.check()
    } catch (error) {
      Logger.error('newsletter: sondes de santé en échec — %s', (error as any)?.message)
    }

    // Purge de rétention (RGPD) : les webhooks de conformité de Shopify ne sont pas
    // souscriptibles pour une app créée depuis l'admin, cette purge est donc le SEUL chemin
    // d'effacement automatique du dispositif.
    try {
      await new NewsletterErasure().purgeExpired()
    } catch (error) {
      Logger.error('newsletter: purge de rétention en échec — %s', (error as any)?.message)
    }
  }

  /**
   * Recrée les abonnements webhook manquants. Idempotent : « existe déjà » n'est pas un
   * échec, on ne recrée que ce qui manque vraiment.
   */
  private async reconcileWebhooks(): Promise<void> {
    const REQUIRED: Array<'ORDERS_PAID'> = ['ORDERS_PAID']

    try {
      const shopify = new Shopify()
      const edges = await shopify.webhook.getSubscriptions()
      const present = new Set<string>(
        (edges ?? []).map((edge: any) => String(edge?.node?.topic ?? ''))
      )

      for (const topic of REQUIRED) {
        if (present.has(topic)) continue
        Logger.error(
          'newsletter: l’abonnement webhook %s avait DISPARU (8 échecs en 4 h ?) — recréation',
          topic
        )
        await shopify.webhook.createWebhookSubscription(topic)
      }
    } catch (error) {
      // Jamais bloquant : le reste de l'entretien doit tourner, et on réessaiera demain.
      // Ce n'est de toute façon qu'une optimisation : la porte d'avant-envoi vérifie la
      // conversion en interrogeant l'API, sans jamais dépendre d'un webhook.
      Logger.warn(
        'newsletter: réconciliation des webhooks impossible — %s',
        (error as any)?.message ?? error
      )
    }
  }
}
