import Logger from '@ioc:Adonis/Core/Logger'
import Shopify from 'App/Services/Shopify'
import NewsletterSubscriber from 'App/Models/NewsletterSubscriber'
import NewsletterUnsubscribe from './Unsubscribe'

/**
 * `customers/email_marketing_consent/update` — DÉCLENCHEUR DE RELECTURE, JAMAIS UN ÉTAT.
 *
 * Quelqu'un peut se désabonner sans passer par nos e-mails : page de désabonnement native de
 * Shopify, compte client, ou l'admin lui-même. La porte d'avant-envoi le verrait — elle relit
 * le consentement en direct avant chaque message — mais seulement à la prochaine échéance, et
 * sans jamais inscrire la personne sur la liste repoussoir. Ce webhook comble ce trou : la
 * séquence s'arrête à la seconde, et une future soumission de la même adresse dans l'encart
 * est refusée avant le moindre appel Shopify.
 *
 * ⛔ L'ÉTAT VIENT DE L'API, PAS DE LA CHARGE UTILE. On n'en tire QUE l'identifiant client, puis
 * on relit. Deux raisons, et la première suffit : les charges utiles de webhook sont filtrées
 * indépendamment du niveau d'accès approuvé, donc l'adresse peut y être absente sans que rien
 * ne le signale. La seconde est que Shopify livre « au moins une fois » et SANS GARANTIE
 * D'ORDRE : deux événements qui se croisent feraient écrire le plus ancien en dernier. Relire
 * donne toujours l'état courant.
 *
 * ⛔ ON N'AGIT QUE SUR `UNSUBSCRIBED`, et c'est délibéré. C'est le seul état qui signifie
 * « s'était abonné puis s'est retiré ». `PENDING` est un double opt-in en cours et peut encore
 * aboutir ; `NOT_SUBSCRIBED`, `INVALID` et `REDACTED` sont des états que la porte d'envoi
 * refuse déjà d'elle-même. Les traiter ici poserait une empreinte sur la liste repoussoir pour
 * trois ans sur la foi d'un état transitoire — un client perdu, silencieusement.
 *
 * ⛔ ON NE CRÉE JAMAIS RIEN. Un passage à `SUBSCRIBED` ne déclenche aucune séquence : ce sont
 * les ~750 abonnés dormants de la boutique qui seraient réveillés, et c'est exactement le
 * scénario qui détruit un domaine d'envoi neuf. Seul l'encart inscrit.
 */
export default class NewsletterConsentWebhook {
  /**
   * Ne lève jamais : appelée en fire-and-forget après la réponse 200 au webhook.
   *
   * `rawBody` est le corps AVANT `JSON.parse` — celui qui a servi à vérifier la signature. Il
   * n'est pas décoratif : voir `extractCustomerGid`.
   */
  public async handle(payload: any, rawBody?: string): Promise<void> {
    try {
      const customerId = extractCustomerGid(payload, rawBody)
      if (!customerId) {
        Logger.info('newsletter consentement: webhook sans identifiant client, ignoré')
        return
      }

      // On ne connaît que NOS inscrits. Les ~750 dormants et les clients ordinaires n'ont
      // aucune ligne ici, et le webhook s'arrête donc là pour eux.
      const subscriber = await NewsletterSubscriber.findBy('shopify_customer_id', customerId)
      if (!subscriber || subscriber.status === 'unsubscribed') return

      const consent = await new Shopify().customer.getConsentById(customerId)
      if (!consent) {
        // Client supprimé ou fusionné entre l'événement et la relecture. La porte d'avant-envoi
        // tranchera au prochain passage ; rien à écrire sur la foi d'une absence.
        Logger.info('newsletter consentement: client %s introuvable à la relecture', customerId)
        return
      }

      if (consent.marketingState !== 'UNSUBSCRIBED') return

      await new NewsletterUnsubscribe().unsubscribeFromShopify(subscriber, consent.marketingState)
      Logger.info(
        'newsletter #%s: désabonnement constaté chez Shopify, séquence arrêtée',
        subscriber.id
      )
    } catch (error) {
      // Un webhook perdu n'est pas une panne : la porte d'avant-envoi relit le consentement en
      // direct et refusera l'envoi de toute façon. On journalise et on laisse passer.
      Logger.warn(
        'newsletter consentement: webhook non traité — %s',
        (error as any)?.message ?? error
      )
    }
  }
}

/**
 * L'identifiant client, en GID.
 *
 * La charge utile porte un identifiant NUMÉRIQUE (forme REST) là où l'API GraphQL attend un
 * `gid://shopify/Customer/…` — c'est aussi la forme stockée en base. Les variantes de clé sont
 * acceptées parce qu'un webhook mal identifié ne se voit pas : il rend 200 et ne fait rien.
 *
 * ⛔ LE TEXTE BRUT PASSE AVANT L'OBJET, ET CE N'EST PAS UN DÉTAIL. `JSON.parse` range les
 * nombres dans un `double` : au-delà de 2^53, les derniers chiffres sont RÉÉCRITS en silence
 * (`706405506930370084` devient `706405506930370000`). Les identifiants Shopify d'aujourd'hui
 * tiennent en 13 chiffres et passent, mais le jour où ils grandiront la panne serait
 * exactement celle qu'on cherche à éviter : le webhook rendrait 200, ne trouverait aucun
 * inscrit, et le désabonnement ne serait jamais inscrit sur la liste repoussoir. Le corps brut
 * a déjà été lu pour vérifier la signature — le relire ici ne coûte rien.
 */
function extractCustomerGid(payload: any, rawBody?: string): string | null {
  const fromRaw = /"customer_id"\s*:\s*"?(\d+)"?/.exec(String(rawBody ?? ''))
  if (fromRaw) return `gid://shopify/Customer/${fromRaw[1]}`

  const raw =
    payload?.customer_id ?? payload?.customer?.id ?? payload?.customerId ?? payload?.id ?? null
  if (raw === null || raw === undefined) return null

  const value = String(raw).trim()
  if (!value) return null

  // Déjà un GID : on le garde tel quel plutôt que d'en fabriquer un second.
  if (value.startsWith('gid://')) {
    return /^gid:\/\/shopify\/Customer\/\d+$/.test(value) ? value : null
  }

  return /^\d+$/.test(value) ? `gid://shopify/Customer/${value}` : null
}
