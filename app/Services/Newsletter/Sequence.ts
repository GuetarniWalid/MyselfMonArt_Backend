import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import Database from '@ioc:Adonis/Lucid/Database'
import { DateTime } from 'luxon'
import Shopify from 'App/Services/Shopify'
import { ShopifyGraphQLError } from 'App/Services/Shopify/Authentication'
import NewsletterSend from 'App/Models/NewsletterSend'
import NewsletterSubscriber from 'App/Models/NewsletterSubscriber'
import { NewsletterMailer, senderAddress, unsubscribeHeaders } from './mail'
import { renderNewsletterEmail } from './emails/template'
import NewsletterVoucher from './Voucher'
import { announcedDateFromEnd } from './expiry'
import { offerFor, resolveCurrency } from './currency'
import NewsletterProductLookup from './Product'
import NewsletterBetterDeal from './BetterDeal'
import NewsletterMarkets from './Markets'
import {
  MAX_SENDS_PER_TICK,
  MAX_STALENESS_DAYS,
  minHoursBeforeExpiry,
  MIN_HOURS_BETWEEN_EMAILS,
  POSTAL_SENDER,
  PURPOSE,
  SEQUENCE_GAP_DAYS,
  SEQUENCE_LENGTH,
  STUCK_SEND_GRACE_MINUTES,
  TRUSTPILOT_COUNT,
  TRUSTPILOT_SCORE,
} from './config'
import type { NewsletterLocale } from './config'

/** Ce que la porte a décidé, et pourquoi. */
type GateVerdict =
  | { action: 'send' }
  /** On n'enverra JAMAIS cet e-mail : la séquence avance ou se ferme. */
  | { action: 'skip'; reason: string; stopSequence?: boolean }
  /** On réessaiera au prochain tour, sans rien consommer. */
  | { action: 'defer'; reason: string }

/**
 * Exécution de la séquence — la porte d'avant-envoi, puis l'envoi.
 *
 * ⛔ ASYMÉTRIE FONDATRICE, dont tout le reste découle :
 *
 *     Le pire cas ACCEPTABLE est qu'un e-mail manque.
 *     Le pire cas INACCEPTABLE est qu'il parte deux fois, ou qu'il parte à quelqu'un qui
 *     n'en veut plus.
 *
 * SES impose contractuellement moins de 0,08 % de plaintes. À 120 envois par semaine, UNE
 * seule plainte représente 0,83 % — dix fois le seuil. Et la sanction n'est pas « tomber en
 * indésirables », c'est « plus rien ne part », séquences en cours comprises, sans préavis.
 * Chaque fois qu'un doute existe, on n'envoie pas.
 */
export default class NewsletterSequence {
  private shopify = new Shopify()
  private voucher = new NewsletterVoucher()
  private mailer = new NewsletterMailer()

  /** Un passage complet du cron. Ne lève jamais : le scheduler doit survivre à tout. */
  public async run(): Promise<{ sent: number; skipped: number; deferred: number }> {
    const counters = { sent: 0, skipped: 0, deferred: 0 }

    if (!this.mailer.isReady()) {
      // Aucun transport configuré : on ne RÉSERVE même pas de ligne d'envoi. Réserver puis
      // échouer consommerait la garde d'unicité et perdrait l'e-mail pour de bon.
      Logger.warn('newsletter sequence: aucun transport e-mail configuré, passage sans effet')
      return counters
    }

    await this.reapStuckSends()

    const nowTs = Math.floor(DateTime.now().toSeconds())

    const due = await NewsletterSubscriber.query()
      .where('status', 'active')
      .where('purpose', PURPOSE)
      .where('sequence_done', false)
      .whereNotNull('next_email')
      .where('next_email_due_ts', '<=', nowTs)
      .orderBy('next_email_due_ts', 'asc')
      // Plafond par passage : borne la reprise après panne. Faire d'un domaine neuf un
      // expéditeur en volume du jour au lendemain le classe « en volume » chez Google, à vie.
      .limit(MAX_SENDS_PER_TICK)

    for (const subscriber of due) {
      try {
        const outcome = await this.processOne(subscriber)
        counters[outcome]++
      } catch (error) {
        // Une ligne empoisonnée ne doit jamais bloquer les suivantes : on journalise et on
        // passe. Sans ça, un seul inscrit malformé gèlerait la séquence de tous les autres.
        counters.deferred++
        Logger.error(
          'newsletter sequence: inscrit #%s en erreur — %s',
          subscriber.id,
          (error as any)?.message ?? error
        )
      }
    }

    if (counters.sent || counters.skipped) {
      Logger.info(
        'newsletter sequence: %s envoyé(s), %s sauté(s), %s reporté(s)',
        counters.sent,
        counters.skipped,
        counters.deferred
      )
    }

    return counters
  }

  // --- Un inscrit ------------------------------------------------------------------

  private async processOne(
    subscriber: NewsletterSubscriber
  ): Promise<'sent' | 'skipped' | 'deferred'> {
    const emailNo = subscriber.nextEmail!
    const verdict = await this.gate(subscriber, emailNo)

    if (verdict.action === 'defer') {
      Logger.info('newsletter #%s e-mail %s reporté — %s', subscriber.id, emailNo, verdict.reason)
      return 'deferred'
    }

    if (verdict.action === 'skip') {
      await this.recordSkip(subscriber, emailNo, verdict.reason)
      if (verdict.stopSequence) {
        await this.closeSequence(subscriber, verdict.reason)
      } else {
        // Étape sautée, séquence conservée : on repart de MAINTENANT pour la suivante, pas
        // d'une échéance passée — sinon la suivante serait due aussitôt.
        await this.advance(subscriber, emailNo, Math.floor(DateTime.now().toSeconds()))
      }
      return 'skipped'
    }

    return (await this.send(subscriber, emailNo)) ? 'sent' : 'deferred'
  }

  /**
   * LA PORTE. Les règles sont énumérées dans cet ordre et JAMAIS dans un autre : les moins
   * chères d'abord (base locale), les plus chères ensuite (API Shopify).
   */
  private async gate(subscriber: NewsletterSubscriber, emailNo: number): Promise<GateVerdict> {
    const now = DateTime.now()
    const nowTs = Math.floor(now.toSeconds())

    // --- 1. Filtres LOCAUX ---------------------------------------------------------
    if (subscriber.status !== 'active') {
      return { action: 'skip', reason: `statut ${subscriber.status}`, stopSequence: true }
    }
    if (subscriber.purpose !== PURPOSE) {
      // Ne peut pas arriver via la requête de sélection, mais on ne fait jamais confiance à
      // un filtre situé ailleurs : c'est CE marqueur qui protège les ~750 dormants.
      return { action: 'skip', reason: 'finalité absente', stopSequence: true }
    }
    if (!subscriber.email) {
      return { action: 'skip', reason: 'adresse effacée (RGPD)', stopSequence: true }
    }
    if (subscriber.codeConsumedTs) {
      return { action: 'skip', reason: 'bon déjà utilisé', stopSequence: true }
    }
    if (!subscriber.discountCode || subscriber.discountExpiresTs === null) {
      return { action: 'skip', reason: 'aucun bon émis', stopSequence: true }
    }

    // --- 2. PLANCHER ABSOLU entre deux e-mails --------------------------------------
    // Dernière ligne de défense contre une salve : même si une échéance est fausse, même si
    // deux tours se chevauchent, personne ne reçoit deux e-mails à moins de 24 heures.
    const floorTs = Math.floor(now.minus({ hours: MIN_HOURS_BETWEEN_EMAILS }).toSeconds())
    const recent = await NewsletterSend.query()
      .where('subscriber_id', subscriber.id)
      .where('status', 'sent')
      .where('sent_ts', '>', floorTs)
      .first()
    if (recent) {
      return { action: 'defer', reason: `plancher de ${MIN_HOURS_BETWEEN_EMAILS} h non atteint` }
    }

    // --- 3. Échéance trop vieille ----------------------------------------------------
    // « Votre bon vous attend » dix jours en retard n'a plus de sens pour le lecteur — et
    // c'est le lecteur surpris qui clique sur « signaler comme spam ». On saute l'étape et
    // on avance, plutôt que d'envoyer un message qui n'a plus d'objet.
    const staleTs = Math.floor(now.minus({ days: MAX_STALENESS_DAYS }).toSeconds())
    if ((subscriber.nextEmailDueTs ?? nowTs) < staleTs && emailNo > 1) {
      return { action: 'skip', reason: 'échéance périmée' }
    }

    // --- 4. Marge minimale d'utilisation, PROPRE À CHAQUE E-MAIL ----------------------
    // ⛔ Le seuil dépend de l'e-mail, et ce n'est pas un raffinement : avec un bon de 7 jours,
    // il ne reste que 38 à 62 h de validité quand E3 part (J+6). Un seuil unique à 72 h le
    // classerait SYSTÉMATIQUEMENT en « bon proche de l'expiration » et fermerait la séquence —
    // le dernier rappel ne partirait jamais, sans que rien ne ressemble à une panne.
    const required = minHoursBeforeExpiry(emailNo)
    const hoursLeft = (subscriber.discountExpiresTs - nowTs) / 3600
    if (hoursLeft < required) {
      // E1 est une exception : il PORTE le bon, et le lien de désabonnement. Ne pas
      // l'envoyer laisserait quelqu'un qui vient de donner son adresse sans rien du tout.
      if (emailNo === 1 && hoursLeft > 0) return { action: 'send' }
      Logger.warn(
        'newsletter #%s: bon à moins de %s h de l’expiration (%s h restantes), e-mail %s non envoyé',
        subscriber.id,
        required,
        hoursLeft.toFixed(1),
        emailNo
      )
      return { action: 'skip', reason: 'bon proche de l’expiration', stopSequence: true }
    }

    // --- 5. Le bon a-t-il été consommé ? (signal de conversion) ----------------------
    // Fonctionne même si la personne a payé en invité avec une autre adresse — ce que
    // `ORDERS_PAID` ne verrait jamais.
    try {
      const consumed = await this.voucher.isConsumed(subscriber.discountCode)
      if (consumed === null) {
        // Remise introuvable : on ne conclut PAS qu'elle est intacte. On reporte.
        return { action: 'defer', reason: 'remise introuvable à la relecture' }
      }
      if (consumed) {
        subscriber.codeConsumedTs = nowTs
        await subscriber.save()
        return { action: 'skip', reason: 'bon utilisé (conversion)', stopSequence: true }
      }
    } catch (error) {
      return { action: 'defer', reason: this.describe(error) }
    }

    // --- 6. CONSENTEMENT, lu EN DIRECT chez Shopify ---------------------------------
    // Jamais en cache : Shopify n'est pas seul écrivain (page de désabonnement native,
    // admin, compte client, thème) et les webhooks arrivent sans garantie d'ordre.
    try {
      if (!subscriber.shopifyCustomerId) {
        const found = await this.shopify.customer.findIdByEmail(subscriber.email)
        if (!found) {
          return { action: 'skip', reason: 'aucun client Shopify', stopSequence: true }
        }
        subscriber.shopifyCustomerId = found
        await subscriber.save()
      }

      const consent = await this.shopify.customer.getConsentById(subscriber.shopifyCustomerId)

      // `null` = client supprimé ou fusionné. C'est un état NORMAL, pas une panne : Shopify
      // répond `{"data":{"customer":null}}` sans hash `errors`. On ferme la séquence.
      if (!consent) {
        return { action: 'skip', reason: 'client Shopify disparu', stopSequence: true }
      }

      // ⛔ La règle, dans le seul sens qui protège : envoyer SI ET SEULEMENT SI `SUBSCRIBED`.
      // Jamais « si ce n'est pas UNSUBSCRIBED » — Shopify ajoutera des valeurs à cet énuméré,
      // et une valeur inconnue doit toujours retenir l'envoi.
      if (consent.marketingState !== 'SUBSCRIBED') {
        return {
          action: 'skip',
          reason: `consentement Shopify = ${consent.marketingState}`,
          stopSequence: true,
        }
      }
    } catch (error) {
      // Un refus d'ACCÈS n'est pas une panne passagère : c'est la perte de l'accès aux
      // données client (§2 : tolérance héritée, révocable sans préavis). On reporte quand
      // même — jamais envoyer sur un doute — mais on le nomme bruyamment.
      if (error instanceof ShopifyGraphQLError && error.accessDenied) {
        Logger.error(
          'newsletter: ⛔ ACCÈS REFUSÉ par Shopify aux données client — tous les envois sont suspendus (%s)',
          error.message
        )
      }
      return { action: 'defer', reason: this.describe(error) }
    }

    return { action: 'send' }
  }

  // --- Envoi -----------------------------------------------------------------------

  /**
   * Réserve, envoie, puis inscrit le résultat. L'ORDRE EST LE POINT CRITIQUE.
   *
   * ⛔ La ligne d'envoi est une RÉSERVATION, pas un reçu. Le piège classique de la double
   * écriture consiste à appeler le prestataire puis à écrire en base : si le process meurt
   * entre les deux, l'e-mail est parti mais rien ne le dit, et le tour suivant le renvoie.
   * Si l'écriture d'après échoue de façon déterministe, c'est un e-mail toutes les quinze
   * minutes, indéfiniment, à la même personne.
   *
   * On réserve donc D'ABORD : la contrainte `UNIQUE(subscriber_id, email_no)` tranche.
   * `ER_DUP_ENTRY` signifie « quelqu'un d'autre s'en occupe ou c'est déjà parti » — on passe.
   *
   * La réservation est validée AVANT l'appel réseau et n'est enveloppée dans aucune
   * transaction englobante : une transaction qui couvrirait aussi l'envoi effacerait la
   * réservation en cas de retour arrière, et rétablirait exactement le doublon qu'on évite.
   */
  private async send(subscriber: NewsletterSubscriber, emailNo: number): Promise<boolean> {
    const nowTs = Math.floor(DateTime.now().toSeconds())

    let claim: NewsletterSend
    try {
      claim = await NewsletterSend.create({
        subscriberId: subscriber.id,
        emailNo,
        status: 'sending',
        locale: subscriber.locale,
        attempts: 1,
        claimedTs: nowTs,
      })
    } catch (error) {
      if ((error as any)?.code === 'ER_DUP_ENTRY') {
        // Déjà réservé : on ne double jamais. On réaligne le pointeur de séquence et on sort.
        Logger.info(
          'newsletter #%s e-mail %s déjà réservé — aucun doublon envoyé',
          subscriber.id,
          emailNo
        )
        await this.advance(subscriber, emailNo, nowTs)
        return false
      }
      throw error
    }

    // Devise et offre telles qu'ANNONCÉES à l'inscription, jamais recalculées : E3 part six
    // jours plus tard, à un autre taux de change. Les lignes créées avant la correction
    // multidevise n'ont rien de stocké — repli sur l'offre en euros, qui est la leur.
    const currency = resolveCurrency(subscriber.currency)
    const offer = offerFor(currency)
    const locale = subscriber.locale as NewsletterLocale
    const amount = subscriber.voucherAmount ?? offer.amount
    const threshold = subscriber.voucherThreshold ?? offer.threshold

    // LE PRÉFIXE DE VITRINE DU DESTINATAIRE, résolu UNE FOIS et porté par tous les liens de
    // l'e-mail : bouton, œuvre regardée, plus vendues, logo, mentions légales, Trustpilot.
    // ⛔ `/en` n'est pas « la version anglaise » : c'est le marché France, en euros. Un
    // Américain doit lire `/en-us`, sinon la page contredit les dollars annoncés dans l'e-mail.
    // Ne lève jamais : `null` = repli sur le préfixe de langue, soit le comportement d'avant.
    const pathPrefix = await new NewsletterMarkets().pathPrefixFor(subscriber.country, locale)

    const lookup = new NewsletterProductLookup()

    // L'œuvre regardée à l'inscription — bloc OPTIONNEL. Résolu au moment de l'envoi et non
    // figé à l'inscription : le prix et la disponibilité ont pu changer en six jours, et une
    // fiche dépubliée doit faire disparaître le bloc plutôt que mener à un 404.
    // Ne lève jamais : `null` = pas de bloc, l'e-mail part quand même.
    const product = await lookup.fromSourceUrl(
      subscriber.sourceUrl,
      locale,
      currency,
      amount,
      subscriber.country,
      pathPrefix
    )

    // Le 2ᵉ e-mail montre les plus vendues ; les deux autres n'en ont pas besoin, et une
    // lecture inutile coûte du quota Shopify à chaque envoi.
    const bestSellers =
      emailNo === 2
        ? await lookup.bestSellers(locale, currency, amount, subscriber.country, pathPrefix)
        : []

    // Le 3ᵉ e-mail porte le « point d'honnêteté ». Le seuil se CALCULE depuis la promotion
    // automatique réellement active (montant du bon ÷ taux), dans la devise du lecteur.
    // `null` = pas de promotion en cours, le paragraphe disparaît.
    const betterDealAmount =
      emailNo === 3 ? await new NewsletterBetterDeal().thresholdFor(amount) : null

    const rendered = renderNewsletterEmail({
      emailNo: emailNo as 1 | 2 | 3,
      locale,
      code: subscriber.discountCode!,
      // La DATE ANNONCÉE, pas l'instant de fin du code : celui-ci court un jour de plus, pour
      // que la promesse tienne dans tous les fuseaux ouverts à la vente (cf. `expiry.ts`).
      announcedDate:
        subscriber.discountAnnouncedDate ?? announcedDateFromEnd(subscriber.discountExpiresTs!),
      signupTs: subscriber.sequenceStartedTs,
      amount,
      threshold,
      currency,
      storeUrl: Env.get('STOREFRONT_URL') || 'https://www.myselfmonart.com',
      unsubscribeUrl: this.unsubscribeUrl(subscriber),
      contactEmail: Env.get('NEWSLETTER_MAIL_REPLY_TO') || 'contact@myselfmonart.com',
      // ⛔ OBLIGATOIRE depuis l'ouverture aux États-Unis (CAN-SPAM) et au Canada (CASL) : une
      // adresse postale physique dans chaque message. La constante fait foi si la variable
      // d'environnement est absente — elle l'était en production, et une obligation légale ne
      // doit pas dépendre d'un réglage qu'un redéploiement peut oublier.
      postalAddress: (Env.get('NEWSLETTER_POSTAL_ADDRESS') as string | undefined) || POSTAL_SENDER,
      trustpilotScore: TRUSTPILOT_SCORE,
      trustpilotCount: TRUSTPILOT_COUNT,
      ...(product ? { product } : {}),
      // La page d'origine, pour que le bouton mène à la fiche regardée plutôt qu'au catalogue.
      // Le gabarit ne s'en sert QUE si `product` est là — c'est-à-dire si la fiche a répondu à
      // l'instant même — et la valide avant d'en tirer quoi que ce soit.
      pathPrefix,
      ...(bestSellers.length ? { bestSellers } : {}),
      betterDealAmount,
    })

    const sender = senderAddress()

    try {
      const result = await this.mailer.send({
        from: sender.from,
        fromName: sender.fromName,
        to: subscriber.email!,
        replyTo: sender.replyTo,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        // Les deux en-têtes vont ensemble : c'est ce couple qui fait apparaître le bouton
        // natif « Se désabonner » chez Gmail et Yahoo. Sans lui, le lecteur qui veut partir
        // clique sur « signaler comme spam » — et c'est la plainte qui coûte le compte.
        headers: unsubscribeHeaders(this.unsubscribeUrl(subscriber)),
      })

      claim.status = 'sent'
      claim.transport = result.transport
      claim.providerMessageId = result.messageId
      claim.sentTs = Math.floor(DateTime.now().toSeconds())
      await claim.save()

      await this.advance(subscriber, emailNo, claim.sentTs)
      return true
    } catch (error) {
      // Le transport a REFUSÉ le message : rien n'est parti. C'est le seul cas où réessayer
      // est sûr, donc la ligne est supprimée pour libérer la réservation.
      const message = this.describe(error)
      Logger.warn('newsletter #%s e-mail %s: envoi refusé — %s', subscriber.id, emailNo, message)
      try {
        await claim.delete()
      } catch {
        // Si même la libération échoue, le ramasseur ci-dessous fermera la ligne en
        // `unknown`. On ne renverra jamais, et c'est le bon côté de l'asymétrie.
      }
      return false
    }
  }

  /**
   * Ferme les réservations restées en plan (plantage entre la réservation et l'envoi).
   *
   * ⛔ ELLES NE SONT JAMAIS RELANCÉES. Une ligne bloquée en `sending` est PAR DÉFINITION le
   * cas où l'on ne sait pas si le message est parti. La relancer ne serait sûr que si l'on
   * pouvait prouver qu'il n'est pas parti — et on ne le peut pas. On la ferme donc en
   * `unknown`, statut terminal, et on fait AVANCER la séquence pour que E2 et E3 aient quand
   * même lieu.
   */
  private async reapStuckSends(): Promise<void> {
    const cutoff = Math.floor(
      DateTime.now().minus({ minutes: STUCK_SEND_GRACE_MINUTES }).toSeconds()
    )

    const stuck = await NewsletterSend.query()
      .where('status', 'sending')
      .where('claimed_ts', '<', cutoff)
      .limit(100)

    for (const row of stuck) {
      row.status = 'unknown'
      row.reason = 'plantage entre la réservation et l’envoi — jamais relancé'
      await row.save()

      const subscriber = await NewsletterSubscriber.find(row.subscriberId)
      if (subscriber)
        await this.advance(subscriber, row.emailNo, Math.floor(DateTime.now().toSeconds()))

      Logger.warn(
        'newsletter #%s e-mail %s: réservation orpheline fermée en `unknown` (sort inconnu, non relancé)',
        row.subscriberId,
        row.emailNo
      )
    }
  }

  // --- Avancement ------------------------------------------------------------------

  /**
   * Fait avancer la séquence, en RÉANCRANT l'échéance suivante sur l'instant réel du dernier
   * envoi — jamais sur la date d'inscription.
   *
   * C'est la protection contre le scénario d'après-panne : avec des décalages calculés depuis
   * l'inscription, un arriéré de quatre jours ferait partir E1, E2 puis E3 en quarante-cinq
   * minutes. Réancré, un rattrapage s'étale exactement comme une séquence normale.
   */
  private async advance(
    subscriber: NewsletterSubscriber,
    emailNo: number,
    anchorTs: number
  ): Promise<void> {
    if (emailNo >= SEQUENCE_LENGTH) {
      await this.closeSequence(subscriber, 'séquence terminée')
      return
    }

    const gapDays =
      SEQUENCE_GAP_DAYS[emailNo - 1] ?? SEQUENCE_GAP_DAYS[SEQUENCE_GAP_DAYS.length - 1]
    subscriber.nextEmail = emailNo + 1
    subscriber.nextEmailDueTs = anchorTs + gapDays * 86400
    await subscriber.save()
  }

  private async closeSequence(subscriber: NewsletterSubscriber, reason: string): Promise<void> {
    subscriber.sequenceDone = true
    subscriber.sequenceStopReason = reason.slice(0, 32)
    subscriber.nextEmail = null
    subscriber.nextEmailDueTs = null
    await subscriber.save()
  }

  private async recordSkip(
    subscriber: NewsletterSubscriber,
    emailNo: number,
    reason: string
  ): Promise<void> {
    try {
      await Database.insertQuery()
        .table('newsletter_sends')
        .insert({
          subscriber_id: subscriber.id,
          email_no: emailNo,
          status: 'skipped',
          locale: subscriber.locale,
          reason: reason.slice(0, 255),
          attempts: 0,
          claimed_ts: Math.floor(DateTime.now().toSeconds()),
          created_at: DateTime.now().toSQL(),
          updated_at: DateTime.now().toSQL(),
        })
    } catch {
      // Déjà une ligne pour ce couple : la garde d'unicité a fait son travail, rien à ajouter.
    }
    Logger.info('newsletter #%s e-mail %s sauté — %s', subscriber.id, emailNo, reason)
  }

  private unsubscribeUrl(subscriber: NewsletterSubscriber): string {
    const base = Env.get('BACKEND_URL') || 'https://backend.myselfmonart.com'
    return `${String(base).replace(/\/+$/, '')}/u/${subscriber.unsubToken}`
  }

  private describe(error: unknown): string {
    if (error instanceof ShopifyGraphQLError && error.accessDenied) {
      return `ACCÈS REFUSÉ Shopify — ${error.message}`
    }
    return String((error as any)?.message ?? error).slice(0, 255)
  }
}
