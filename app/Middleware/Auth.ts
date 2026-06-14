import { AuthenticationException } from '@adonisjs/auth/build/standalone'
import type { GuardsList } from '@ioc:Adonis/Addons/Auth'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

/**
 * Auth middleware is meant to restrict un-authenticated access to a given route
 * or a group of routes.
 *
 * You must register this middleware inside `start/kernel.ts` file under the list
 * of named middleware.
 */
export default class AuthMiddleware {
  /**
   * The URL to redirect to when request is Unauthorized
   */
  protected redirectTo = '/login'

  /**
   * Authenticates the current HTTP request against a custom set of defined
   * guards.
   *
   * The authentication loop stops as soon as the user is authenticated using any
   * of the mentioned guards and that guard will be used by the rest of the code
   * during the current request.
   */
  protected async authenticate(auth: HttpContextContract['auth'], guards: (keyof GuardsList)[]) {
    /**
     * Hold reference to the guard last attempted within the for loop. We pass
     * the reference of the guard to the "AuthenticationException", so that
     * it can decide the correct response behavior based upon the guard
     * driver
     */
    let guardLastAttempted: string | undefined

    for (let guard of guards) {
      guardLastAttempted = guard

      if (await auth.use(guard).check()) {
        /**
         * Instruct auth to use the given guard as the default guard for
         * the rest of the request, since the user authenticated
         * succeeded here
         */
        auth.defaultGuard = guard
        return true
      }
    }

    /**
     * Unable to authenticate using any guard
     */
    throw new AuthenticationException(
      'Unauthorized access',
      'E_UNAUTHORIZED_ACCESS',
      guardLastAttempted,
      this.redirectTo
    )
  }

  /**
   * Handle request
   */
  public async handle(
    ctx: HttpContextContract,
    next: () => Promise<void>,
    customGuards: (keyof GuardsList)[]
  ) {
    const { auth, request, session } = ctx
    /**
     * Uses the user defined guards or the default guard mentioned in
     * the config file
     */
    const guards = customGuards.length ? customGuards : [auth.name]
    try {
      await this.authenticate(auth, guards)
    } catch (error) {
      // Mémorise la page demandée AVANT de rediriger vers le login Google, pour y revenir
      // après connexion (sinon SocialAuthsController renvoie toujours à l'accueil) :
      // ainsi les liens des emails admin (file de revue / file print) atterrissent au bon
      // endroit même quand la session a expiré. Uniquement pour une navigation HTML (pas XHR).
      if (request.method() === 'GET' && request.accepts(['html'])) {
        const target = request.url(true)
        if (target.startsWith('/') && !target.startsWith('/login')) {
          session?.put('intended_url', target)
        }
      }
      throw error
    }
    await next()
  }
}
