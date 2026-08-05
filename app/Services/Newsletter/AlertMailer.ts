import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Alertes d'exploitation de la newsletter.
 *
 * ⛔ ENVOYÉES PAR RESEND, JAMAIS PAR SES — et c'est le point entier de ce fichier.
 *
 * Les pannes que ces alertes signalent sont, précisément, les pannes du canal SES : compte
 * suspendu, boucle de retour rompue, accès Shopify révoqué. Une alerte qui emprunterait le
 * canal en panne ne partirait jamais, et la seule panne exigeant une intervention humaine
 * serait aussi la seule dont personne ne serait prévenu.
 *
 * Resend est déjà en service pour les e-mails du studio, sur un autre domaine
 * (`send.myselfmonart.com`) et un autre compte : les deux canaux ne peuvent pas tomber
 * ensemble. Ces alertes vont au marchand, jamais à un client — elles ne pèsent donc pas sur
 * la réputation du canal du studio.
 */
export default class NewsletterAlertMailer {
  public async send(subject: string, lines: string[]): Promise<boolean> {
    const key = Env.get('RESEND_API_KEY')
    const from = Env.get('RESEND_FROM')
    const to = Env.get('MAIL_RECIPIENT')

    if (!key || !from || !to) {
      Logger.warn(
        'newsletter alerte non envoyée (RESEND_API_KEY/RESEND_FROM/MAIL_RECIPIENT absents)'
      )
      return false
    }

    const text = lines.join('\n')
    const html = `<pre style="font:14px/1.6 ui-monospace,Menlo,Consolas,monospace; white-space:pre-wrap;">${text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')}</pre>`

    try {
      await axios.post(
        RESEND_ENDPOINT,
        { from, to: [to], subject: `[newsletter] ${subject}`, html, text },
        {
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          timeout: 10000,
        }
      )
      return true
    } catch (error) {
      Logger.error('newsletter alerte: échec — %s', (error as any)?.message ?? error)
      return false
    }
  }
}
