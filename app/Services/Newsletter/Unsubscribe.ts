import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import NewsletterSubscriber from 'App/Models/NewsletterSubscriber'
import NewsletterConsent from './Consent'
import { verifyUnsubToken } from './identity'
import { newsletterSecret } from './secret'

/**
 * Désabonnement — traité comme une FONCTIONNALITÉ DE PREMIER PLAN, pas comme une mention
 * légale.
 *
 * C'est ce qui protège le compte d'envoi. Un lecteur qui veut partir et ne trouve pas le
 * bouton clique sur « signaler comme spam ». À 120 envois par semaine, une seule plainte
 * représente 0,83 % là où SES exige moins de 0,08 % — et la sanction n'est pas de tomber en
 * indésirables, c'est que plus rien ne parte, en silence, séquences en cours comprises.
 */
export default class NewsletterUnsubscribe {
  private consent = new NewsletterConsent()

  /** Retrouve l'inscrit derrière un jeton. `null` si le jeton ne correspond à rien. */
  public async resolve(token: string): Promise<NewsletterSubscriber | null> {
    const clean = String(token ?? '').trim()
    if (!clean || clean.length > 64) return null

    const subscriber = await NewsletterSubscriber.findBy('unsub_token', clean)
    if (!subscriber) return null

    // Ceinture par-dessus les bretelles : la recherche par index a déjà tranché, mais on
    // revérifie le HMAC à temps constant au cas où une ligne aurait été altérée ou recopiée.
    if (!verifyUnsubToken(subscriber.id, clean, newsletterSecret())) {
      Logger.warn('newsletter: jeton de désabonnement non conforme pour #%s', subscriber.id)
      return null
    }

    return subscriber
  }

  /**
   * Désabonne. IDEMPOTENT : rappeler cette méthode sur quelqu'un de déjà parti ne fait rien
   * et répond « c'est fait » — Gmail et Yahoo peuvent rejouer leur POST un-clic.
   *
   * ⛔ ÉCRITURE EN AVANCE LOCALE. On bloque D'ABORD en base, de façon synchrone, ET SEULEMENT
   * ENSUITE on propage vers Shopify. C'est le seul endroit du dispositif où « Shopify seule
   * vérité » serait strictement moins sûr qu'un registre local : sans cette avance, une
   * indisponibilité de Shopify perdrait la désinscription, et le cron — qui relit Shopify —
   * continuerait d'envoyer en toute bonne foi à quelqu'un qui a explicitement demandé
   * l'arrêt.
   */
  public async unsubscribe(
    subscriber: NewsletterSubscriber,
    context: { ip?: string | null; userAgent?: string | null; source: string }
  ): Promise<void> {
    if (subscriber.status === 'unsubscribed') return

    // --- 1. BLOCAGE LOCAL, synchrone, avant toute chose ----------------------------
    await this.blockLocally(subscriber, context, true)

    // --- 2. Propagation vers Shopify, APRÈS ----------------------------------------
    // Un échec ici laisse `shopifySyncPending` à vrai et le cron rejouera. La personne, elle,
    // ne reçoit déjà plus rien : le blocage local suffit à tenir la promesse.
    await this.consent.pushUnsubscribed(subscriber)
  }

  /**
   * Désabonnement dont SHOPIFY EST L'ORIGINE — page de désabonnement native, admin, compte
   * client — appris par le webhook de consentement.
   *
   * Même blocage local que ci-dessus, à une différence près et elle compte : **aucune
   * propagation retour**, et `shopifySyncPending` reste à faux. Repousser vers Shopify un état
   * qui en vient déjà ferait rejouer le cron de synchronisation indéfiniment sur une écriture
   * sans effet, et ferait remonter une fausse alerte de non-réconciliation au bout de 6 h.
   *
   * IDEMPOTENT : Shopify livre « au moins une fois », donc ce webhook arrive parfois deux fois.
   */
  public async unsubscribeFromShopify(
    subscriber: NewsletterSubscriber,
    marketingState: string
  ): Promise<void> {
    if (subscriber.status === 'unsubscribed') return

    await this.blockLocally(subscriber, { source: `shopify:${marketingState}` }, false)
  }

  /**
   * Le blocage local, commun aux deux chemins.
   *
   * `pendingSync` dit s'il reste quelque chose à pousser vers Shopify : vrai quand la demande
   * vient de chez nous, faux quand elle vient de chez eux.
   */
  private async blockLocally(
    subscriber: NewsletterSubscriber,
    context: { ip?: string | null; userAgent?: string | null; source: string },
    pendingSync: boolean
  ): Promise<void> {
    subscriber.status = 'unsubscribed'
    subscriber.unsubscribedTs = Math.floor(DateTime.now().toSeconds())
    subscriber.sequenceDone = true
    subscriber.sequenceStopReason = 'unsubscribed'
    subscriber.nextEmail = null
    subscriber.nextEmailDueTs = null
    subscriber.shopifySyncPending = pendingSync
    await subscriber.save()

    await this.consent.recordProof({
      subscriberId: subscriber.id,
      email: subscriber.email,
      emailHash: subscriber.emailHash,
      event: 'unsubscribe',
      ip: context.ip,
      userAgent: context.userAgent,
      sourceUrl: context.source,
      locale: subscriber.locale,
    })

    // Liste repoussoir : une future soumission de la même adresse dans l'encart s'arrêtera
    // avant le moindre appel Shopify, avant la moindre remise créée.
    await this.consent.suppress(subscriber.emailHash, 'unsubscribe')

    Logger.info('newsletter #%s désabonné (%s)', subscriber.id, context.source)
  }
}
