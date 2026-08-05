import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import Database from '@ioc:Adonis/Lucid/Database'
import Shopify from 'App/Services/Shopify'
import NewsletterSubscriber from 'App/Models/NewsletterSubscriber'
import NewsletterConsentEvent from 'App/Models/NewsletterConsentEvent'
import NewsletterConsent from './Consent'
import NewsletterVoucher from './Voucher'
import { emailHash, normalizeEmail, normalizeLocale, unsubToken } from './identity'
import { newsletterSecret } from './secret'
import {
  MAX_SUBSCRIBES_PER_EMAIL_PER_DAY,
  PURPOSE,
  SUBSCRIBABLE_PRIOR_STATES,
  TERMS_VERSION,
} from './config'
import type { NewsletterLocale } from './config'

export interface SubscribeInput {
  email: string
  locale?: string
  sourceUrl?: string
  consent: boolean
  consentLabel?: string
  ip?: string | null
  userAgent?: string | null
}

export type SubscribeState = 'subscribed' | 'already' | 'refused'

export interface SubscribeOutcome {
  ok: boolean
  state?: SubscribeState
  code?: string
  expiresAt?: string
  error?: string
}

/**
 * Inscription à la séquence du bon de 15 €.
 *
 * ORDRE DES OPÉRATIONS — il ne s'inverse jamais, et chaque position est payée par un risque
 * précis :
 *
 *   1. Validation, consentement coché, normalisation.
 *   2. LISTE REPOUSSOIR — court-circuit avant toute dépense.
 *   3. LECTURE DU CONSENTEMENT CHEZ SHOPIFY, sans rien écrire (§4 ci-dessous).
 *   4. Écriture de la PREUVE, avant toute mutation Shopify.
 *   5. Création du CODE NOMINATIF (synchrone : il doit figurer dans la réponse).
 *   6. `customerSet` + consentement — un échec ici ne fait PAS échouer l'inscription.
 *   7. Réponse au thème, puis E1 armé.
 *
 * ⛔ POURQUOI L'ÉTAPE 3 EXISTE, ET POURQUOI ELLE EST AVANT L'ÉTAPE 6.
 *
 * L'encart est public et non authentifié : n'importe qui peut y saisir l'adresse de
 * n'importe qui. Écrire `SUBSCRIBED` sans avoir lu l'état précédent RESSUSCITE quiconque
 * s'était désabonné — il reçoit une offre commerciale après avoir demandé à ne plus en
 * recevoir. C'est le geste qui produit une plainte, et une plainte représente ici dix fois le
 * seuil contractuel de SES : suspension du compte, arrêt silencieux de tout le canal.
 *
 * Et la lecture doit précéder `customerSet`, pas le suivre : `customerSet` créerait déjà une
 * fiche client (et écraserait `locale`) pour une adresse qu'on s'apprête à refuser.
 *
 * ⛔ La protection des ~750 dormants ne repose donc PAS seulement sur l'absence de ligne
 * locale — cette ligne, c'est précisément cet endpoint qui la crée. Elle repose sur la
 * conjonction : liste blanche d'états + liste repoussoir + preuve horodatée par adresse.
 */
export default class NewsletterSubscribe {
  private shopify = new Shopify()
  private consent = new NewsletterConsent()
  private voucher = new NewsletterVoucher()

  public async handle(input: SubscribeInput): Promise<SubscribeOutcome> {
    const email = normalizeEmail(input.email)
    const locale = normalizeLocale(input.locale)
    const secret = newsletterSecret()
    const hash = emailHash(email, secret)

    if (!input.consent) return { ok: false, error: 'consent_required' }

    // --- Étape 2 : liste repoussoir ------------------------------------------------
    // Avant toute dépense : pas d'appel Shopify, pas de remise créée, pas d'e-mail.
    if (await this.consent.isSuppressed(hash)) {
      Logger.info('newsletter subscribe: adresse sur liste repoussoir, refus silencieux')
      return { ok: true, state: 'refused' }
    }

    // Ligne existante : ré-inscription, ou simple double soumission du formulaire.
    const existing = await NewsletterSubscriber.findBy('email', email)

    if (existing) {
      const replay = await this.replay(existing, input, locale, hash)
      if (replay) return replay
    }

    // --- Garde de débit par ADRESSE (le throttle par IP est posé par le middleware) ---
    // Compté sur le journal de preuve, qui est append-only : rien ne peut le remettre à zéro,
    // pas même un redémarrage — contrairement au compteur en mémoire du middleware.
    if (await this.tooManyAttempts(hash)) {
      return { ok: false, error: 'rate_limited' }
    }

    // --- Étape 3 : LECTURE avant écriture ------------------------------------------
    let prior: string | null = null
    try {
      const found = await this.shopify.customer.findConsentByEmail(email)
      prior = found?.marketingState ?? null

      // Liste BLANCHE, jamais une liste noire : une valeur inconnue (Shopify enrichira cet
      // énuméré au fil des ans) ne doit jamais être lue comme « on peut y aller ».
      if (prior !== null && !(SUBSCRIBABLE_PRIOR_STATES as readonly string[]).includes(prior)) {
        await this.consent.recordProof({
          subscriberId: null,
          email,
          emailHash: hash,
          event: 'subscribe',
          ip: input.ip,
          userAgent: input.userAgent,
          sourceUrl: input.sourceUrl,
          consentLabel: input.consentLabel,
          termsVersion: TERMS_VERSION,
          locale,
        })
        await this.stampPriorState(hash, prior)

        // On mémorise le refus pour que les soumissions suivantes s'arrêtent à l'étape 2,
        // sans même interroger Shopify.
        await this.consent.suppress(hash, 'unsubscribe')

        Logger.info('newsletter subscribe: refus, état Shopify préalable = %s', prior)
        return { ok: true, state: 'refused' }
      }
    } catch (error) {
      // ⛔ On NE POURSUIT PAS à l'aveugle. Ne pas savoir dans quel état est cette adresse est
      // exactement le cas où écrire `SUBSCRIBED` peut ressusciter un désabonné. Une panne
      // d'API doit coûter une inscription ratée, jamais une plainte.
      Logger.error(
        'newsletter subscribe: lecture du consentement impossible — %s',
        (error as any)?.message ?? error
      )
      return { ok: false, error: 'temporarily_unavailable' }
    }

    // --- Étape 4 : la preuve, AVANT toute mutation ---------------------------------
    const now = DateTime.now()
    const nowTs = Math.floor(now.toSeconds())

    let subscriber: NewsletterSubscriber
    try {
      subscriber = await NewsletterSubscriber.create({
        email,
        emailHash: hash,
        locale,
        purpose: PURPOSE,
        status: 'active',
        sequenceStartedTs: nowTs,
        sequenceDone: false,
        nextEmail: 1,
        // E1 est dû immédiatement.
        nextEmailDueTs: nowTs,
        // Jeton provisoire : l'identifiant n'existe qu'après l'insertion. Remplacé juste
        // après. La colonne est UNIQUE et NOT NULL, elle ne peut pas rester vide.
        unsubToken: unsubToken(-nowTs, secret),
        shopifySyncPending: true,
        shopifySyncAttempts: 0,
      })
    } catch (error) {
      // Course perdue contre une soumission simultanée : la contrainte UNIQUE a tranché.
      const raced = await NewsletterSubscriber.findBy('email', email)
      if (raced) {
        const replay = await this.replay(raced, input, locale, hash)
        if (replay) return replay
      }
      throw error
    }

    subscriber.unsubToken = unsubToken(subscriber.id, secret)
    await subscriber.save()

    await this.consent.recordProof({
      subscriberId: subscriber.id,
      email,
      emailHash: hash,
      event: 'subscribe',
      ip: input.ip,
      userAgent: input.userAgent,
      sourceUrl: input.sourceUrl,
      consentLabel: input.consentLabel,
      termsVersion: TERMS_VERSION,
      locale,
    })
    await this.stampPriorState(hash, prior)

    // --- Étape 5 : le code nominatif ------------------------------------------------
    // Synchrone, et c'est le seul appel qui a le droit de faire échouer l'inscription :
    // l'encart affiche le code sur cette réponse. Annoncer un bon qu'on n'a pas créé serait
    // pire que ne rien annoncer.
    try {
      const issued = await this.voucher.issue(String(subscriber.id))
      subscriber.discountCode = issued.code
      subscriber.discountGid = issued.discountGid
      subscriber.discountExpiresTs = issued.expiresTs
      await subscriber.save()
    } catch (error) {
      Logger.error(
        'newsletter subscribe: création du bon impossible pour #%s — %s',
        subscriber.id,
        (error as any)?.message ?? error
      )
      // Séquence fermée : sans bon, les trois e-mails n'ont plus d'objet. La ligne reste en
      // base (la preuve aussi), et le marchand peut la reprendre à la main.
      subscriber.sequenceDone = true
      subscriber.sequenceStopReason = 'voucher_failed'
      subscriber.nextEmail = null
      subscriber.nextEmailDueTs = null
      await subscriber.save()
      return { ok: false, error: 'voucher_unavailable' }
    }

    // --- Étape 6 : Shopify — jamais bloquant ----------------------------------------
    // Un échec laisse `shopifySyncPending` à vrai ; le cron rejouera. Le client ne doit
    // jamais payer une panne d'API pour un geste qu'il a fait correctement.
    await this.consent.pushSubscribed(subscriber)

    return {
      ok: true,
      state: 'subscribed',
      code: subscriber.discountCode!,
      expiresAt: DateTime.fromSeconds(subscriber.discountExpiresTs!).toISO()!,
    }
  }

  // --- interne ---------------------------------------------------------------------

  /**
   * Ré-soumission d'une adresse déjà connue.
   *
   * On RENVOIE LE MÊME CODE tant qu'il est valide, et on ne relance pas la séquence : sans
   * ça, il suffirait de resoumettre son adresse pour se faire réexpédier les trois e-mails.
   * Renvoie `null` quand la ligne est réutilisable telle quelle pour une vraie ré-inscription
   * (jamais le cas aujourd'hui : une ligne existante répond toujours quelque chose).
   */
  private async replay(
    subscriber: NewsletterSubscriber,
    input: SubscribeInput,
    locale: NewsletterLocale,
    hash: string
  ): Promise<SubscribeOutcome | null> {
    const nowTs = Math.floor(DateTime.now().toSeconds())

    // Une ligne terminale ne se réveille jamais par l'encart. Se réabonner après un
    // désabonnement, un rebond dur ou une plainte est un geste qui passe par un humain.
    if (subscriber.status !== 'active') {
      Logger.info(
        'newsletter subscribe: ré-soumission sur inscrit #%s en statut %s — refus',
        subscriber.id,
        subscriber.status
      )
      return { ok: true, state: 'refused' }
    }

    // La langue, elle, se met à jour : la personne a pu changer de version du site.
    if (subscriber.locale !== locale) {
      subscriber.locale = locale
      await subscriber.save()
    }

    await this.consent.recordProof({
      subscriberId: subscriber.id,
      email: subscriber.email,
      emailHash: hash,
      event: 'resubscribe',
      ip: input.ip,
      userAgent: input.userAgent,
      sourceUrl: input.sourceUrl,
      consentLabel: input.consentLabel,
      termsVersion: TERMS_VERSION,
      locale,
    })

    const codeStillValid =
      !!subscriber.discountCode &&
      subscriber.discountExpiresTs !== null &&
      subscriber.discountExpiresTs > nowTs

    if (codeStillValid) {
      return {
        ok: true,
        state: 'already',
        code: subscriber.discountCode!,
        expiresAt: DateTime.fromSeconds(subscriber.discountExpiresTs!).toISO()!,
      }
    }

    // Code expiré : on ne relance pas la séquence, mais on n'a rien à annoncer non plus.
    // Le thème affichera un message honnête plutôt qu'un bon périmé.
    return { ok: true, state: 'refused' }
  }

  /** Écrit l'état Shopify préalable sur la dernière preuve posée pour cette adresse. */
  private async stampPriorState(hash: string, prior: string | null): Promise<void> {
    if (prior === null) return
    try {
      const last = await NewsletterConsentEvent.query()
        .where('email_hash', hash)
        .orderBy('id', 'desc')
        .first()
      if (!last) return
      last.priorMarketingState = prior
      await last.save()
    } catch {
      // Ne casse jamais une inscription : c'est une annotation d'audit, pas une décision.
    }
  }

  /** Trop de tentatives sur cette adresse en 24 h ? (garde complémentaire au throttle IP) */
  private async tooManyAttempts(hash: string): Promise<boolean> {
    const since = Math.floor(DateTime.now().minus({ hours: 24 }).toSeconds())
    const result = await Database.from('newsletter_consent_events')
      .where('email_hash', hash)
      .whereIn('event', ['subscribe', 'resubscribe'])
      .where('occurred_ts', '>', since)
      .count('* as total')
    const total = Number(result?.[0]?.total ?? 0)
    return total >= MAX_SUBSCRIBES_PER_EMAIL_PER_DAY
  }
}
