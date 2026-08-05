import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import { clientIp } from 'App/Services/ClientIp'
import NewsletterSubscribe from 'App/Services/Newsletter/Subscribe'
import NewsletterUnsubscribe from 'App/Services/Newsletter/Unsubscribe'
import { NewsletterMailer } from 'App/Services/Newsletter/mail'
import {
  renderUnsubscribeConfirm,
  renderUnsubscribeDone,
} from 'App/Services/Newsletter/emails/unsubscribePage'
import { isValidEmail, normalizeEmail, normalizeLocale } from 'App/Services/Newsletter/identity'
import { DEFAULT_LOCALE } from 'App/Services/Newsletter/config'

/**
 * API publique de la séquence du bon de 15 €.
 *
 *   POST /api/newsletter/subscribe  — l'encart produit
 *   GET  /u/:token                  — page de confirmation, NE DÉSABONNE PAS
 *   POST /u/:token                  — désabonne (formulaire ET un-clic RFC 8058)
 *
 * ⛔ Les trois routes doivent figurer dans `csrf.exceptRoutes` (config/shield.ts) avec leur
 * PATRON EXACT : `@adonisjs/shield` compare avec un `Array.includes` sur `route.pattern`, il
 * n'y a pas de joker. Sans l'exception, le POST un-clic de Gmail/Yahoo — qui arrive sans
 * cookie ni jeton — renverrait 403 : désabonnement techniquement présent, fonctionnellement
 * mort, donc plaintes, donc compte d'envoi suspendu.
 */
export default class NewsletterController {
  /**
   * Inscription depuis l'encart produit.
   *
   * Réponse en moins de 2 secondes : l'encart affiche l'écran du code sur cette réponse. Le
   * code doit donc y figurer — c'est le seul travail qu'on ne peut pas différer.
   */
  public async subscribe({ request, response }: HttpContextContract) {
    if (!this.originAllowed(request.header('origin'))) {
      Logger.warn('newsletter subscribe: origine refusée (%s)', request.header('origin'))
      return response.status(403).json({ ok: false, error: 'forbidden_origin' })
    }

    const body = request.body() ?? {}

    // Pot de miel : un champ invisible côté thème. Rempli = robot. On répond 200 comme si
    // tout allait bien — un 400 renseignerait l'attaquant sur la présence du piège.
    if (String(body.hp ?? '').trim() !== '') {
      Logger.info('newsletter subscribe: pot de miel déclenché')
      return response.status(200).json({ ok: true, state: 'subscribed' })
    }

    const email = normalizeEmail(body.email)
    if (!isValidEmail(email)) {
      return response.status(400).json({ ok: false, error: 'invalid_email' })
    }
    if (body.consent !== true && body.consent !== 'true') {
      return response.status(400).json({ ok: false, error: 'consent_required' })
    }

    try {
      const outcome = await new NewsletterSubscribe().handle({
        email,
        locale: body.locale,
        sourceUrl: typeof body.source_url === 'string' ? body.source_url : undefined,
        consent: true,
        consentLabel: typeof body.consent_label === 'string' ? body.consent_label : undefined,
        ip: clientIp(request),
        userAgent: request.header('user-agent') ?? null,
      })

      if (!outcome.ok) {
        const status = outcome.error === 'rate_limited' ? 429 : 400
        return response.status(status).json(outcome)
      }

      return response.status(200).json({
        ok: true,
        state: outcome.state,
        ...(outcome.code ? { code: outcome.code, expires_at: outcome.expiresAt } : {}),
      })
    } catch (error) {
      // Jamais de 500 pour l'encart : il afficherait une erreur technique à un client qui n'y
      // peut rien. On renvoie un refus honnête, et le marchand voit la vraie cause au journal.
      Logger.error('newsletter subscribe: échec inattendu — %s', (error as any)?.message ?? error)
      return response.status(200).json({ ok: false, error: 'temporarily_unavailable' })
    }
  }

  /**
   * Restriction d'origine PROPRE À CETTE ROUTE.
   *
   * La configuration CORS du projet est globale et sert aussi le studio CustomArt et
   * l'extension Chrome du marchand ; la resserrer là-dessus casserait ces deux-là. On
   * applique donc ici la règle du brief — les deux domaines de la boutique, rien d'autre —
   * sans toucher au reste.
   *
   * Une requête SANS en-tête `Origin` (curl, appel serveur à serveur, test) passe : c'est la
   * sémantique même de CORS, qui n'a jamais rien bloqué en dehors d'un navigateur. Cette
   * garde écarte les intégrations tierces, elle ne remplace pas la limitation de débit ni le
   * pot de miel.
   */
  private originAllowed(origin: string | undefined): boolean {
    if (!origin) return true
    const allowed = [
      Env.get('STOREFRONT_URL'),
      Env.get('FRONTEND_URL'),
      'https://www.myselfmonart.com',
      'https://myselfmonart.com',
    ]
      .filter(Boolean)
      .map((o) => String(o).replace(/\/+$/, ''))
    return allowed.includes(origin.replace(/\/+$/, ''))
  }

  /**
   * Page de confirmation du désabonnement — dans la langue du contact.
   *
   * ⛔ NE DÉSABONNE PAS, et ce n'est pas un oubli. RFC 8058 : « anti-spam software often
   * fetches all resources in mail header fields automatically, without any action by the
   * user ». Un GET actif produirait des désabonnements FANTÔMES déclenchés par des robots.
   */
  public async unsubscribePage({ params, response }: HttpContextContract) {
    const subscriber = await new NewsletterUnsubscribe().resolve(params.token)

    // Jeton inconnu : on affiche quand même « c'est fait », dans la langue par défaut. Dire
    // « ce lien est invalide » à quelqu'un qui veut partir, c'est le pousser vers le bouton
    // « spam » — le seul geste qui coûte vraiment cher.
    if (!subscriber) {
      return response
        .status(200)
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(renderUnsubscribeDone(DEFAULT_LOCALE))
    }

    if (subscriber.status === 'unsubscribed') {
      return response
        .status(200)
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(renderUnsubscribeDone(normalizeLocale(subscriber.locale)))
    }

    const base = String(Env.get('BACKEND_URL') || 'https://backend.myselfmonart.com').replace(
      /\/+$/,
      ''
    )
    return response
      .status(200)
      .header('Content-Type', 'text/html; charset=utf-8')
      .send(
        renderUnsubscribeConfirm(
          normalizeLocale(subscriber.locale),
          `${base}/u/${subscriber.unsubToken}`
        )
      )
  }

  /**
   * Désabonnement effectif. Sert DEUX appelants :
   *   • le formulaire de la page ci-dessus (un humain a cliqué) ;
   *   • le POST un-clic de Gmail/Yahoo (`List-Unsubscribe=One-Click`), sans cookie ni jeton.
   *
   * Idempotent, et répond 200 dans tous les cas — y compris sur un jeton inconnu. Un 404
   * ferait conclure au fournisseur de messagerie que le un-clic ne fonctionne pas, et il
   * retirerait le bouton natif.
   */
  public async unsubscribe({ params, request, response }: HttpContextContract) {
    const service = new NewsletterUnsubscribe()
    const subscriber = await service.resolve(params.token)

    if (subscriber) {
      try {
        await service.unsubscribe(subscriber, {
          ip: clientIp(request),
          userAgent: request.header('user-agent') ?? null,
          source: 'one-click',
        })
      } catch (error) {
        // Le blocage local a normalement déjà eu lieu ; si ce n'est pas le cas, on le
        // journalise bruyamment. On répond quand même 200 : le fournisseur de messagerie ne
        // doit jamais conclure que le un-clic est cassé.
        Logger.error(
          'newsletter: désabonnement #%s en échec — %s',
          subscriber.id,
          (error as any)?.message ?? error
        )
      }
    } else {
      Logger.info('newsletter: désabonnement sur jeton inconnu')
    }

    // Gmail et Yahoo attendent une réponse VIDE et un 200. La page « c'est fait » n'a de sens
    // que pour un humain arrivé par le formulaire — d'où la distinction sur l'en-tête Accept.
    const wantsHtml = (request.header('accept') ?? '').includes('text/html')
    if (wantsHtml) {
      return response
        .status(200)
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(renderUnsubscribeDone(normalizeLocale(subscriber?.locale)))
    }
    return response.status(200).send('')
  }

  /**
   * Santé du dispositif — même esprit que `GET /promo/status` : vérifier sans ouvrir l'admin
   * ni la base. Volontairement sans donnée personnelle : que des compteurs.
   */
  public async status({ response }: HttpContextContract) {
    const { default: Database } = await import('@ioc:Adonis/Lucid/Database')

    const count = async (table: string, build: (q: any) => any) => {
      const rows = await build(Database.from(table)).count('* as total')
      return Number(rows?.[0]?.total ?? 0)
    }

    return response.json({
      subscribers: {
        active: await count('newsletter_subscribers', (q) => q.where('status', 'active')),
        unsubscribed: await count('newsletter_subscribers', (q) =>
          q.where('status', 'unsubscribed')
        ),
        bounced: await count('newsletter_subscribers', (q) => q.where('status', 'bounced')),
        complained: await count('newsletter_subscribers', (q) => q.where('status', 'complained')),
        pendingSync: await count('newsletter_subscribers', (q) =>
          q.where('shopify_sync_pending', true)
        ),
      },
      sends: {
        sent: await count('newsletter_sends', (q) => q.where('status', 'sent')),
        skipped: await count('newsletter_sends', (q) => q.where('status', 'skipped')),
        unknown: await count('newsletter_sends', (q) => q.where('status', 'unknown')),
      },
      suppressions: await count('newsletter_suppressions', (q) => q),
      transport: {
        selected: new NewsletterMailer().transport()?.name ?? null,
        forced: Env.get('NEWSLETTER_MAIL_TRANSPORT') || null,
      },
    })
  }
}
