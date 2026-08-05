import { BaseCommand, args } from '@adonisjs/core/build/standalone'

/**
 * Droit d'accès (RGPD art. 15) : tout ce que le back-end détient sur une adresse, en JSON.
 *
 *   node ace newsletter:export quelquun@exemple.fr
 *
 * Même raison d'être que `newsletter:erase` : les webhooks de conformité de Shopify ne sont
 * pas souscriptibles pour une app créée depuis l'admin, cette commande est donc le chemin
 * réel par lequel une demande d'accès est honorée.
 */
export default class NewsletterExport extends BaseCommand {
  public static commandName = 'newsletter:export'
  public static description = 'Exporte en JSON les données détenues sur une adresse (RGPD art. 15)'
  public static settings = { loadApp: true, stayAlive: false }

  @args.string({ description: 'Adresse e-mail concernée' })
  public email: string

  public async run() {
    const { default: NewsletterErasure } = await import('App/Services/Newsletter/Erasure')
    const dump = await new NewsletterErasure().export(this.email)
    // Sortie brute sur stdout : destinée à être redirigée vers un fichier et transmise.
    console.log(JSON.stringify(dump, null, 2))
  }
}
