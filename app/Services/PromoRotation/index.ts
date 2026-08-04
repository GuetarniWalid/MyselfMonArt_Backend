import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import PromoRotation from 'App/Models/PromoRotation'
import Shopify from 'App/Services/Shopify'
import PromoAlertMailer from './AlertMailer'
import { codeForWeek, rotationSecret } from './code'
import { currentIsoWeek, renderEnds, windowForWeek, FALLBACK_TIMEZONE, VALIDITY_DAYS } from './week'

/** Namespace MARCHAND (surtout pas `$app` ni `app--<id>--…`), lisible en Liquid sans réglage. */
export const PROMO_NAMESPACE = 'promo'
export const PROMO_KEYS = ['code', 'ends_at', 'ends_ts'] as const

/** Montant déduit, et sous-total minimum exigé. */
const DISCOUNT_AMOUNT = '15.0'
const MINIMUM_SUBTOTAL = '80.0'

/** Délai de grâce avant désactivation d'une remise expirée (ménage cosmétique). */
const CLEANUP_GRACE_DAYS = 30

/** Deux passages en échec consécutifs déclenchent l'alerte e-mail. */
const ALERT_AFTER_ATTEMPTS = 2

export interface RotationOutcome {
  isoWeek: string
  code: string
  endsAt: string | null
  endsTs: number | null
  /**
   * `noop`        — la semaine était déjà publiée et les métachamps sont conformes
   * `created`     — remise créée puis publiée
   * `reused`      — la remise existait déjà (relance) et a été publiée
   * `repaired`    — métachamps réécrits parce qu'ils ne correspondaient plus
   * `failed`      — rien n'a été publié ; l'ancien code reste en place et valide
   */
  action: 'noop' | 'created' | 'reused' | 'repaired' | 'failed'
  discountGid: string | null
  error?: string
}

/**
 * Rotation automatique du code promo de l'encart produit — conçue pour tourner des années
 * sans surveillance.
 *
 * PRINCIPE — Le cron écrit trois métachamps de BOUTIQUE (`promo.code`, `promo.ends_at`,
 * `promo.ends_ts`), que le thème lit en Liquid. Aucun fichier de thème n'est jamais touché :
 * pas de dérogation Shopify à obtenir, pas de course avec l'éditeur de thème ni avec le
 * pipeline de déploiement, pas de scope d'écriture sur le thème, et `metafieldsSet` est un
 * upsert atomique (ce que `settings_data.json` n'offre pas).
 *
 * SÉQUENCE — l'ordre ne s'inverse jamais :
 *
 *   1. Verrou              (BaseTask.useLock : un seul lancement à la fois)
 *   2. Code déterministe   (HMAC de la semaine ISO — jamais d'aléatoire)
 *   3. Garde en base       (UNIQUE(iso_week))
 *   4. Lookup              (la remise existe-t-elle déjà ?)
 *   5. Création            (discountCodeBasicCreate)
 *   6. RELECTURE           (systématique, quoi qu'ait répondu la mutation)
 *   7. Publication         (metafieldsSet, UNIQUEMENT si la relecture confirme)
 *
 * L'étape 6 n'est pas une précaution mais une obligation : `discountCodeBasicCreate` peut
 * renvoyer une erreur ET avoir créé la remise (bug Shopify confirmé par son staff). On ne
 * relance donc jamais en aveugle — on relit. Et publier avant d'avoir confirmé ferait
 * pointer l'encart vers un code inexistant : le client verrait « votre code » et le checkout
 * le refuserait.
 *
 * MODE DE DÉFAILLANCE VISÉ — *fail-stale*. En cas de panne, on ne touche à rien : l'ancien
 * code reste publié et reste valide. Aucun nettoyage dans un `catch`, jamais de suppression
 * en réaction à une erreur. Si le cron ne tourne plus pendant des semaines, l'ancien code
 * expire, `ends_ts` devient passé, et le thème éteint l'encart tout seul.
 *
 *   Le pire cas acceptable est que l'offre disparaisse.
 *   Le pire cas inacceptable est qu'elle affiche un code mort.
 */
export default class PromoRotationService {
  private shopify = new Shopify()

  /**
   * Un tour complet. Ne lève jamais : les échecs sont journalisés, comptés, et transformés
   * en alerte au bout de deux passages — la rotation ne doit pas pouvoir faire tomber le
   * scheduler.
   */
  public async rotate(): Promise<RotationOutcome> {
    let isoWeek = '?'
    let code = '?'

    try {
      const shop = await this.shopify.shop.getContext()
      const timezone = shop.ianaTimezone || FALLBACK_TIMEZONE

      // Amorçage idempotent des définitions — best-effort, jamais bloquant : les métachamps
      // sont lisibles en Liquid même sans définition.
      await this.ensureDefinitions()

      isoWeek = currentIsoWeek(timezone)
      code = codeForWeek(isoWeek, rotationSecret())
      const window = windowForWeek(isoWeek, timezone)
      const planned = renderEnds(window.endsAt, timezone)

      // --- Étape 3 : garde en base --------------------------------------------------
      // La ligne seule ne suffit pas à sauter le travail : une semaine amorcée mais non
      // publiée doit être retentée (§8). Seul `published` est un état terminal.
      const row = await this.claimWeek(isoWeek, code, window.endsAt, planned.endsTs)

      if (row.status === 'published') {
        return await this.verifyPublished(row, shop.id, timezone)
      }

      // --- Étape 4 : lookup ---------------------------------------------------------
      let node = await this.shopify.discount.getCodeDiscountByCode(code)
      let action: RotationOutcome['action'] = node ? 'reused' : 'created'

      // --- Étape 5 : création -------------------------------------------------------
      if (!node) {
        const created = await this.shopify.discount.createBasicCodeDiscount({
          title: `Encart promo — semaine ${isoWeek}`,
          code,
          startsAt: window.startsAt.toISO({ suppressMilliseconds: true })!,
          endsAt: window.endsAt.toISO({ suppressMilliseconds: true })!,
          amount: DISCOUNT_AMOUNT,
          minimumSubtotal: MINIMUM_SUBTOTAL,
          appliesOncePerCustomer: true,
        })
        if (created.userErrors.length) {
          // On NE relance PAS et on ne nettoie rien : la remise a peut-être été créée
          // malgré l'erreur. La relecture ci-dessous tranchera.
          Logger.warn(
            'promo rotation %s: discountCodeBasicCreate a renvoyé des erreurs (%s) — on relit avant de conclure',
            isoWeek,
            created.userErrors.join(' | ')
          )
        }
      }

      // --- Étape 6 : RELECTURE, quoi qu'il arrive -----------------------------------
      node = await this.shopify.discount.getCodeDiscountByCode(code)
      if (!node) {
        return await this.recordFailure(
          row,
          `la remise ${code} reste introuvable après création — rien n'a été publié`
        )
      }

      // --- Étape 7 : publication ----------------------------------------------------
      // Les métachamps décrivent l'instant CONFIRMÉ par Shopify (et non celui qu'on
      // espérait) : si la remise préexistait avec d'autres bornes, l'encart dit la vérité.
      const confirmedEnd = node.endsAt
        ? DateTime.fromISO(node.endsAt, { zone: timezone })
        : window.endsAt
      const ends = renderEnds(confirmedEnd, timezone)

      await this.publish(shop.id, code, ends)

      row.code = code
      row.discountGid = node.id
      row.endsAt = confirmedEnd
      row.endsTs = ends.endsTs
      row.status = 'published'
      row.publishedAt = DateTime.now()
      row.lastError = null
      await row.save()

      Logger.info(
        'promo rotation %s: %s publié (%s), valide jusqu’au %s',
        isoWeek,
        code,
        action,
        ends.endsAt
      )

      return {
        isoWeek,
        code,
        endsAt: ends.endsAt,
        endsTs: ends.endsTs,
        action,
        discountGid: node.id,
      }
    } catch (error) {
      // Échec dur (API indisponible, base injoignable…) : on ne publie rien, on ne
      // désactive rien. L'ancien code continue de fonctionner.
      const message = error?.message ?? String(error)
      Logger.error('promo rotation %s: échec — %s', isoWeek, message)

      const row = await PromoRotation.findBy('iso_week', isoWeek)
      if (row) return await this.recordFailure(row, message)

      return {
        isoWeek,
        code,
        endsAt: null,
        endsTs: null,
        action: 'failed',
        discountGid: null,
        error: message,
      }
    }
  }

  /**
   * Ménage de l'admin : désactive les remises créées par ce cron dont la fin est dépassée de
   * plus de 30 jours. Jamais avant — la validité de 14 jours et son recouvrement de 7 jours
   * sont ce qui protège les pages en cache. Aucun effet sur les commandes déjà passées.
   *
   * On ne balaie que NOS lignes : une remise créée à la main par le marchand n'est jamais
   * touchée, faute d'être connue de cette table.
   */
  public async cleanup(): Promise<number> {
    const cutoff = DateTime.now().minus({ days: CLEANUP_GRACE_DAYS })

    const stale = await PromoRotation.query()
      .whereNotNull('discount_gid')
      .whereNull('deactivated_at')
      .where('ends_at', '<', cutoff.toSQL({ includeOffset: false })!)

    let done = 0
    for (const row of stale) {
      try {
        const errors = await this.shopify.discount.deactivateCodeDiscount(row.discountGid!)
        if (errors.length) {
          // Le ménage est cosmétique : on journalise et on classe l'affaire. Une remise déjà
          // expirée refuse souvent d'être désactivée — inutile d'y revenir tous les jours.
          Logger.info('promo cleanup %s: désactivation refusée (%s)', row.code, errors.join(' | '))
        }
        row.deactivatedAt = DateTime.now()
        await row.save()
        done++
      } catch (error) {
        // Jamais bloquant : le ménage réessaiera demain.
        Logger.warn('promo cleanup %s: %s', row.code, error?.message ?? String(error))
      }
    }

    if (done) Logger.info('promo cleanup: %s remise(s) expirée(s) désactivée(s)', done)
    return done
  }

  /**
   * État du dispositif, lu en base (aucun appel Shopify) : c'est ce que sert
   * `GET /promo/status`, pour vérifier sans ouvrir l'admin.
   */
  public async status() {
    const now = DateTime.now()

    const current = await PromoRotation.query()
      .where('status', 'published')
      .orderBy('ends_at', 'desc')
      .first()

    const lastSuccess = await PromoRotation.query()
      .where('status', 'published')
      .orderBy('published_at', 'desc')
      .first()

    const lastAttempt = await PromoRotation.query().orderBy('id', 'desc').first()

    const live = current !== null && current.endsAt > now

    return {
      ok: live,
      code: live ? current!.code : null,
      endsAt: live ? current!.endsAt.toISO() : null,
      endsTs: live ? current!.endsTs : null,
      daysRemaining: live ? Math.max(0, Math.ceil(current!.endsAt.diff(now, 'days').days)) : 0,
      isoWeek: current?.isoWeek ?? null,
      validityDays: VALIDITY_DAYS,
      lastSuccessAt: lastSuccess?.publishedAt?.toISO() ?? null,
      lastAttempt: lastAttempt
        ? {
            isoWeek: lastAttempt.isoWeek,
            status: lastAttempt.status,
            attempts: lastAttempt.attempts,
            error: lastAttempt.lastError,
          }
        : null,
    }
  }

  // --- interne -------------------------------------------------------------------

  /**
   * Trois définitions de métachamp de boutique, créées une fois pour toutes. « Existe déjà »
   * est un succès. Un échec ici n'empêche PAS la publication : en Liquid, un métachamp est
   * lisible avec ou sans définition.
   *
   * ⚠️ L'admin ne liste pas toujours les métachamps d'owner SHOP : ne jamais conclure qu'une
   * définition manque parce qu'on ne la voit pas — passer par
   * `metafieldDefinitions(ownerType: SHOP, first: 50)`.
   */
  private async ensureDefinitions(): Promise<void> {
    const definitions = [
      {
        key: 'code',
        name: 'Encart promo — code',
        type: 'single_line_text_field',
        description: 'Code de réduction affiché dans l’encart produit. Écrit automatiquement.',
      },
      {
        key: 'ends_at',
        name: 'Encart promo — fin (affichage)',
        type: 'single_line_text_field',
        description: 'Fin de validité en ISO 8601 avec décalage. Sert à AFFICHER la date.',
      },
      {
        key: 'ends_ts',
        name: 'Encart promo — fin (comparaison)',
        type: 'number_integer',
        description: 'Le même instant en secondes epoch. Sert à COMPARER l’extinction.',
      },
    ]

    for (const definition of definitions) {
      try {
        const res = await this.shopify.shop.ensureMetafieldDefinition({
          namespace: PROMO_NAMESPACE,
          ...definition,
        })
        if (res.errors.length) {
          Logger.warn(
            'promo rotation: définition %s.%s refusée (%s)',
            PROMO_NAMESPACE,
            definition.key,
            res.errors.join(' | ')
          )
        } else if (res.id) {
          Logger.info('promo rotation: définition %s.%s créée', PROMO_NAMESPACE, definition.key)
        }
      } catch (error) {
        Logger.warn(
          'promo rotation: définition %s.%s injoignable — %s',
          PROMO_NAMESPACE,
          definition.key,
          error?.message ?? String(error)
        )
      }
    }
  }

  /** Pose (ou récupère) la ligne de la semaine. La contrainte UNIQUE arbitre les courses. */
  private async claimWeek(
    isoWeek: string,
    code: string,
    endsAt: DateTime,
    endsTs: number
  ): Promise<PromoRotation> {
    const existing = await PromoRotation.findBy('iso_week', isoWeek)
    if (existing) return existing

    try {
      return await PromoRotation.create({ isoWeek, code, endsAt, endsTs, status: 'pending' })
    } catch (error) {
      // Course perdue contre un autre lancement : sa ligne fait foi.
      const row = await PromoRotation.findBy('iso_week', isoWeek)
      if (row) return row
      throw error
    }
  }

  /**
   * La semaine est déjà publiée : on vérifie que les métachamps disent toujours la même
   * chose, et on les réécrit sinon.
   *
   * Ce n'est pas une réécriture aveugle — c'est ce qui rend le dispositif réellement
   * « posé une fois, plus jamais touché » : un métachamp effacé par mégarde reviendrait
   * sinon seulement au lundi suivant. Le vrai interrupteur de l'offre reste le réglage
   * « Encart promo » du thème, pas ces valeurs.
   */
  private async verifyPublished(
    row: PromoRotation,
    shopId: string,
    timezone: string
  ): Promise<RotationOutcome> {
    const ends = renderEnds(row.endsAt, timezone)

    let live: Record<string, string | null>
    try {
      live = await this.shopify.shop.getMetafields(PROMO_NAMESPACE, [...PROMO_KEYS])
    } catch (error) {
      // Lecture impossible : on ne réécrit rien à l'aveugle.
      Logger.warn(
        'promo rotation %s: relecture des métachamps impossible — %s',
        row.isoWeek,
        error?.message ?? String(error)
      )
      return {
        isoWeek: row.isoWeek,
        code: row.code,
        endsAt: ends.endsAt,
        endsTs: ends.endsTs,
        action: 'noop',
        discountGid: row.discountGid,
      }
    }

    const conform =
      live.code === row.code && live.ends_at === ends.endsAt && live.ends_ts === String(ends.endsTs)

    if (conform) {
      return {
        isoWeek: row.isoWeek,
        code: row.code,
        endsAt: ends.endsAt,
        endsTs: ends.endsTs,
        action: 'noop',
        discountGid: row.discountGid,
      }
    }

    await this.publish(shopId, row.code, ends)
    Logger.info('promo rotation %s: métachamps réalignés sur %s', row.isoWeek, row.code)

    return {
      isoWeek: row.isoWeek,
      code: row.code,
      endsAt: ends.endsAt,
      endsTs: ends.endsTs,
      action: 'repaired',
      discountGid: row.discountGid,
    }
  }

  /** Écriture ATOMIQUE des trois métachamps : le thème ne lit jamais un code sans sa date. */
  private async publish(
    shopId: string,
    code: string,
    ends: { endsAt: string; endsTs: number }
  ): Promise<void> {
    await this.shopify.metafield.setMany([
      {
        ownerId: shopId,
        namespace: PROMO_NAMESPACE,
        key: 'code',
        value: code,
        type: 'single_line_text_field',
      },
      {
        ownerId: shopId,
        namespace: PROMO_NAMESPACE,
        key: 'ends_at',
        value: ends.endsAt,
        type: 'single_line_text_field',
      },
      {
        ownerId: shopId,
        namespace: PROMO_NAMESPACE,
        key: 'ends_ts',
        value: String(ends.endsTs),
        type: 'number_integer',
      },
    ])
  }

  /** Compte l'échec, alerte au deuxième, et ne touche à rien d'autre. */
  private async recordFailure(row: PromoRotation, message: string): Promise<RotationOutcome> {
    row.attempts += 1
    row.lastError = message.slice(0, 2000)
    await row.save()

    Logger.error(
      'promo rotation %s: tentative %s en échec — %s',
      row.isoWeek,
      row.attempts,
      message
    )

    if (row.attempts >= ALERT_AFTER_ATTEMPTS && !row.alertSentAt) {
      await this.alert(row, message)
    }

    return {
      isoWeek: row.isoWeek,
      code: row.code,
      endsAt: null,
      endsTs: null,
      action: 'failed',
      discountGid: row.discountGid,
      error: message,
    }
  }

  private async alert(row: PromoRotation, message: string): Promise<void> {
    const now = DateTime.now()

    const lastSuccess = await PromoRotation.query()
      .where('status', 'published')
      .orderBy('published_at', 'desc')
      .first()

    const stillLive = await PromoRotation.query()
      .where('status', 'published')
      .where('ends_at', '>', now.toSQL({ includeOffset: false })!)
      .orderBy('ends_at', 'desc')
      .first()

    const sent = await new PromoAlertMailer().sendRotationFailure({
      isoWeek: row.isoWeek,
      attempts: row.attempts,
      daysSinceLastSuccess: lastSuccess?.publishedAt
        ? Math.floor(now.diff(lastSuccess.publishedAt, 'days').days)
        : null,
      currentCode: stillLive?.code ?? null,
      currentEndsAt: stillLive?.endsAt.toISO() ?? null,
      error: message,
    })

    if (sent) {
      row.alertSentAt = now
      await row.save()
    }
  }
}
