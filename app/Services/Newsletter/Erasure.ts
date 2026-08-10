import Logger from '@ioc:Adonis/Core/Logger'
import Database from '@ioc:Adonis/Lucid/Database'
import { DateTime } from 'luxon'
import NewsletterConsentEvent from 'App/Models/NewsletterConsentEvent'
import NewsletterSend from 'App/Models/NewsletterSend'
import NewsletterSubscriber from 'App/Models/NewsletterSubscriber'
import NewsletterConsent from './Consent'
import { emailHash, normalizeEmail } from './identity'
import { newsletterSecret } from './secret'
import { PII_RETENTION_YEARS } from './config'

/**
 * Effacement (art. 17) et accès (art. 15) — et purge AUTOMATIQUE de rétention.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE. Les trois webhooks de conformité de Shopify
 * (`customers/data_request`, `customers/redact`, `shop/redact`) ne sont PAS souscriptibles
 * pour une app créée depuis l'admin : ils sont réservés aux apps distribuées par le Partner
 * Dashboard. Aucun endpoint ne leur est donc exposé — les écrire donnerait l'illusion d'une
 * conformité automatique alors que Shopify ne les appellerait jamais. Le jour où l'app sera
 * recréée en distribution « custom » depuis le Partner Dashboard, il faudra les ajouter ET
 * garder ce module : lui seul couvre la purge de rétention, qu'aucun webhook ne déclenche.
 *
 * Sans ce module, le dispositif n'aurait donc AUCUN chemin d'effacement opérant, et
 * accumulerait des adresses e-mail et des adresses IP indéfiniment — une infraction directe
 * au principe de limitation de la conservation (art. 5(1)(e)). Trois entrées :
 *
 *   • `node ace newsletter:erase <email>`   — sur demande d'une personne ;
 *   • `node ace newsletter:export <email>`  — droit d'accès ;
 *   • `purgeExpired()`                      — automatique, appelée par le cron.
 *
 * ⛔ ORDRE DES OPÉRATIONS : on inscrit D'ABORD l'empreinte sur la liste repoussoir, ENSUITE
 * on efface l'adresse. L'inverse rendrait la personne recontactable dès sa prochaine
 * apparition dans l'encart — effacer sa trace ET lui réécrire, le pire des deux mondes.
 */
export default class NewsletterErasure {
  private consent = new NewsletterConsent()

  /**
   * Efface les données personnelles d'une adresse, en conservant le squelette anonyme.
   *
   * Ce qui RESTE, et pourquoi : l'empreinte (pour ne plus jamais écrire à cette personne),
   * l'événement, son horodatage, le libellé de consentement, la version des mentions et la
   * finalité. Cela démontre qu'un consentement a existé (art. 7(1)) sans identifier
   * quiconque. Ce qui PART : l'adresse, l'IP, l'agent utilisateur, la page d'origine.
   */
  public async erase(rawEmail: string): Promise<{ found: boolean; subscriberId: number | null }> {
    const email = normalizeEmail(rawEmail)
    const hash = emailHash(email, newsletterSecret())

    const subscriber = await NewsletterSubscriber.findBy('email', email)

    // 1. La liste repoussoir D'ABORD. Si la personne s'était plainte, l'entrée est
    //    définitive et ne doit pas être rétrogradée par cet effacement.
    await this.consent.suppress(hash, subscriber?.status === 'complained' ? 'complaint' : 'redact')

    // 2. Le journal de preuve : on anonymise, on ne supprime pas la ligne.
    await Database.from('newsletter_consent_events')
      .where('email_hash', hash)
      .update({ email: null, ip: null, user_agent: null, source_url: null })

    if (!subscriber) {
      Logger.info('newsletter erase: aucune inscription pour cette adresse (empreinte posée)')
      return { found: false, subscriberId: null }
    }

    // 3. L'inscrit : l'adresse part, l'empreinte et l'historique d'envoi restent.
    subscriber.email = null
    subscriber.status = 'redacted'
    subscriber.sequenceDone = true
    subscriber.sequenceStopReason = 'redacted'
    subscriber.nextEmail = null
    subscriber.nextEmailDueTs = null
    subscriber.discountCode = null
    subscriber.discountGid = null
    subscriber.shopifyCustomerId = null
    subscriber.shopifySyncPending = false
    subscriber.shopifySyncError = null
    await subscriber.save()

    Logger.info('newsletter erase: inscrit #%s effacé', subscriber.id)
    return { found: true, subscriberId: subscriber.id }
  }

  /** Droit d'accès (art. 15) : tout ce que le back-end détient sur une adresse. */
  public async export(rawEmail: string): Promise<Record<string, unknown>> {
    const email = normalizeEmail(rawEmail)
    const hash = emailHash(email, newsletterSecret())

    const subscriber = await NewsletterSubscriber.findBy('email', email)
    const events = await NewsletterConsentEvent.query()
      .where('email_hash', hash)
      .orderBy('id', 'asc')
    const sends = subscriber
      ? await NewsletterSend.query().where('subscriber_id', subscriber.id).orderBy('id', 'asc')
      : []
    const suppression = await Database.from('newsletter_suppressions')
      .where('email_hash', hash)
      .first()

    return {
      generatedAt: DateTime.now().toISO(),
      subscriber: subscriber ? subscriber.toJSON() : null,
      consentEvents: events.map((e) => e.toJSON()),
      sends: sends.map((s) => s.toJSON()),
      suppression: suppression ?? null,
    }
  }

  /**
   * Purge de rétention — automatique, appelée par le cron quotidien.
   *
   * Efface les données personnelles au-delà de la durée de conservation, sur les inscrits
   * dont la séquence est close depuis longtemps. Le squelette anonyme, lui, reste : il ne
   * pèse rien et il est la seule preuve qu'un consentement a existé.
   */
  public async purgeExpired(): Promise<number> {
    const cutoffTs = Math.floor(DateTime.now().minus({ years: PII_RETENTION_YEARS }).toSeconds())

    const stale = await NewsletterSubscriber.query()
      .whereNotNull('email')
      .where('sequence_done', true)
      .where('sequence_started_ts', '<', cutoffTs)
      .limit(500)

    let done = 0
    for (const subscriber of stale) {
      try {
        await this.erase(subscriber.email!)
        done++
      } catch (error) {
        Logger.warn(
          'newsletter purge: inscrit #%s non purgé — %s',
          subscriber.id,
          (error as any)?.message ?? error
        )
      }
    }

    // Journal de preuve orphelin (aucun inscrit correspondant) : même durée, même règle.
    const anonymised = await Database.from('newsletter_consent_events')
      .whereNotNull('email')
      .where('occurred_ts', '<', cutoffTs)
      .update({ email: null, ip: null, user_agent: null, source_url: null })

    // Liste repoussoir : on retire les entrées EXPIRÉES. Les plaintes ont `expires_ts` nul
    // et ne sont donc jamais concernées — réécrire trois ans plus tard à quelqu'un qui s'est
    // plaint reste la meilleure façon de perdre le compte d'envoi.
    const nowTs = Math.floor(DateTime.now().toSeconds())
    await Database.from('newsletter_suppressions')
      .whereNotNull('expires_ts')
      .where('expires_ts', '<', nowTs)
      .delete()

    if (done || anonymised) {
      Logger.info(
        'newsletter purge: %s inscrit(s) effacé(s), %s preuve(s) anonymisée(s)',
        done,
        anonymised
      )
    }
    return done
  }
}
