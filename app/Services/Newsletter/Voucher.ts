import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import Shopify from 'App/Services/Shopify'
import { generateVoucherCode } from './identity'
import { VOUCHER_AMOUNT, VOUCHER_MIN_SUBTOTAL, VOUCHER_VALIDITY_DAYS } from './config'

export interface IssuedVoucher {
  code: string
  discountGid: string
  /** Instant de fin, en secondes epoch — jamais un TIMESTAMP (cf. `promo_rotations`). */
  expiresTs: number
  expiresAt: DateTime
}

/** Nombre de tirages avant d'abandonner. Une collision est déjà improbable ; cinq, jamais. */
const MAX_ATTEMPTS = 5

/**
 * Émission du BON NOMINATIF — un code par inscrit, créé à l'inscription.
 *
 * ⛔ ON N'ENVOIE JAMAIS PAR E-MAIL LE CODE PUBLIC HEBDOMADAIRE (`shop.metafields.promo.code`).
 * Il est affiché sur chaque fiche produit, donc lisible par tout le monde, et l'envoyer en
 * disant « votre bon » crée quatre problèmes d'un coup :
 *
 *   1. DIRECTIVE OMNIBUS — Shopify le documente : annoncer « une remise rien que pour vous »
 *      sur un code utilisable par n'importe qui fait entrer l'offre dans le champ de la
 *      réduction de prix, avec obligation d'afficher le prix le plus bas des 30 derniers
 *      jours. Un code réellement individualisé sort de ce champ.
 *   2. DEUX CODES POUR UN SEUL BON — la rotation publique est à 7 jours et la séquence court
 *      sur J0→J+7 : pour une partie des inscrits, E1 et E3 tomberaient de part et d'autre
 *      d'une rotation et annonceraient deux codes différents.
 *   3. « UNE FOIS PAR CLIENT » SE CONTOURNE avec une deuxième adresse, dès lors que le code
 *      circule publiquement. `usageLimit: 1` sur un code nominatif, non.
 *   4. UN CRON RATÉ = UN CODE MORT dans l'e-mail (« Unable to find a valid discount matching
 *      the code entered »), alors que la validité nominative part de l'inscription.
 *
 * Et surtout, le code nominatif apporte ce qu'aucun code public ne peut donner :
 * SON USAGE EST LE SIGNAL DE CONVERSION. Si le code est consommé, la séquence s'arrête — même
 * si la personne a payé en invité avec une autre adresse, ce que `ORDERS_PAID` ne verrait pas.
 */
export default class NewsletterVoucher {
  private shopify = new Shopify()

  /**
   * Crée le bon d'un inscrit. Lève si la remise n'a pas pu être CONFIRMÉE par relecture —
   * l'appelant ne doit jamais annoncer un code qu'il n'a pas vu exister.
   */
  public async issue(subscriberRef: string): Promise<IssuedVoucher> {
    const startsAt = DateTime.now()
    const endsAt = startsAt.plus({ days: VOUCHER_VALIDITY_DAYS })

    let lastError = ''

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const code = generateVoucherCode()

      // Un code déjà pris n'est pas une erreur : on retire. Ça arrive surtout quand un
      // ancien code du même alphabet existe encore dans l'admin.
      const existing = await this.shopify.discount.getCodeDiscountByCode(code)
      if (existing) {
        Logger.info('newsletter voucher: code %s déjà pris, nouveau tirage', code)
        continue
      }

      const created = await this.shopify.discount.createBasicCodeDiscount({
        title: `BON15-${subscriberRef}`,
        code,
        startsAt: startsAt.toISO({ suppressMilliseconds: true })!,
        endsAt: endsAt.toISO({ suppressMilliseconds: true })!,
        amount: VOUCHER_AMOUNT,
        minimumSubtotal: VOUCHER_MIN_SUBTOTAL,
        appliesOncePerCustomer: true,
        // ⛔ Le quota TOTAL, celui qui rend « une seule fois » infalsifiable.
        usageLimit: 1,
      })

      if (created.userErrors.length) {
        // On ne relance PAS en aveugle : `discountCodeBasicCreate` peut renvoyer une erreur ET
        // avoir créé la remise (bug Shopify confirmé par son propre staff, déjà rencontré par
        // la rotation hebdomadaire). La relecture ci-dessous tranche.
        lastError = created.userErrors.join(' | ')
        Logger.warn(
          'newsletter voucher %s: erreurs à la création (%s) — on relit avant de conclure',
          code,
          lastError
        )
      }

      // --- RELECTURE OBLIGATOIRE, quoi qu'ait répondu la mutation --------------------
      const node = await this.shopify.discount.getCodeDiscountByCode(code)
      if (!node) {
        Logger.warn('newsletter voucher %s: introuvable après création, nouveau tirage', code)
        continue
      }

      // La date de fin retenue est celle que SHOPIFY confirme, pas celle qu'on espérait :
      // l'e-mail annoncera donc une échéance vraie, même si la remise a été bornée autrement.
      const confirmedEnd = node.endsAt ? DateTime.fromISO(node.endsAt) : endsAt

      Logger.info(
        'newsletter voucher: %s créé pour %s, valide jusqu’au %s',
        code,
        subscriberRef,
        confirmedEnd.toISO()
      )

      return {
        code,
        discountGid: node.id,
        expiresTs: Math.floor(confirmedEnd.toSeconds()),
        expiresAt: confirmedEnd,
      }
    }

    throw new Error(
      `impossible de créer un bon après ${MAX_ATTEMPTS} tentatives${lastError ? ` — ${lastError}` : ''}`
    )
  }

  /**
   * Le bon a-t-il été consommé ?
   *
   * ⚠️ Lu dans le SEUL SENS SÛR. `asyncUsageCount` est incrémenté en différé par Shopify : il
   * peut retarder sur la réalité, jamais l'inventer. On en tire donc uniquement la conclusion
   * positive — « > 0, donc la personne a acheté, on arrête ». Le lire à 0 ne prouve rien et ne
   * déclenche aucune décision : c'est le reste de la porte d'avant-envoi qui tranche.
   *
   * `null` = on n'a pas pu savoir (remise introuvable). L'appelant doit alors REPORTER, jamais
   * conclure que le code est intact.
   */
  public async isConsumed(code: string): Promise<boolean | null> {
    const node = await this.shopify.discount.getCodeDiscountByCode(code)
    if (!node) return null
    return node.asyncUsageCount > 0
  }
}
