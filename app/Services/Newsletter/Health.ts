import Logger from '@ioc:Adonis/Core/Logger'
import Database from '@ioc:Adonis/Lucid/Database'
import { DateTime } from 'luxon'
import NewsletterSubscriber from 'App/Models/NewsletterSubscriber'
import NewsletterState, {
  STATE_SES_FEEDBACK_ALERTED_TS,
  STATE_SES_LAST_EVENT_TS,
  STATE_SYNC_ALERTED_TS,
} from 'App/Models/NewsletterState'
import NewsletterAlertMailer from './AlertMailer'
import NewsletterConsent from './Consent'
import { SES_FEEDBACK_SILENCE_DAYS, SYNC_ALERT_AFTER_HOURS } from './config'

/** Une alerte identique ne se répète pas avant ce délai — une alarme qui hurle n'est plus lue. */
const ALERT_COOLDOWN_HOURS = 24

/**
 * Surveillance de ce qui, sinon, casserait EN SILENCE.
 *
 * Le dispositif est conçu pour se dégrader vers « n'envoie rien » plutôt que vers « envoie
 * n'importe quoi ». C'est le bon choix, mais il a une conséquence : une panne ressemble à du
 * calme. Trois sondes transforment ce silence en alerte.
 */
export default class NewsletterHealth {
  private mailer = new NewsletterAlertMailer()
  private consent = new NewsletterConsent()

  public async check(): Promise<void> {
    await this.checkSesFeedback()
    await this.checkShopifySync()
  }

  /**
   * SONDE 1 — la boucle de retour SES est-elle vivante ?
   *
   * Des e-mails partent, mais aucun accusé (remise, rebond, plainte) ne revient : la chaîne
   * SES → configuration set → SNS → abonnement → endpoint est rompue quelque part. Sans
   * cette sonde, on continuerait d'écrire à des adresses mortes jusqu'à la suspension.
   */
  private async checkSesFeedback(): Promise<void> {
    const now = DateTime.now()
    const silenceCutoff = Math.floor(now.minus({ days: SES_FEEDBACK_SILENCE_DAYS }).toSeconds())

    // A-t-on seulement envoyé quelque chose ? Sans envois, l'absence de retour est normale.
    const sentRows = await Database.from('newsletter_sends')
      .where('status', 'sent')
      .where('sent_ts', '>', silenceCutoff)
      .count('* as total')
    const sentRecently = Number(sentRows?.[0]?.total ?? 0)
    if (sentRecently === 0) return

    const lastEvent = await NewsletterState.readNumber(STATE_SES_LAST_EVENT_TS)
    if (lastEvent !== null && lastEvent > silenceCutoff) return

    if (!(await this.shouldAlert(STATE_SES_FEEDBACK_ALERTED_TS))) return

    await this.mailer.send('boucle de retour SES muette', [
      `Aucun événement SES reçu depuis ${SES_FEEDBACK_SILENCE_DAYS} jours,`,
      `alors que ${sentRecently} e-mail(s) sont partis sur la même période.`,
      '',
      'Autrement dit : les rebonds et les plaintes ne remontent plus. Les adresses mortes',
      'ne sont plus écartées, et le taux de rebond monte sans que rien ne l’arrête.',
      '',
      'À vérifier, dans cet ordre :',
      '  1. AWS > SES > Configuration sets : le jeu nommé dans SES_CONFIGURATION_SET existe-t-il',
      '     encore, et a-t-il bien une destination d’événements SNS (Bounce + Complaint) ?',
      '  2. AWS > SNS > Subscriptions : l’abonnement HTTPS est-il « Confirmed » et non',
      '     « PendingConfirmation » ?',
      '  3. L’URL de l’abonnement pointe-t-elle toujours vers /webhooks/ses avec le bon ?token= ?',
      '',
      `Dernier événement reçu : ${lastEvent ? DateTime.fromSeconds(lastEvent).toISO() : 'jamais'}`,
    ])
  }

  /**
   * SONDE 2 — les écritures vers Shopify passent-elles encore ?
   *
   * Un désabonnement est bloqué LOCALEMENT dès la seconde où il arrive, donc plus rien ne
   * part à cette personne quoi qu'il advienne. Mais si la propagation vers Shopify reste
   * bloquée, le registre de consentement du marchand devient faux — et c'est lui qui fait foi
   * pour tous les autres outils.
   */
  private async checkShopifySync(): Promise<void> {
    const cutoff = DateTime.now().minus({ hours: SYNC_ALERT_AFTER_HOURS })

    const stuck = await NewsletterSubscriber.query()
      .where('shopify_sync_pending', true)
      .where('updated_at', '<', cutoff.toSQL()!)
      .limit(50)

    if (!stuck.length) return
    if (!(await this.shouldAlert(STATE_SYNC_ALERTED_TS))) return

    const worst = stuck[0]
    await this.mailer.send('synchronisation Shopify bloquée', [
      `${stuck.length} inscrit(s) attendent d’être synchronisés avec Shopify depuis plus de`,
      `${SYNC_ALERT_AFTER_HOURS} heures.`,
      '',
      'Les envois, eux, sont SUSPENDUS (la porte d’avant-envoi reporte plutôt que d’envoyer',
      'sur un doute) : rien de faux n’est parti. Mais le registre de consentement côté Shopify',
      'n’est plus à jour.',
      '',
      `Dernière erreur : ${worst.shopifySyncError ?? '(aucune)'}`,
      '',
      'Si l’erreur mentionne un ACCÈS REFUSÉ, c’est le point du §2 : l’accès aux données',
      'client protégées a été révoqué. La parade est de recréer l’app en distribution',
      '« custom » depuis le Partner Dashboard — jamais de changer de plan Shopify.',
    ])
  }

  /** Rejoue une propagation Shopify en attente. Appelé par le cron, borné par passage. */
  public async retryPendingSync(limit = 25): Promise<number> {
    const pending = await NewsletterSubscriber.query()
      .where('shopify_sync_pending', true)
      .orderBy('updated_at', 'asc')
      .limit(limit)

    let done = 0
    for (const subscriber of pending) {
      try {
        const ok =
          subscriber.status === 'unsubscribed' || subscriber.status === 'complained'
            ? await this.consent.pushUnsubscribed(subscriber)
            : await this.consent.pushSubscribed(subscriber)
        if (ok) done++
      } catch (error) {
        Logger.warn(
          'newsletter sync: rejeu #%s en échec — %s',
          subscriber.id,
          (error as any)?.message ?? error
        )
      }
    }
    return done
  }

  /** Verrou anti-spam : une même alerte au plus une fois par jour. */
  private async shouldAlert(key: string): Promise<boolean> {
    const last = await NewsletterState.readNumber(key)
    const nowTs = Math.floor(DateTime.now().toSeconds())
    if (last !== null && nowTs - last < ALERT_COOLDOWN_HOURS * 3600) return false
    await NewsletterState.write(key, nowTs)
    return true
  }
}
