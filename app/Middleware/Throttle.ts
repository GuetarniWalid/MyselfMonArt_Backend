import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import { clientIp } from 'App/Services/ClientIp'

interface Bucket {
  count: number
  resetAt: number
}

// Garde-fou mémoire : au-delà, on purge les fenêtres expirées (anti-fuite mémoire)
const MAX_BUCKETS = 20000

/**
 * Rate limiting minimal en mémoire (fenêtre fixe par IP + route).
 * Aucun limiteur n'existait dans le projet (pas de @adonisjs/limiter en deps) ;
 * celui-ci suffit comme anti-abus. NB : les buckets sont par process — en cluster
 * PM2 la limite effective est max × instances (ordre de grandeur conservé).
 *
 * Usage : .middleware(['throttle:10,60']) -> 10 requêtes max par fenêtre de 60 s.
 * Réponse au-delà : 429 + Retry-After (secondes).
 */
export default class Throttle {
  private static buckets = new Map<string, Bucket>()

  public async handle(ctx: HttpContextContract, next: () => Promise<void>, guards: string[]) {
    const { request, response } = ctx
    const max = parseInt(guards[0] || '60', 10)
    const windowSec = parseInt(guards[1] || '60', 10)
    const now = Date.now()

    // Clé sur le PATTERN de route (/jobs/:uuid) et non l'URL concrète : avec l'URL,
    // chaque uuid aurait son propre bucket et la limite par IP des routes paramétrées
    // serait contournable (il suffirait de varier l'uuid pour ne jamais atteindre le seuil).
    const pattern = ctx.route?.pattern || request.url()
    const key = `${clientIp(request)}:${request.method()}:${pattern}`

    Throttle.pruneIfNeeded(now)

    let bucket = Throttle.buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowSec * 1000 }
      Throttle.buckets.set(key, bucket)
    }

    bucket.count++
    if (bucket.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))

      // ⛔ UN REFUS MUET EST INDIAGNOSTICABLE. Un 429 posé ici n'écrit rien en base et ne
      // traverse pas le contrôleur : vu du dehors, il ressemble trait pour trait à une réponse
      // métier sans code. C'est ce qui a rendu impossible de départager, sur l'incident
      // « déjà inscrit, reparti sans son bon », un refus de débit d'un refus applicatif.
      // Seule la PREMIÈRE requête refusée de chaque fenêtre est journalisée : sous un flot,
      // les suivantes n'apprendraient rien et noieraient le journal.
      if (bucket.count === max + 1) {
        Logger.warn(
          'throttle: %s refusé (%s/%s s), reprise dans %s s',
          key,
          max,
          windowSec,
          retryAfterSec
        )
      }

      response.header('Retry-After', String(retryAfterSec))
      return response.status(429).json({
        // ⛔ DEUX FORMES DANS UN MÊME CORPS, et c'est délibéré. Un 429 peut sortir d'ici OU du
        // contrôleur, et un client ne doit pas avoir à savoir laquelle des deux couches a
        // refusé pour comprendre la réponse. `ok`/`error` est le contrat de l'encart
        // newsletter ; `success`/`message` est la forme historique que lisent déjà le studio
        // custom-art et l'extension du marchand. Retirer l'une des deux casse un appelant.
        ok: false,
        error: 'rate_limited',
        // De quoi écrire « réessayez demain » plutôt que « dans un instant » quand la fenêtre
        // se compte en heures : le message affiché doit être vrai.
        scope: windowSec >= 86400 ? 'day' : windowSec >= 3600 ? 'hour' : 'minute',
        retry_after: retryAfterSec,
        success: false,
        message: 'Trop de demandes. Patiente un instant puis réessaie.',
      })
    }

    await next()
  }

  /** Purge des fenêtres expirées quand la map grossit trop (best-effort). */
  private static pruneIfNeeded(now: number): void {
    if (Throttle.buckets.size < MAX_BUCKETS) return
    for (const [key, bucket] of Throttle.buckets) {
      if (bucket.resetAt <= now) Throttle.buckets.delete(key)
    }
  }
}
