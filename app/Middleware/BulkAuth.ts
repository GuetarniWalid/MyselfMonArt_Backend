import crypto from 'crypto'
import Env from '@ioc:Adonis/Core/Env'
import { AuthenticationException } from '@adonisjs/auth/build/standalone'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

/**
 * Auth des routes du batch « posters en masse » (cf. BulkPostersController).
 *
 * Accepte DEUX modes, pour servir à la fois :
 *   - le moteur de rendu PC (workflow sans navigateur) : en-tête `x-bulk-token` == BULK_POSTERS_TOKEN ;
 *   - la page /bulk-posters historique (navigateur, abandonnée mais conservée) : session (guard par défaut).
 *
 * Si BULK_POSTERS_TOKEN n'est pas configuré, seul le chemin session reste — comportement identique
 * à l'ancien `['auth']`. La comparaison du token est à temps constant (timingSafeEqual).
 */
export default class BulkAuthMiddleware {
  private tokenMatches(provided: string | undefined): boolean {
    const expected = Env.get('BULK_POSTERS_TOKEN') as string | undefined
    if (!expected || !provided) return false
    const a = Buffer.from(provided)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(new Uint8Array(a), new Uint8Array(b))
  }

  public async handle(ctx: HttpContextContract, next: () => Promise<void>) {
    // 1) Jeton de service (moteur de rendu PC) : voie privilégiée, aucune session requise.
    if (this.tokenMatches(ctx.request.header('x-bulk-token'))) {
      return next()
    }

    // 2) Repli sur la session (guard par défaut), comme l'ancien middleware `auth`.
    try {
      if (await ctx.auth.check()) {
        return next()
      }
    } catch {
      // pas de session valide -> on tombe sur l'exception ci-dessous
    }

    throw new AuthenticationException(
      'Unauthorized access',
      'E_UNAUTHORIZED_ACCESS',
      ctx.auth?.name,
      '/login'
    )
  }
}
