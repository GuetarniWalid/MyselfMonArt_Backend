import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import SesFeedback from 'App/Services/Newsletter/SesFeedback'

/**
 * `POST /webhooks/ses` — rebonds et plaintes d'Amazon SES, livrés par SNS.
 *
 * ⛔ TROIS PIÈGES, tous mortels ET SILENCIEUX :
 *
 *   1. SNS POSTe avec `Content-Type: text/plain`, que `config/bodyparser.ts` route vers le
 *      parseur RAW. `request.body()` vaudrait `{}` et cet endpoint répondrait 200 sur une
 *      charge vide, pour toujours. On lit donc `await request.raw()`.
 *   2. Sans traitement de `SubscriptionConfirmation`, l'abonnement SNS reste en
 *      `PendingConfirmation` et RIEN n'arrive jamais.
 *   3. Sans authentification, n'importe qui peut forger une plainte et faire désabonner —
 *      irréversiblement — les clients du marchand.
 *
 * Répond TOUJOURS 200, y compris sur une charge inconnue : un 5xx fait retenter SNS, puis
 * abandonner. Le refus d'authentification, lui, répond 401 — il n'y a rien à retenter.
 *
 * ⛔ La route doit figurer dans `csrf.exceptRoutes` avec son patron EXACT (`/webhooks/ses`) :
 * shield compare par `Array.includes`, sans joker.
 */
export default class SesWebhookController {
  public async receive({ request, response }: HttpContextContract) {
    const service = new SesFeedback()

    // --- Couche a : jeton partagé, avant toute analyse ------------------------------
    if (!service.verifyToken(request.input('token'))) {
      Logger.warn('newsletter ses: jeton absent ou invalide — rejeté')
      return response.status(401).send('')
    }

    // --- Piège n°1 : lire le corps BRUT --------------------------------------------
    let envelope: any
    try {
      // `request.raw()` renvoie une chaîne quand le parseur RAW a traité le corps (le cas
      // ici : SNS poste en `text/plain`, routé vers `raw` par config/bodyparser.ts).
      const raw = (await request.raw()) ?? ''
      envelope = JSON.parse(String(raw))
    } catch (error) {
      Logger.warn('newsletter ses: corps illisible — %s', (error as any)?.message ?? error)
      // 200 : SNS ne doit pas retenter une charge qu'on ne saura jamais lire.
      return response.status(200).send('')
    }

    // --- Couche b : le topic est-il le nôtre ? --------------------------------------
    if (!service.verifyTopic(envelope?.TopicArn)) {
      Logger.warn('newsletter ses: TopicArn inattendu (%s) — ignoré', envelope?.TopicArn)
      return response.status(200).send('')
    }

    try {
      await service.handleEnvelope(envelope)
    } catch (error) {
      // On journalise et on répond 200 : faire retenter SNS sur une erreur applicative
      // n'améliore rien et finit par faire abandonner le message.
      Logger.error('newsletter ses: traitement en échec — %s', (error as any)?.message ?? error)
    }

    return response.status(200).send('')
  }
}
