import MailComposer from 'nodemailer/lib/mail-composer'
import type { RawMessage } from './types'

/**
 * Construction du message en MIME BRUT.
 *
 * C'est l'étape qui rend tout le reste possible : `List-Unsubscribe` et
 * `List-Unsubscribe-Post` ne peuvent pas être posés par une API « contenu simple ». Or sans
 * eux, pas de désabonnement en un clic dans Gmail et Yahoo — et un lecteur qui ne trouve pas
 * le bouton « se désabonner » clique sur « signaler comme spam ». À 120 envois par semaine,
 * une seule plainte représente 0,83 %, dix fois le seuil contractuel de SES.
 *
 * Le désabonnement n'est donc pas une mention légale : c'est ce qui protège le compte
 * d'envoi, donc la totalité du canal.
 *
 * ⚠️ La signature DKIM est posée par SES, APRÈS nous, et elle couvre les en-têtes présents
 * dans le message. Les poser ici suffit — il n'y a rien à signer de notre côté. En revanche,
 * un transport qui RECONSTRUIRAIT le message (au lieu de le transmettre brut) les perdrait :
 * c'est pourquoi les deux transports envoient du `raw`.
 */
export async function buildMime(message: RawMessage): Promise<Buffer> {
  const composer = new MailComposer({
    from: { name: message.fromName, address: message.from },
    to: message.to,
    // `mail.myselfmonart.com` n'a AUCUNE boîte de réception. Sans Reply-To, toute réponse
    // d'un client tombe dans le vide — et une réponse sans réponse finit en plainte.
    replyTo: message.replyTo,
    subject: message.subject,
    text: message.text,
    html: message.html,
    headers: message.headers,
    // Encodage lisible par les filtres antispam : un corps entièrement en base64 est un
    // signal négatif chez plusieurs fournisseurs.
    textEncoding: 'quoted-printable',
  })

  return composer.compile().build()
}

/**
 * En-têtes de désabonnement RFC 8058.
 *
 * L'URI DOIT être en HTTPS : sur une URL en clair, les fournisseurs « SHOULD NOT offer a
 * one-click unsubscribe » et le bouton disparaît.
 *
 * ⚠️ Ces deux en-têtes vont ENSEMBLE. `List-Unsubscribe` seul avec une URL fait ouvrir la page
 * dans un navigateur ; c'est `List-Unsubscribe-Post` qui déclenche le POST silencieux, donc le
 * bouton natif « Se désabonner » à côté de l'expéditeur.
 */
export function unsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
