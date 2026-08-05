import crypto from 'crypto'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import NewsletterSubscriber from 'App/Models/NewsletterSubscriber'
import NewsletterState, { STATE_SES_LAST_EVENT_TS } from 'App/Models/NewsletterState'
import NewsletterConsent from './Consent'
import { emailHash, normalizeEmail } from './identity'
import { newsletterSecret } from './secret'

/**
 * Boucle de retour SES : rebonds et plaintes, livrés par SNS.
 *
 * ⛔ SANS CE CHEMIN, LE DISPOSITIF SE SUICIDE LENTEMENT. Les adresses mortes ne sont jamais
 * écartées, on leur réexpédie E2 et E3 pendant des années, le taux de rebond franchit les
 * 5 % tolérés par SES, et le compte est suspendu. Le tout sans qu'aucun écran n'ait jamais
 * rien montré d'anormal : une boucle de retour cassée se manifeste par une ABSENCE
 * d'événements, ce qui ressemble exactement à « tout va bien ».
 *
 * TROIS PIÈGES, chacun suffisant à tout casser en silence :
 *
 *   1. SNS POSTe son JSON avec `Content-Type: text/plain`. Or `config/bodyparser.ts` route
 *      `text/*` vers le parseur RAW : `request.body()` vaut `{}`. Il FAUT lire
 *      `await request.raw()` et parser soi-même.
 *   2. La charge SES est une CHAÎNE JSON dans le champ `Message` de l'enveloppe SNS —
 *      double analyse obligatoire.
 *   3. Un abonnement SNS reste en `PendingConfirmation` tant que l'endpoint n'a pas suivi le
 *      `SubscribeURL` d'un message `SubscriptionConfirmation`. Sans ce traitement, rien
 *      n'arrive JAMAIS, et personne ne s'en aperçoit.
 *
 * AUTHENTIFICATION, en trois couches — l'endpoint a autorité pour écrire `UNSUBSCRIBED` chez
 * Shopify et pour inscrire quelqu'un sur une liste repoussoir de trois ans :
 *
 *   a. jeton partagé dans l'URL (convention maison, cf. `EmailInboxController`) — OBLIGATOIRE,
 *      comparé à temps constant ;
 *   b. `TopicArn` comparé à une liste blanche — c'est ce qui arrête un message VALIDEMENT
 *      signé provenant d'un autre topic SNS, ce que la signature seule ne fait pas ;
 *   c. signature RSA de SNS, en défense en profondeur.
 *
 * ⚠️ Sur la couche (c), deux choix délibérés :
 *   • on branche sur `SignatureVersion` (1 = SHA1, 2 = SHA256). N'implémenter que SHA256
 *     rejetterait TOUS les rebonds légitimes des topics restés en version 1 — c'est-à-dire
 *     exactement la panne silencieuse qu'on cherche à éviter ;
 *   • si le certificat est INJOIGNABLE, on ACCEPTE en alertant (les couches a et b ont déjà
 *     tranché). Rejeter sur une panne réseau ferait perdre des rebonds, donc monter le taux,
 *     donc suspendre le compte. Une signature qui NE CORRESPOND PAS, elle, est rejetée.
 */
export default class SesFeedback {
  private consent = new NewsletterConsent()

  /** Jeton partagé attendu dans `?token=`. Vide = endpoint fermé (fail-closed). */
  public verifyToken(given: string | undefined): boolean {
    const expected = Env.get('SES_WEBHOOK_TOKEN')
    if (!expected) return false
    const a = Buffer.from(String(expected))
    const b = Buffer.from(String(given ?? ''))
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  }

  /** `TopicArn` autorisé ? Liste blanche via `SES_SNS_TOPIC_ARN` (séparateur virgule). */
  public verifyTopic(topicArn: unknown): boolean {
    const allowed = String(Env.get('SES_SNS_TOPIC_ARN') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    // Non configuré : on n'a rien à comparer. Le jeton reste la porte, et on le dit.
    if (!allowed.length) {
      Logger.warn('newsletter ses: SES_SNS_TOPIC_ARN non posé — le TopicArn n’est pas vérifié')
      return true
    }
    return allowed.includes(String(topicArn ?? ''))
  }

  /**
   * Hôte AWS légitime, en correspondance ANCRÉE.
   *
   * ⛔ Un test « se termine par amazonaws.com » est le contournement classique :
   * `https://sns.evil-amazonaws.com/…` et `https://sns.eu-west-1.amazonaws.com.attaquant.net/…`
   * le passent tous les deux. Suivre une URL fournie par un tiers depuis ce serveur, c'est
   * offrir une primitive SSRF sur le réseau Docker et sur le point de métadonnées DigitalOcean.
   */
  public isAwsSnsUrl(url: string): boolean {
    try {
      const parsed = new URL(String(url))
      return (
        parsed.protocol === 'https:' && /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(parsed.hostname)
      )
    } catch {
      return false
    }
  }

  /**
   * Traite une enveloppe SNS déjà analysée et déjà authentifiée par le contrôleur.
   * Ne lève jamais : SNS doit toujours recevoir 200 (un 5xx le fait retenter puis abandonner).
   */
  public async handleEnvelope(envelope: any): Promise<void> {
    await NewsletterState.write(STATE_SES_LAST_EVENT_TS, Math.floor(DateTime.now().toSeconds()))

    const type = String(envelope?.Type ?? '')

    if (type === 'SubscriptionConfirmation') {
      await this.confirmSubscription(envelope)
      return
    }

    if (type === 'UnsubscribeConfirmation') {
      // Quelqu'un vient de couper la boucle de retour. C'est une alerte, pas un événement.
      Logger.error(
        'newsletter ses: ⛔ le topic SNS vient d’être DÉSABONNÉ — plus aucun rebond ni plainte ne remontera'
      )
      return
    }

    if (type !== 'Notification') {
      Logger.info('newsletter ses: enveloppe de type %s ignorée', type || '(vide)')
      return
    }

    // Piège n°2 : la charge SES est une CHAÎNE JSON dans `Message`.
    let payload: any
    try {
      payload = JSON.parse(String(envelope.Message ?? '{}'))
    } catch {
      Logger.warn('newsletter ses: champ Message illisible')
      return
    }

    const kind = String(payload.notificationType ?? payload.eventType ?? '')

    if (kind === 'Bounce') return await this.handleBounce(payload)
    if (kind === 'Complaint') return await this.handleComplaint(payload)

    // Delivery / Send / Reject / DeliveryDelay / Open / Click : rien à faire, sinon prouver
    // que la chaîne est vivante — ce que l'horodatage ci-dessus a déjà fait.
  }

  /** Confirme l'abonnement SNS. Sans cette étape, l'abonnement reste en attente à jamais. */
  private async confirmSubscription(envelope: any): Promise<void> {
    const url = String(envelope?.SubscribeURL ?? '')
    if (!this.isAwsSnsUrl(url)) {
      Logger.error('newsletter ses: SubscribeURL non conforme, ignorée — %s', url.slice(0, 120))
      return
    }
    try {
      const res = await fetch(url, { method: 'GET' })
      Logger.info('newsletter ses: abonnement SNS confirmé (HTTP %s)', res.status)
    } catch (error) {
      Logger.error(
        'newsletter ses: confirmation d’abonnement impossible — %s',
        (error as any)?.message ?? error
      )
    }
  }

  /**
   * Rebond.
   *
   * ⛔ SEUL un rebond `Permanent` écarte l'adresse. Un `Transient` (boîte pleine, serveur
   * indisponible) ne doit RIEN supprimer : le traiter comme définitif tuerait des adresses
   * parfaitement valides.
   *
   * ⛔ ET ON N'ÉCRIT RIEN CHEZ SHOPIFY. `customerEmailMarketingConsentUpdate` n'accepte que
   * SUBSCRIBED / PENDING / UNSUBSCRIBED, et `UNSUBSCRIBED` signifie « s'était abonné puis
   * s'est retiré ». L'écrire sur un rebond falsifierait le registre de consentement et
   * empêcherait la personne de revenir si elle corrige son adresse. Un rebond arrête l'envoi,
   * il ne touche jamais au consentement.
   */
  private async handleBounce(payload: any): Promise<void> {
    const bounceType = String(payload?.bounce?.bounceType ?? '')
    if (bounceType !== 'Permanent') {
      Logger.info('newsletter ses: rebond %s ignoré (non définitif)', bounceType || '(inconnu)')
      return
    }

    const recipients: string[] = (payload?.bounce?.bouncedRecipients ?? [])
      .map((r: any) => r?.emailAddress)
      .filter(Boolean)

    for (const address of recipients) {
      await this.stop(address, 'bounced', 'hard_bounce')
    }
  }

  /**
   * Plainte pour spam.
   *
   * Ici, contrairement au rebond, on écrit BIEN `UNSUBSCRIBED` chez Shopify : c'est ce que
   * Shopify fait nativement lorsqu'un destinataire marque un message comme indésirable. Et
   * l'entrée sur la liste repoussoir est DÉFINITIVE — réécrire trois ans plus tard à
   * quelqu'un qui s'est plaint reste la meilleure façon de perdre le compte d'envoi.
   */
  private async handleComplaint(payload: any): Promise<void> {
    const recipients: string[] = (payload?.complaint?.complainedRecipients ?? [])
      .map((r: any) => r?.emailAddress)
      .filter(Boolean)

    for (const address of recipients) {
      const subscriber = await this.stop(address, 'complained', 'complaint')
      if (subscriber) await this.consent.pushUnsubscribed(subscriber)
    }
  }

  /** Arrêt de séquence + liste repoussoir. Commun au rebond dur et à la plainte. */
  private async stop(
    rawEmail: string,
    status: 'bounced' | 'complained',
    reason: 'hard_bounce' | 'complaint'
  ): Promise<NewsletterSubscriber | null> {
    const email = normalizeEmail(rawEmail)
    const hash = emailHash(email, newsletterSecret())
    const nowTs = Math.floor(DateTime.now().toSeconds())

    // La liste repoussoir D'ABORD : elle vaut même si aucun inscrit ne correspond (adresse
    // touchée par un autre canal, ou déjà effacée).
    await this.consent.suppress(hash, reason)
    await this.consent.recordProof({
      subscriberId: null,
      email,
      emailHash: hash,
      event: reason === 'complaint' ? 'complaint' : 'bounce',
    })

    const subscriber = await NewsletterSubscriber.findBy('email_hash', hash)
    if (!subscriber) {
      Logger.info('newsletter ses: %s sur une adresse hors séquence', reason)
      return null
    }

    subscriber.status = status
    if (status === 'bounced') subscriber.bouncedTs = nowTs
    else subscriber.complainedTs = nowTs
    subscriber.sequenceDone = true
    subscriber.sequenceStopReason = reason
    subscriber.nextEmail = null
    subscriber.nextEmailDueTs = null
    await subscriber.save()

    Logger.warn('newsletter #%s: séquence arrêtée (%s)', subscriber.id, reason)
    return subscriber
  }
}
