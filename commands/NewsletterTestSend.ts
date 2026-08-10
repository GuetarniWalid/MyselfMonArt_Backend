import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'

/**
 * ENVOI TÉMOIN — un vrai e-mail de la séquence, vers une adresse choisie, sans rien créer.
 *
 *   node ace newsletter:test_send moi@exemple.fr
 *   node ace newsletter:test_send moi@orange.fr --transport=smtp --no=3
 *
 * Répond à deux cases de la définition du terminé que rien d'autre ne couvre :
 *
 *   • « envoi témoin vérifié à l'œil vers Gmail, Orange et Outlook » — c'est la SEULE mesure
 *     disponible à ce volume. Google Postmaster Tools reste vide sous quelques centaines
 *     d'envois par jour, et Orange comme Outlook n'exposent rien du tout ;
 *   • « transport secondaire testé au moins une fois » — un secours jamais essayé n'est pas un
 *     secours, c'est une intention. `--transport=smtp` l'exerce pour de bon.
 *
 * ⛔ NE CRÉE RIEN, ET C'EST LA CONDITION POUR POUVOIR S'EN SERVIR EN PRODUCTION : aucun
 * inscrit, aucune remise, aucune ligne `newsletter_sends`, aucune écriture chez Shopify. Le
 * gabarit est rendu avec des valeurs représentatives et remis directement au transport. Le
 * code affiché est FICTIF et n'existe dans aucune boutique — un vrai code consommé fausserait
 * le signal de conversion de son propriétaire.
 *
 * ⛔ LE JETON DE DÉSABONNEMENT EST FICTIF LUI AUSSI. L'en-tête `List-Unsubscribe` est bien
 * présent — c'est ce qu'on vient vérifier, puisque c'est lui qui fait apparaître le bouton
 * natif de Gmail et Yahoo — mais il ne pointe sur personne. Cliquer dessus ne désabonne
 * personne : `resolve()` ne trouve aucune ligne et rend `null`.
 */
export default class NewsletterTestSend extends BaseCommand {
  public static commandName = 'newsletter:test_send'
  public static description =
    'Envoie un e-mail témoin de la séquence (aucun inscrit, aucune remise créée)'
  public static settings = { loadApp: true, stayAlive: false }

  @args.string({ description: 'Adresse destinataire du témoin' })
  public email: string

  @flags.string({ description: 'Transport à exercer : ses (défaut) ou smtp' })
  public transport: string

  @flags.string({ description: 'Quel e-mail de la séquence : 1, 2 ou 3 (défaut 1)' })
  public no: string

  @flags.string({ description: 'Langue : fr, en, de, es, nl (défaut fr)' })
  public locale: string

  public async run() {
    const { default: Env } = await import('@ioc:Adonis/Core/Env')
    const { renderNewsletterEmail } = await import('App/Services/Newsletter/emails/template')
    const { buildMime, unsubscribeHeaders } = await import('App/Services/Newsletter/mail/mime')
    const { senderAddress } = await import('App/Services/Newsletter/mail')
    const { default: SesTransport } = await import('App/Services/Newsletter/mail/ses')
    const { default: SmtpTransport } = await import('App/Services/Newsletter/mail/smtp')
    const { offerFor, resolveCurrency } = await import('App/Services/Newsletter/currency')
    const { announcedDateFromEnd } = await import('App/Services/Newsletter/expiry')
    const { POSTAL_SENDER, TRUSTPILOT_COUNT, TRUSTPILOT_SCORE } = await import(
      'App/Services/Newsletter/config'
    )

    const emailNo = Number(this.no || 1)
    if (![1, 2, 3].includes(emailNo)) {
      this.logger.error('--no doit valoir 1, 2 ou 3')
      return
    }

    const wanted = (this.transport || 'ses').trim().toLowerCase()
    if (!['ses', 'smtp'].includes(wanted)) {
      this.logger.error('--transport doit valoir ses ou smtp')
      return
    }

    const transport = wanted === 'smtp' ? new SmtpTransport() : new SesTransport()
    if (!transport.isConfigured()) {
      this.logger.error(
        `transport ${wanted} non configuré — rien n'est parti. ` +
          (wanted === 'smtp'
            ? 'NEWSLETTER_SMTP_HOST / _USER / _PASSWORD manquent.'
            : 'SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY manquent.')
      )
      return
    }

    const locale = (this.locale || 'fr') as any
    const currency = resolveCurrency(null)
    const offer = offerFor(currency)

    // Échéance à J+7, comme un vrai bon émis maintenant : c'est la date que le lecteur voit.
    const expiresTs = Math.floor(Date.now() / 1000) + 7 * 86400

    const rendered = renderNewsletterEmail({
      emailNo: emailNo as 1 | 2 | 3,
      locale,
      // ⛔ Code volontairement impossible : `TEMOIN` n'est pas le préfixe `MERCI-` des vrais
      // bons, donc aucun risque de collision avec un code émis.
      code: 'TEMOIN-XXXXXX',
      announcedDate: announcedDateFromEnd(expiresTs),
      signupTs: Math.floor(Date.now() / 1000),
      amount: offer.amount,
      threshold: offer.threshold,
      currency,
      storeUrl: Env.get('STOREFRONT_URL') || 'https://www.myselfmonart.com',
      unsubscribeUrl: `${Env.get('BACKEND_URL') || 'https://backend.myselfmonart.com'}/u/TEMOIN-SANS-EFFET`,
      contactEmail: Env.get('NEWSLETTER_MAIL_REPLY_TO') || 'contact@myselfmonart.com',
      postalAddress: (Env.get('NEWSLETTER_POSTAL_ADDRESS') as string | undefined) || POSTAL_SENDER,
      trustpilotScore: TRUSTPILOT_SCORE,
      trustpilotCount: TRUSTPILOT_COUNT,
    })

    const sender = senderAddress()
    const unsubscribeUrl = `${Env.get('BACKEND_URL') || 'https://backend.myselfmonart.com'}/u/TEMOIN-SANS-EFFET`

    const mime = await buildMime({
      from: sender.from,
      fromName: sender.fromName,
      to: this.email,
      replyTo: sender.replyTo,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      headers: unsubscribeHeaders(unsubscribeUrl),
    })

    this.logger.info(
      `témoin E${emailNo} (${locale}) -> ${this.email} via ${wanted}, ${mime.length} octets`
    )

    try {
      const result = await transport.sendRaw(mime, { from: sender.from, to: this.email })
      this.logger.success(`parti via ${result.transport} — messageId ${result.messageId}`)
    } catch (error) {
      // On journalise le message tel quel : c'est lui qui dit si le refus vient du réseau, de
      // l'authentification ou de SES (adresse non vérifiée tant que le bac à sable est actif).
      this.logger.error(`ÉCHEC via ${wanted} — ${(error as any)?.message ?? error}`)
    }
  }
}
