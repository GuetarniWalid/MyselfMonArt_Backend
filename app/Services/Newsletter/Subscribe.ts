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
import { announcedDateFromEnd, announcedIso } from './expiry'
import { resolveCurrency } from './currency'
import { decideReplay } from './replay'
import { decideQuota } from './quota'
import type { QuotaScope, QuotaWindow } from './quota'
import {
  ISSUE_WINDOW_EMAIL_SECONDS,
  ISSUE_WINDOW_IP_SECONDS,
  ISSUING_EVENTS,
  MAX_ISSUES_PER_EMAIL_PER_DAY,
  MAX_ISSUES_PER_IP_PER_HOUR,
  PURPOSE,
  SUBSCRIBABLE_PRIOR_STATES,
  TERMS_VERSION,
} from './config'
import type { NewsletterLocale } from './config'

export interface SubscribeInput {
  email: string
  /** LANGUE des e-mails : fr | en | de | es | nl. */
  locale?: string
  /**
   * DEVISE du bon : EUR | USD | CAD | CHF | GBP.
   *
   * ⚠️ Ni déduite de `locale`, ni déductible : un Allemand lit en allemand et paie en euros, un
   * Suisse peut lire en français et payer en francs. Absente ou inconnue → déduite de `country`,
   * puis EUR en dernier recours.
   */
  currency?: string
  /** Pays ISO 3166-1 alpha-2 — repli quand la devise manque ou n'est pas reconnue. */
  country?: string
  sourceUrl?: string
  consent: boolean
  consentLabel?: string
  ip?: string | null
  userAgent?: string | null
}

export type SubscribeState = 'subscribed' | 'already' | 'refused'

/**
 * Date annoncée d'un inscrit, en ISO 8601, pour la réponse à l'encart.
 *
 * ⛔ C'est la DATE ANNONCÉE qui sort d'ici, jamais l'instant de fin du code : le code court
 * jusqu'au lendemain 11:59:59 UTC, et renvoyer cet instant ferait afficher au thème une date
 * postérieure d'un jour à celle des e-mails. Deux dates différentes pour un même bon, c'est un
 * e-mail au service client à chaque inscription.
 *
 * Les lignes créées avant cette correction n'ont pas de date annoncée : on la reconstruit
 * depuis l'instant de fin plutôt que de renvoyer un champ vide.
 */
export function announcedFor(subscriber: NewsletterSubscriber): string | undefined {
  if (subscriber.discountAnnouncedDate) return announcedIso(subscriber.discountAnnouncedDate)
  if (subscriber.discountExpiresTs === null) return undefined
  return announcedIso(announcedDateFromEnd(subscriber.discountExpiresTs))
}

export interface SubscribeOutcome {
  ok: boolean
  state?: SubscribeState
  code?: string
  expiresAt?: string
  error?: string
  /**
   * Renseignés UNIQUEMENT avec `error: 'rate_limited'`, pour que l'encart puisse écrire
   * « réessayez demain » quand le plafond est journalier, au lieu du « réessayez dans un
   * instant » qui est faux dans ce cas — et qui envoie le client réessayer pour rien.
   */
  scope?: QuotaScope
  retryAfter?: number
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
    // La devise choisit le MONTANT du bon, la langue choisit celle des e-mails. Deux axes
    // indépendants : ni l'un ne se déduit de l'autre.
    const currency = resolveCurrency(input.currency, input.country)
    const country = String(input.country ?? '')
      .trim()
      .toUpperCase()
      .slice(0, 2)
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
      return await this.replay(existing, input, locale, hash)
    }

    // --- Plafond des ÉMISSIONS ------------------------------------------------------
    // Posé ICI et pas plus haut : une adresse déjà connue est traitée par `replay`, qui ne
    // consulte le plafond que s'il faut vraiment émettre. Renvoyer un code existant est une
    // lecture, et une lecture ne se rationne pas.
    const quota = await this.issuingQuota(hash, input.ip ?? null)
    if (quota.blocked) {
      return {
        ok: false,
        error: 'rate_limited',
        scope: quota.scope,
        retryAfter: quota.retryAfter,
      }
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
        currency,
        country: country || null,
        // Conservée sur l'inscrit, et pas seulement dans le journal de preuve : E2 et E3
        // partent des jours plus tard et doivent pouvoir rappeler l'œuvre regardée.
        sourceUrl: input.sourceUrl ? input.sourceUrl.slice(0, 512) : null,
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
      if (raced) return await this.replay(raced, input, locale, hash)
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
      const issued = await this.voucher.issue(String(subscriber.id), currency, now)
      subscriber.discountCode = issued.code
      subscriber.discountGid = issued.discountGid
      subscriber.discountExpiresTs = issued.expiresTs
      // La date ANNONCÉE est figée ici, pas déduite de l'instant de fin : le code court un jour
      // de plus, pour que la promesse tienne dans tous les fuseaux (cf. `expiry.ts`).
      subscriber.discountAnnouncedDate = issued.announcedDate
      // L'offre annoncée est figée elle aussi : E2 et E3 partent jusqu'à six jours plus tard,
      // et la recalculer au taux du moment ferait annoncer un autre montant que celui affiché.
      subscriber.voucherAmount = issued.amount
      subscriber.voucherThreshold = issued.threshold
      subscriber.voucherAmountEur = issued.amountEur
      subscriber.voucherThresholdEur = issued.thresholdEur
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
      expiresAt: announcedFor(subscriber),
    }
  }

  // --- interne ---------------------------------------------------------------------

  /**
   * Ré-soumission d'une adresse déjà connue. Répond TOUJOURS quelque chose.
   *
   * Trois issues, décidées par `decideReplay` (module pur, testé hors ligne) :
   *
   *   • `return`  — le bon en cours est valide : on le renvoie tel quel, avec sa date
   *                 d'origine. Rien n'est créé, rien n'est envoyé, la séquence ne bouge pas.
   *   • `reissue` — il n'y a plus rien de valide à renvoyer : on émet un bon neuf plutôt que
   *                 de rendre la main sans code (cf. l'en-tête de `replay.ts`).
   *   • `refuse`  — ligne terminale, ou bon déjà consommé.
   *
   * ⛔ DANS AUCUN CAS LA SÉQUENCE NE REDÉMARRE : sans ça, il suffirait de resoumettre son
   * adresse pour se faire réexpédier les trois e-mails.
   */
  private async replay(
    subscriber: NewsletterSubscriber,
    input: SubscribeInput,
    locale: NewsletterLocale,
    hash: string
  ): Promise<SubscribeOutcome> {
    const now = DateTime.now()
    const nowTs = Math.floor(now.toSeconds())

    const decision = decideReplay(
      {
        status: subscriber.status,
        discountCode: subscriber.discountCode,
        discountExpiresTs: subscriber.discountExpiresTs,
        codeConsumedTs: subscriber.codeConsumedTs,
      },
      nowTs
    )

    // Une ligne terminale ne se réveille jamais par l'encart. Se réabonner après un
    // désabonnement, un rebond dur ou une plainte est un geste qui passe par un humain.
    //
    // ⛔ ET ON N'ÉCRIT PAS DE PREUVE ICI. Une ligne `resubscribe` posée sur quelqu'un qui
    // s'était désabonné se relirait, des mois plus tard, comme un consentement retrouvé.
    if (decision.action === 'refuse') {
      Logger.info(
        'newsletter subscribe: ré-soumission sur inscrit #%s — refus (%s)',
        subscriber.id,
        decision.reason
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

    const resubmitted = resolveCurrency(input.currency, input.country)

    if (decision.action === 'return') {
      // La DEVISE ne bouge pas — et c'est volontaire. Le code déjà émis est calibré pour une
      // devise et verrouillé sur ses marchés : la réécrire ici ferait annoncer dans E2 et E3 un
      // montant que le code ne donnera pas. Cas rare (même adresse, deux marchés, moins de sept
      // jours) mais silencieux, d'où le journal : c'est le seul endroit où il devient
      // diagnosticable.
      if (subscriber.currency && subscriber.currency !== resubmitted) {
        Logger.warn(
          'newsletter subscribe: ré-soumission de #%s depuis %s alors que son bon est en %s — ' +
            'le code reste calibré pour %s',
          subscriber.id,
          resubmitted,
          subscriber.currency,
          subscriber.currency
        )
      }

      return {
        ok: true,
        state: 'already',
        code: subscriber.discountCode!,
        expiresAt: announcedFor(subscriber),
      }
    }

    return await this.reissue(subscriber, input, hash, resubmitted, now, decision.reason)
  }

  /**
   * RÉÉMISSION — le bon précédent est mort (expiré, ou jamais créé) et la personne revient.
   *
   * On ne renvoie pas un code périmé : au paiement, il donnerait « Unable to find a valid
   * discount matching the code entered », c'est-à-dire une promesse affichée à l'écran puis
   * démentie à la caisse. On en émet un neuf, et on répond `already` — la personne EST déjà
   * inscrite, ce n'est pas une nouvelle inscription et il n'en faut pas une seconde.
   */
  private async reissue(
    subscriber: NewsletterSubscriber,
    input: SubscribeInput,
    hash: string,
    currency: ReturnType<typeof resolveCurrency>,
    now: DateTime,
    reason: string
  ): Promise<SubscribeOutcome> {
    // ⛔ LE PLAFOND S'APPLIQUE ICI, et seulement ici sur ce chemin : c'est le seul geste de la
    // ré-soumission qui CRÉE quelque chose. Sans lui, l'encart deviendrait un robinet à remises
    // pour qui sait attendre l'expiration.
    const quota = await this.issuingQuota(hash, input.ip ?? null)
    if (quota.blocked) {
      Logger.info(
        'newsletter subscribe: réémission refusée pour #%s — plafond %s atteint',
        subscriber.id,
        quota.scope
      )
      return { ok: false, error: 'rate_limited', scope: quota.scope, retryAfter: quota.retryAfter }
    }

    // La preuve AVANT la mutation, comme sur le chemin d'inscription : `discountCodeBasicCreate`
    // peut échouer ET avoir créé la remise (bug Shopify confirmé). Une émission non journalisée
    // sortirait du plafond, donc du comptage.
    await this.consent.recordProof({
      subscriberId: subscriber.id,
      email: subscriber.email,
      emailHash: hash,
      event: 'reissue',
      ip: input.ip,
      userAgent: input.userAgent,
      sourceUrl: input.sourceUrl,
      consentLabel: input.consentLabel,
      termsVersion: TERMS_VERSION,
      locale: subscriber.locale,
    })

    try {
      const issued = await this.voucher.issue(String(subscriber.id), currency, now)
      subscriber.discountCode = issued.code
      subscriber.discountGid = issued.discountGid
      subscriber.discountExpiresTs = issued.expiresTs
      subscriber.discountAnnouncedDate = issued.announcedDate
      // La DEVISE, elle, se recalibre — à l'inverse du cas « bon encore valide ». L'argument qui
      // l'interdisait là-bas (un code vivant calibré pour une autre devise) tombe ici : le code
      // d'avant est mort et aucun e-mail ne l'annonce plus. Garder l'ancienne devise donnerait à
      // un visiteur passé sur le marché canadien un bon en euros, restreint aux marchés euro,
      // donc inutilisable là où il se trouve.
      subscriber.currency = currency
      const country = String(input.country ?? '')
        .trim()
        .toUpperCase()
        .slice(0, 2)
      if (country) subscriber.country = country
      subscriber.voucherAmount = issued.amount
      subscriber.voucherThreshold = issued.threshold
      subscriber.voucherAmountEur = issued.amountEur
      subscriber.voucherThresholdEur = issued.thresholdEur
      await subscriber.save()
    } catch (error) {
      Logger.error(
        'newsletter subscribe: réémission impossible pour #%s — %s',
        subscriber.id,
        (error as any)?.message ?? error
      )
      // La ligne garde son ancien code mort : on n'a rien abîmé, et le marchand peut reprendre
      // la main. L'encart, lui, affichera un refus honnête plutôt qu'un bon qui ne marche pas.
      return { ok: false, error: 'voucher_unavailable' }
    }

    // ⛔ LA SÉQUENCE NE REPART PAS, et si elle était encore ouverte on la ferme. Son calendrier
    // a été construit autour de la PREMIÈRE fenêtre : E3 dit « vos 15 € s'arrêtent demain » et
    // partirait maintenant à quatre jours de la nouvelle échéance. Un e-mail qui annonce une
    // date fausse, c'est le clic « signaler comme spam » — et une plainte vaut ici dix fois le
    // seuil contractuel de SES. En régime normal la séquence est déjà close (la porte
    // d'avant-envoi la ferme dès que le bon approche de l'expiration) : ceci est un filet.
    if (!subscriber.sequenceDone) {
      subscriber.sequenceDone = true
      subscriber.sequenceStopReason = 'bon réémis'
      subscriber.nextEmail = null
      subscriber.nextEmailDueTs = null
      await subscriber.save()
    }

    Logger.info(
      'newsletter subscribe: bon réémis pour #%s (%s) — %s en %s, annoncé jusqu’au %s',
      subscriber.id,
      reason,
      subscriber.discountCode,
      currency,
      subscriber.discountAnnouncedDate
    )

    return {
      ok: true,
      state: 'already',
      code: subscriber.discountCode!,
      expiresAt: announcedFor(subscriber),
    }
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

  /**
   * Le plafond des ÉMISSIONS : 3 par adresse et par jour, 10 par IP et par heure.
   *
   * ⛔ NE COMPTE QUE LES ÉMISSIONS (`ISSUING_EVENTS`), jamais les re-soumissions. Renvoyer un
   * code existant est une lecture — l'inclure ici, c'est refuser son bon à un client légitime
   * qui a simplement fermé l'onglet, et c'est exactement le défaut que cette version corrige.
   *
   * Compté sur le journal de preuve, qui est append-only : rien ne le remet à zéro, ni un
   * redémarrage, ni un déploiement, ni l'autre instance PM2 — contrairement au compteur en
   * mémoire du middleware `throttle`, qui ne peut être qu'une garde anti-flot.
   */
  private async issuingQuota(hash: string, ip: string | null) {
    const nowTs = Math.floor(DateTime.now().toSeconds())

    const issuedSince = async (column: 'email_hash' | 'ip', value: string, seconds: number) => {
      const rows = await Database.from('newsletter_consent_events')
        .where(column, value)
        .whereIn('event', [...ISSUING_EVENTS])
        .where('occurred_ts', '>', nowTs - seconds)
        .select('occurred_ts')
      return rows.map((row: any) => Number(row.occurred_ts))
    }

    const windows: QuotaWindow[] = [
      {
        scope: 'day',
        issuedTs: await issuedSince('email_hash', hash, ISSUE_WINDOW_EMAIL_SECONDS),
        max: MAX_ISSUES_PER_EMAIL_PER_DAY,
        seconds: ISSUE_WINDOW_EMAIL_SECONDS,
      },
    ]

    // Sans IP (appel serveur à serveur, en-tête absent), il n'y a rien à compter : on ne
    // regroupe surtout pas les sans-IP dans un même seau, ce qui les bloquerait mutuellement.
    if (ip) {
      windows.push({
        scope: 'hour',
        issuedTs: await issuedSince('ip', ip, ISSUE_WINDOW_IP_SECONDS),
        max: MAX_ISSUES_PER_IP_PER_HOUR,
        seconds: ISSUE_WINDOW_IP_SECONDS,
      })
    }

    return decideQuota(windows, nowTs)
  }
}
