import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import { buildMime } from './mime'
import SesTransport from './ses'
import SmtpTransport from './smtp'
import type { MailTransport, RawMessage, SendResult } from './types'

export type { MailTransport, RawMessage, SendResult } from './types'
export { unsubscribeHeaders } from './mime'

/**
 * Sélection du transport et envoi.
 *
 * ⛔ PAS DE BASCULE AUTOMATIQUE VERS LE SECOURS EN CAS D'ÉCHEC. C'est délibéré, et c'est le
 * choix le plus important de ce fichier.
 *
 * Un échec d'envoi peut très bien survenir APRÈS que le message soit parti (coupure réseau sur
 * la réponse, timeout côté client). Réessayer chez un autre prestataire enverrait alors le
 * message une seconde fois. Or un doublon, à ce volume, c'est une plainte ; une plainte, c'est
 * dix fois le seuil contractuel ; et une suspension arrête tout en silence, séquences en cours
 * comprises.
 *
 * Le secours se choisit donc par variable d'environnement (`NEWSLETTER_MAIL_TRANSPORT=smtp`)
 * puis redémarrage — une décision humaine, prise en connaissance de cause, pas un réflexe de
 * la machine à 3 heures du matin.
 */
export class NewsletterMailer {
  private ses = new SesTransport()
  private smtp = new SmtpTransport()

  /**
   * Transport actif. `NEWSLETTER_MAIL_TRANSPORT` tranche explicitement ; sinon SES s'il est
   * configuré, SMTP à défaut. Le repli implicite existe pour un cas précis : si le marchand
   * n'a que les identifiants SMTP de SES (le « mot de passe SMTP » est une signature dérivée
   * de la clé IAM, et la dérivation ne s'inverse pas), le dispositif marche quand même.
   */
  public transport(): MailTransport | null {
    const forced = (Env.get('NEWSLETTER_MAIL_TRANSPORT') || '').toString().trim().toLowerCase()
    if (forced === 'ses') return this.ses
    if (forced === 'smtp') return this.smtp
    if (this.ses.isConfigured()) return this.ses
    if (this.smtp.isConfigured()) return this.smtp
    return null
  }

  /** Vrai si un transport est prêt. Faux = on ne réserve même pas de ligne d'envoi. */
  public isReady(): boolean {
    const transport = this.transport()
    return !!transport && transport.isConfigured()
  }

  /**
   * Construit le MIME et l'envoie. Lève en cas d'échec — c'est l'appelant qui décide de
   * reporter (`failed`, retentable) ou d'abandonner (`unknown`, jamais relancé).
   */
  public async send(message: RawMessage): Promise<SendResult> {
    const transport = this.transport()
    if (!transport) throw new Error('aucun transport e-mail configuré')

    const mime = await buildMime(message)
    const result = await transport.sendRaw(mime, { from: message.from, to: message.to })

    Logger.info(
      'newsletter mail: %s envoyé via %s (%s)',
      message.to,
      result.transport,
      result.messageId
    )
    return result
  }
}

/** Adresse d'expédition — sous-domaine dédié, JAMAIS le domaine racine ni un domaine cousin. */
export function senderAddress(): { from: string; fromName: string; replyTo: string } {
  return {
    from: Env.get('NEWSLETTER_MAIL_FROM') || 'bonjour@mail.myselfmonart.com',
    fromName: Env.get('NEWSLETTER_MAIL_FROM_NAME') || 'MyselfMonArt',
    // Obligatoire : `mail.myselfmonart.com` n'a aucune boîte de réception.
    replyTo: Env.get('NEWSLETTER_MAIL_REPLY_TO') || 'contact@myselfmonart.com',
  }
}
