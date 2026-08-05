import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'

/**
 * Effacement (RGPD art. 17) des données d'une adresse dans la séquence du bon de 15 €.
 *
 * ⛔ POURQUOI UNE COMMANDE MANUELLE. Les trois webhooks de conformité de Shopify
 * (`customers/redact`, `customers/data_request`, `shop/redact`) ne sont PAS souscriptibles
 * pour une app créée depuis l'admin — ils sont réservés aux apps distribuées par le Partner
 * Dashboard. Les endpoints existent mais ne seront jamais appelés en l'état. Cette commande
 * est donc le chemin RÉEL par lequel une demande d'effacement est honorée.
 *
 *   node ace newsletter:erase quelquun@exemple.fr
 *
 * Ce qui reste, volontairement : l'empreinte salée de l'adresse sur la liste repoussoir (pour
 * ne plus jamais lui écrire) et le squelette anonyme du consentement (pour démontrer, art.
 * 7(1), qu'un consentement a existé). Ce qui part : l'adresse, l'IP, l'agent utilisateur, la
 * page d'origine, le code de réduction.
 */
export default class NewsletterErase extends BaseCommand {
  public static commandName = 'newsletter:erase'
  public static description = 'Efface les données personnelles d’une adresse (RGPD art. 17)'
  public static settings = { loadApp: true, stayAlive: false }

  @args.string({ description: 'Adresse e-mail à effacer' })
  public email: string

  @flags.boolean({ description: 'Effacer réellement (sans ce drapeau : simulation)' })
  public execute: boolean

  public async run() {
    const { default: NewsletterErasure } = await import('App/Services/Newsletter/Erasure')
    const { default: NewsletterSubscriber } = await import('App/Models/NewsletterSubscriber')
    const { normalizeEmail } = await import('App/Services/Newsletter/identity')

    const email = normalizeEmail(this.email)
    const subscriber = await NewsletterSubscriber.findBy('email', email)

    if (!this.execute) {
      this.logger.info('🟡 SIMULATION — ajouter --execute pour effacer réellement.')
      this.logger.info(
        subscriber
          ? `Inscrit #${subscriber.id} trouvé (statut ${subscriber.status}, langue ${subscriber.locale}).`
          : 'Aucune inscription pour cette adresse — l’empreinte serait tout de même posée.'
      )
      return
    }

    const result = await new NewsletterErasure().erase(email)
    this.logger.success(
      result.found
        ? `Inscrit #${result.subscriberId} effacé. Empreinte conservée en liste repoussoir.`
        : 'Aucune inscription trouvée. Empreinte posée en liste repoussoir.'
    )
  }
}
