import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import Shopify from 'App/Services/Shopify'
import { ShopifyGraphQLError } from 'App/Services/Shopify/Authentication'
import NewsletterConsentEvent from 'App/Models/NewsletterConsentEvent'
import NewsletterSubscriber from 'App/Models/NewsletterSubscriber'
import NewsletterSuppression from 'App/Models/NewsletterSuppression'
import type { ConsentEventKind } from 'App/Models/NewsletterConsentEvent'
import type { SuppressionReason } from 'App/Models/NewsletterSuppression'
import { PURPOSE, SUPPRESSION_RETENTION_YEARS } from './config'

/**
 * Consentement : la PREUVE (locale, immuable), la PROPAGATION vers Shopify, et la LISTE
 * REPOUSSOIR.
 *
 * La répartition des vérités est la règle structurante du dispositif :
 *
 *   SHOPIFY détient    `marketingState`, `marketingOptInLevel`, l'identité, la `locale`.
 *   LE BACK-END détient la PREUVE (IP, page, libellé, horodatage immuable), la FINALITÉ,
 *                       la JOIGNABILITÉ, l'état de séquence, le jeton, la liste repoussoir.
 *
 * Pourquoi la preuve ne peut pas vivre chez Shopify : `consentUpdatedAt` y est un champ unique
 * et écrasé — « the latest date the customer consented OR objected ». Un désabonnement suivi
 * d'un réabonnement détruit la preuve d'origine, celle qu'exige l'art. 7(1) du RGPD.
 */
export default class NewsletterConsent {
  private shopify = new Shopify()

  // --- La preuve --------------------------------------------------------------------

  /**
   * Journalise un fait de consentement. APPEND-ONLY.
   *
   * ⛔ Appelé AVANT le moindre appel à Shopify sur le chemin d'inscription : si l'API tombe
   * entre-temps, la preuve existe quand même. L'inverse — collecter d'abord, prouver ensuite —
   * produit des inscrits sans preuve dès la première panne.
   *
   * Ne lève jamais : perdre une ligne de journal ne doit pas faire échouer une inscription qui,
   * elle, est légitime. L'échec est journalisé bruyamment.
   */
  public async recordProof(input: {
    subscriberId: number | null
    email: string | null
    emailHash: string
    event: ConsentEventKind
    ip?: string | null
    userAgent?: string | null
    sourceUrl?: string | null
    consentLabel?: string | null
    termsVersion?: string | null
    locale?: string | null
  }): Promise<void> {
    const now = DateTime.now()
    try {
      await NewsletterConsentEvent.create({
        subscriberId: input.subscriberId,
        email: input.email,
        emailHash: input.emailHash,
        event: input.event,
        ip: input.ip ?? null,
        // Tronqué à la taille de la colonne : certains agents utilisateur dépassent 255
        // caractères, et MySQL en mode non strict tronquerait EN SILENCE.
        userAgent: input.userAgent ? input.userAgent.slice(0, 255) : null,
        sourceUrl: input.sourceUrl ? input.sourceUrl.slice(0, 512) : null,
        consentLabel: input.consentLabel ?? null,
        termsVersion: input.termsVersion ?? null,
        locale: input.locale ?? null,
        purpose: PURPOSE,
        occurredTs: Math.floor(now.toSeconds()),
        occurredAt: now,
      })
    } catch (error) {
      Logger.error(
        'newsletter: ÉCHEC d’écriture de la preuve (%s) — %s',
        input.event,
        (error as any)?.message ?? error
      )
    }
  }

  // --- Propagation vers Shopify -----------------------------------------------------

  /**
   * Pose le consentement `SUBSCRIBED` chez Shopify. Ne lève pas : renvoie `false` et laisse
   * l'inscrit en `shopifySyncPending`, que le cron rejouera.
   *
   * Deux mutations, et pas une : `CustomerSetInput` n'a PAS de champ `emailMarketingConsent`
   * sur l'API 2025-07 (vérifié par introspection). Le brief supposait le contraire ; la
   * mutation unique qu'il décrivait aurait échoué au premier appel.
   */
  public async pushSubscribed(subscriber: NewsletterSubscriber): Promise<boolean> {
    // Adresse effacée (art. 17) : il n'y a plus personne à abonner, et la recréer à partir
    // d'un identifiant serait exactement l'inverse de ce qui a été demandé.
    if (!subscriber.email) return await this.markSynced(subscriber)

    try {
      const upsert = await this.shopify.customer.upsertByEmail({
        email: subscriber.email,
        locale: subscriber.locale,
      })

      const customerId = upsert.customerId
      if (!customerId) {
        return await this.markSyncFailed(
          subscriber,
          `customerSet sans client${upsert.userErrors.length ? ` — ${upsert.userErrors.join(' | ')}` : ''}`
        )
      }

      const consent = await this.shopify.customer.setEmailMarketingConsent({
        customerId,
        marketingState: 'SUBSCRIBED',
        marketingOptInLevel: 'SINGLE_OPT_IN',
      })

      if (!consent.ok) {
        subscriber.shopifyCustomerId = customerId
        return await this.markSyncFailed(subscriber, consent.userErrors.join(' | ') || 'refus')
      }

      subscriber.shopifyCustomerId = customerId
      return await this.markSynced(subscriber)
    } catch (error) {
      return await this.markSyncFailed(subscriber, this.describe(error))
    }
  }

  /**
   * Propage un désabonnement vers Shopify.
   *
   * ⛔ N'EST JAMAIS APPELÉ SUR UN REBOND. `customerEmailMarketingConsentUpdate` n'accepte que
   * SUBSCRIBED / PENDING / UNSUBSCRIBED, et `UNSUBSCRIBED` signifie « s'était abonné puis
   * s'est retiré ». L'écrire sur un rebond falsifierait le registre de consentement ET
   * empêcherait la personne de revenir si elle corrige son adresse. Un rebond arrête l'envoi,
   * il ne touche jamais au consentement.
   *
   * Une PLAINTE, elle, s'écrit bien `UNSUBSCRIBED` : c'est ce que Shopify fait nativement.
   */
  public async pushUnsubscribed(subscriber: NewsletterSubscriber): Promise<boolean> {
    try {
      let customerId = subscriber.shopifyCustomerId

      // Identifiant perdu (inscription faite pendant une panne d'API) : on le rattrape une
      // fois, puis on le mémorise — les vérifications suivantes se feront par identifiant.
      // Sans identifiant NI adresse (ligne effacée), il n'y a rien à désabonner là-bas ; le
      // blocage LOCAL, lui, est déjà acquis et c'est lui qui empêche l'envoi.
      if (!customerId) {
        customerId = subscriber.email
          ? await this.shopify.customer.findIdByEmail(subscriber.email)
          : null
        if (!customerId) {
          // Aucun client Shopify : il n'y a rien à désabonner là-bas. Le blocage LOCAL, lui,
          // est déjà acquis — c'est lui qui empêche l'envoi.
          return await this.markSynced(subscriber)
        }
        subscriber.shopifyCustomerId = customerId
      }

      const consent = await this.shopify.customer.setEmailMarketingConsent({
        customerId,
        marketingState: 'UNSUBSCRIBED',
        // Volontairement sans `marketingOptInLevel` : on ne redéclare pas un niveau d'opt-in
        // au moment où quelqu'un s'en va.
      })

      if (!consent.ok) {
        return await this.markSyncFailed(subscriber, consent.userErrors.join(' | ') || 'refus')
      }
      return await this.markSynced(subscriber)
    } catch (error) {
      return await this.markSyncFailed(subscriber, this.describe(error))
    }
  }

  private async markSynced(subscriber: NewsletterSubscriber): Promise<boolean> {
    subscriber.shopifySyncPending = false
    subscriber.shopifySyncAttempts = 0
    subscriber.shopifySyncError = null
    subscriber.shopifySyncedAt = DateTime.now()
    await subscriber.save()
    return true
  }

  private async markSyncFailed(
    subscriber: NewsletterSubscriber,
    message: string
  ): Promise<boolean> {
    subscriber.shopifySyncPending = true
    subscriber.shopifySyncAttempts = Number(subscriber.shopifySyncAttempts ?? 0) + 1
    subscriber.shopifySyncError = message.slice(0, 2000)
    await subscriber.save()
    Logger.warn(
      'newsletter: synchronisation Shopify en attente pour #%s (tentative %s) — %s',
      subscriber.id,
      subscriber.shopifySyncAttempts,
      message
    )
    return false
  }

  /** Un refus d'ACCÈS mérite d'être nommé : c'est la seule panne qui exige une intervention. */
  private describe(error: unknown): string {
    if (error instanceof ShopifyGraphQLError && error.accessDenied) {
      return `ACCÈS REFUSÉ par Shopify (${error.codes.join(', ')}) — ${error.message}`
    }
    return (error as any)?.message ?? String(error)
  }

  // --- Liste repoussoir -------------------------------------------------------------

  /** Cette adresse est-elle sur la liste repoussoir (et l'entrée est-elle encore en vigueur) ? */
  public async isSuppressed(emailHash: string): Promise<boolean> {
    const row = await NewsletterSuppression.findBy('email_hash', emailHash)
    if (!row) return false
    // `expiresTs` nul = pour toujours (cas des plaintes).
    if (row.expiresTs === null) return true
    return row.expiresTs > Math.floor(DateTime.now().toSeconds())
  }

  /**
   * Ajoute une adresse à la liste repoussoir. Idempotent.
   *
   * Une PLAINTE n'expire JAMAIS : réécrire trois ans plus tard à quelqu'un qui s'est plaint
   * reste la meilleure façon de perdre le compte d'envoi. Les autres motifs expirent au bout
   * de trois ans (rétention).
   */
  public async suppress(emailHash: string, reason: SuppressionReason): Promise<void> {
    const now = DateTime.now()
    const expiresTs =
      reason === 'complaint'
        ? null
        : Math.floor(now.plus({ years: SUPPRESSION_RETENTION_YEARS }).toSeconds())

    try {
      const existing = await NewsletterSuppression.findBy('email_hash', emailHash)
      if (existing) {
        // On ne rétrograde jamais une entrée définitive en entrée expirable.
        if (existing.expiresTs !== null && expiresTs === null) {
          existing.expiresTs = null
          existing.reason = reason
          await existing.save()
        }
        return
      }

      await NewsletterSuppression.create({
        emailHash,
        reason,
        expiresTs,
        createdTs: Math.floor(now.toSeconds()),
      })
    } catch (error) {
      // Course perdue contre un autre process : la contrainte UNIQUE a tranché, l'adresse est
      // sur la liste, c'est tout ce qui compte.
      Logger.info(
        'newsletter suppression %s: déjà présente ou refusée (%s)',
        emailHash.slice(0, 12),
        (error as any)?.message ?? error
      )
    }
  }
}
