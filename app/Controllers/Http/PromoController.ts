import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import PromoRotationService, { PROMO_NAMESPACE, PROMO_KEYS } from 'App/Services/PromoRotation'
import Shopify from 'App/Services/Shopify'

export default class PromoController {
  /**
   * Route de santé de la rotation du code promo : code courant, date de fin, jours
   * restants. C'est ce qu'on interroge pour vérifier sans ouvrir l'admin Shopify.
   *
   *   GET /promo/status            → état lu en base (aucun appel Shopify)
   *   GET /promo/status?live=1     → + ce que Shopify sert réellement au thème
   *
   * Publique et sans secret : le code est déjà affiché sur chaque fiche produit.
   */
  public async status({ request, response }: HttpContextContract) {
    const service = new PromoRotationService()
    const state = await service.status()

    if (!request.input('live')) return response.json(state)

    // Vue « en direct » : ce que le thème lit vraiment. Un écart avec l'état en base
    // signale une écriture manuelle dans l'admin — le prochain passage du cron le corrige.
    try {
      const metafields = await new Shopify().shop.getMetafields(PROMO_NAMESPACE, [...PROMO_KEYS])
      return response.json({
        ...state,
        shopify: metafields,
        inSync:
          metafields.code === state.code &&
          metafields.ends_at === state.endsAt &&
          metafields.ends_ts === (state.endsTs === null ? null : String(state.endsTs)),
      })
    } catch (error) {
      return response.json({ ...state, shopify: null, shopifyError: error?.message })
    }
  }
}
