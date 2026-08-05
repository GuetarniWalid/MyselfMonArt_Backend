import Env from '@ioc:Adonis/Core/Env'
import { signFormPost } from './sigv4'
import type { MailTransport, SendResult } from './types'

/**
 * Transport PRIMAIRE — Amazon SES, action `SendRawEmail`, en HTTPS sur le port 443.
 *
 * ⛔ POURQUOI PAS LE SMTP DU BRIEF (§11 : `email-smtp.eu-west-1.amazonaws.com:587`) —
 * le port 587 est FILTRÉ sur le droplet DigitalOcean. Vérifié depuis le conteneur applicatif
 * le 2026-08-05 :
 *
 *     25   -> timeout      465  -> timeout      587  -> timeout
 *     2587 -> OK           443 (email.eu-west-1.amazonaws.com) -> OK
 *
 * DigitalOcean filtre les ports SMTP standards par défaut, ce que le projet avait déjà
 * constaté (cf. le commentaire en tête de `App/Services/CustomArt/SaveMailer.ts`). Le brief
 * aurait donc produit un dispositif qui n'envoie rien, sans message d'erreur parlant : un
 * timeout TCP ressemble à une panne passagère et se serait retenté indéfiniment.
 *
 * Le 443 règle la question DÉFINITIVEMENT — c'est le seul port dont on peut affirmer qu'il ne
 * sera jamais filtré nulle part.
 *
 * ⛔ POURQUOI L'API v1 ET PAS v2 — la politique IAM de l'utilisateur `backend-ses-sender-smtp`
 * n'autorise qu'une action : `ses:SendRawEmail`. C'est littéralement l'action de l'API v1.
 * L'API v2 (`SendEmail` avec contenu brut) dépend d'une équivalence documentaire entre
 * `ses:SendEmail` et `ses:SendRawEmail` qu'on n'a aucune raison de parier ici.
 *
 * Le format BRUT n'est pas subi, il est requis : les en-têtes `List-Unsubscribe` et
 * `List-Unsubscribe-Post` ne peuvent être posés que dans un message construit en MIME.
 */
export default class SesTransport implements MailTransport {
  public readonly name = 'ses'

  private region(): string {
    return Env.get('SES_REGION') || 'eu-west-1'
  }

  private accessKeyId(): string {
    return Env.get('SES_ACCESS_KEY_ID') || Env.get('AWS_ACCESS_KEY_ID') || ''
  }

  private secretAccessKey(): string {
    return Env.get('SES_SECRET_ACCESS_KEY') || Env.get('AWS_SECRET_ACCESS_KEY') || ''
  }

  /**
   * ⚠️ Les identifiants SMTP de SES ne conviennent PAS ici : le « mot de passe SMTP » est une
   * signature dérivée de la clé secrète IAM, et la dérivation est à sens unique. Il faut la
   * clé IAM elle-même (access key + secret). À défaut, le transport SMTP prend le relais.
   */
  public isConfigured(): boolean {
    return !!(this.accessKeyId() && this.secretAccessKey())
  }

  public async sendRaw(mime: Buffer, envelope: { from: string; to: string }): Promise<SendResult> {
    if (!this.isConfigured()) {
      throw new Error('SES non configuré (SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY absents)')
    }

    const params: Array<[string, string]> = [
      ['Action', 'SendRawEmail'],
      ['Version', '2010-12-01'],
      // Enveloppe explicite : SES saurait la déduire des en-têtes, mais l'expliciter met
      // l'acheminement à l'abri d'une future évolution du gabarit HTML.
      ['Source', envelope.from],
      ['Destinations.member.1', envelope.to],
      ['RawMessage.Data', mime.toString('base64')],
    ]

    // Un « configuration set » est ce qui fait publier les rebonds et les plaintes vers SNS.
    // Sans lui, SES avale les notifications et la liste repoussoir ne se remplit jamais — le
    // taux de plaintes monterait alors sans que rien ne l'arrête. Optionnel ici pour que le
    // dispositif démarre avant son paramétrage dans la console AWS, mais il faut le poser.
    const configurationSet = Env.get('SES_CONFIGURATION_SET')
    if (configurationSet) params.push(['ConfigurationSetName', configurationSet])

    const body = params
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const signed = signFormPost({
      host: `email.${this.region()}.amazonaws.com`,
      region: this.region(),
      service: 'ses',
      accessKeyId: this.accessKeyId(),
      secretAccessKey: this.secretAccessKey(),
      body,
    })

    // Délai borné : un envoi qui pend indéfiniment bloquerait le cron des 15 minutes et
    // laisserait une ligne `sending` orpheline, donc un e-mail définitivement perdu.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)

    let response: Response
    let text: string
    try {
      response = await fetch(signed.url, {
        method: 'POST',
        headers: signed.headers,
        body: signed.body,
        signal: controller.signal,
      })
      text = await response.text()
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] ?? `HTTP ${response.status}`
      const message = /<Message>([^<]+)<\/Message>/.exec(text)?.[1] ?? text.slice(0, 300)
      throw new Error(`SES ${code}: ${message}`)
    }

    const messageId = /<MessageId>([^<]+)<\/MessageId>/.exec(text)?.[1]
    if (!messageId) {
      // 200 sans identifiant : on ne sait pas si le message est parti. On lève, et l'appelant
      // classera l'envoi en `unknown` — jamais en « à réessayer », qui produirait un doublon.
      throw new Error(`SES: réponse 200 sans MessageId — ${text.slice(0, 300)}`)
    }

    return { messageId, transport: this.name }
  }
}
