import Env from '@ioc:Adonis/Core/Env'
import nodemailer from 'nodemailer'
import type { MailTransport, SendResult } from './types'

/**
 * Transport SECONDAIRE — SMTP brut.
 *
 * Sa raison d'être : le compte d'envoi peut être suspendu sans préavis (seuil contractuel de
 * 0,08 % de plaintes chez SES). Le jour où ça arrive, il faut pouvoir basculer en changeant
 * trois variables d'environnement, sans redéploiement ni réécriture.
 *
 * ⛔ PORT PAR DÉFAUT : 2587, PAS 587. Le 587 est filtré sur le droplet DigitalOcean (comme le
 * 25 et le 465) ; 2587 est le port alternatif de SES et il est joignable — vérifié depuis le
 * conteneur applicatif. Un prestataire de secours devra donc, lui aussi, offrir un port non
 * standard : SMTP2GO écoute sur 2525, Brevo sur 2525.
 *
 * Fonctionne tel quel avec SES (identifiants SMTP), SMTP2GO ou Brevo — c'est le même
 * protocole, et le message part déjà construit en MIME, donc les en-têtes `List-Unsubscribe`
 * survivent quel que soit le prestataire.
 */
export default class SmtpTransport implements MailTransport {
  public readonly name = 'smtp'

  public isConfigured(): boolean {
    return !!(
      Env.get('NEWSLETTER_SMTP_HOST') &&
      Env.get('NEWSLETTER_SMTP_USER') &&
      Env.get('NEWSLETTER_SMTP_PASSWORD')
    )
  }

  public async sendRaw(mime: Buffer, envelope: { from: string; to: string }): Promise<SendResult> {
    if (!this.isConfigured()) {
      throw new Error('SMTP secours non configuré (NEWSLETTER_SMTP_HOST/USER/PASSWORD absents)')
    }

    const port = Number(Env.get('NEWSLETTER_SMTP_PORT') || 2587)

    const transporter = nodemailer.createTransport({
      host: Env.get('NEWSLETTER_SMTP_HOST') as string,
      port,
      // 465 est le seul port implicitement chiffré ; 2587/2525/587 passent par STARTTLS.
      secure: port === 465,
      requireTLS: port !== 465,
      auth: {
        user: Env.get('NEWSLETTER_SMTP_USER') as string,
        pass: Env.get('NEWSLETTER_SMTP_PASSWORD') as string,
      },
      // Échouer vite plutôt que pendre : un socket bloqué immobiliserait le cron des 15
      // minutes et laisserait une ligne `sending` orpheline, donc un e-mail perdu.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    })

    try {
      // `raw` : nodemailer transmet le MIME tel quel, sans le reconstruire. C'est ce qui
      // garantit que les en-têtes de désabonnement arrivent intacts chez le destinataire.
      const info = await transporter.sendMail({
        raw: mime,
        envelope: { from: envelope.from, to: envelope.to },
      })
      return { messageId: info.messageId || `smtp-${Date.now()}`, transport: this.name }
    } finally {
      transporter.close()
    }
  }
}
