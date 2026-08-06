import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import { signFormPost } from './mail/sigv4'
import SesFeedback from './SesFeedback'

/**
 * Boucle de retour SES — par FILE D'ATTENTE (SQS), et non par webhook entrant.
 *
 * ⛔ POURQUOI CE CHEMIN PLUTÔT QUE `POST /webhooks/ses` — mesuré, pas supposé.
 *
 * Le domaine passe par Cloudflare, qui BLOQUE le trafic entrant venant des plages d'adresses
 * d'AWS. Constaté le 2026-08-06 : l'abonnement HTTPS de SNS est resté indéfiniment en
 * `PendingConfirmation`, et les journaux de nginx ne montraient AUCUNE requête — alors que
 * des requêtes identiques émises depuis une IP résidentielle et depuis le droplet passaient
 * toutes les deux. La confirmation n'atteignait donc jamais le serveur.
 *
 * On inverse le sens : c'est le back-end qui va CHERCHER les messages, en sortie sur le
 * port 443 — le seul chemin dont on ait la preuve qu'il est joignable (cf. `mail/ses.ts`).
 *
 * Trois bénéfices, au-delà du contournement :
 *
 *   • AUCUNE SURFACE ENTRANTE. Rien à authentifier, rien à re-confirmer un jour, aucune
 *     signature SNS à valider, aucune exception CSRF à maintenir. L'authenticité vient des
 *     identifiants IAM du lecteur.
 *   • RÉTENTION DE 14 JOURS. Une panne du back-end de plusieurs heures ne perd plus un seul
 *     rebond — là où un webhook manqué était perdu pour toujours.
 *   • UN SEUL RÉGLAGE RÉSEAU peut le casser, et il est sortant, donc sous notre contrôle.
 *
 * L'endpoint `POST /webhooks/ses` reste en place et fonctionnel : si Cloudflare est un jour
 * assoupli, les deux chemins alimentent le MÊME traitement (`SesFeedback.handleEnvelope`),
 * qui est idempotent. Ceinture et bretelles.
 */
export default class SqsFeedback {
  private feedback = new SesFeedback()

  /** Vrai si la file et les identifiants sont configurés. Faux = passage sans effet. */
  public isConfigured(): boolean {
    return !!(this.queueUrl() && this.accessKeyId() && this.secretAccessKey())
  }

  private queueUrl(): string {
    return (Env.get('SES_SQS_QUEUE_URL') as string | undefined) || ''
  }

  private region(): string {
    return (Env.get('SES_REGION') as string | undefined) || 'eu-west-1'
  }

  private accessKeyId(): string {
    return (Env.get('SES_ACCESS_KEY_ID') as string | undefined) || ''
  }

  private secretAccessKey(): string {
    return (Env.get('SES_SECRET_ACCESS_KEY') as string | undefined) || ''
  }

  /**
   * Vide la file, par lots. Ne lève jamais : une panne de la boucle de retour ne doit pas
   * empêcher la séquence de tourner (elle se dégrade vers « n'envoie rien », jamais vers
   * « envoie n'importe quoi »).
   *
   * @returns nombre de messages effectivement traités
   */
  public async poll(maxBatches = 10): Promise<number> {
    if (!this.isConfigured()) return 0

    let handled = 0

    for (let batch = 0; batch < maxBatches; batch++) {
      let messages: Array<{ receipt: string; body: string }>
      try {
        messages = await this.receive()
      } catch (error) {
        Logger.error(
          'newsletter sqs: lecture de la file impossible — %s',
          (error as any)?.message ?? error
        )
        return handled
      }

      if (!messages.length) break

      for (const message of messages) {
        try {
          const envelope = JSON.parse(message.body)
          await this.feedback.handleEnvelope(envelope)
          handled++
        } catch (error) {
          // Message illisible : on le journalise et on le SUPPRIME quand même. Le laisser
          // le ferait revenir à chaque passage, indéfiniment, et masquerait les suivants.
          Logger.warn(
            'newsletter sqs: message illisible, écarté — %s',
            (error as any)?.message ?? error
          )
        }

        // Supprimé APRÈS traitement : si le process meurt avant, le message réapparaît à
        // l'expiration du délai de visibilité et sera retraité. `handleEnvelope` est
        // idempotent (une adresse déjà sur la liste repoussoir y reste), donc un doublon de
        // traitement est sans conséquence — contrairement à un doublon d'ENVOI.
        try {
          await this.deleteMessage(message.receipt)
        } catch (error) {
          Logger.warn(
            'newsletter sqs: suppression du message impossible — %s',
            (error as any)?.message ?? error
          )
        }
      }
    }

    if (handled) Logger.info('newsletter sqs: %s événement(s) SES traité(s)', handled)
    return handled
  }

  // --- API SQS (protocole « query », signé SigV4) ----------------------------------

  private async call(params: Record<string, string>): Promise<string> {
    const url = new URL(this.queueUrl())

    const body = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const signed = signFormPost({
      host: url.host,
      // ⚠️ SQS adresse chaque file par son CHEMIN : signer « / » ferait échouer la signature.
      path: url.pathname,
      region: this.region(),
      service: 'sqs',
      accessKeyId: this.accessKeyId(),
      secretAccessKey: this.secretAccessKey(),
      body,
    })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    try {
      const response = await fetch(signed.url, {
        method: 'POST',
        headers: signed.headers,
        body: signed.body,
        signal: controller.signal,
      })
      const text = await response.text()
      if (!response.ok) {
        const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] ?? `HTTP ${response.status}`
        const message = /<Message>([^<]+)<\/Message>/.exec(text)?.[1] ?? text.slice(0, 200)
        throw new Error(`SQS ${code}: ${message}`)
      }
      return text
    } finally {
      clearTimeout(timer)
    }
  }

  private async receive(): Promise<Array<{ receipt: string; body: string }>> {
    const xml = await this.call({
      Action: 'ReceiveMessage',
      Version: '2012-11-05',
      MaxNumberOfMessages: '10',
      // Attente longue courte : on évite les lectures à vide sans immobiliser le cron.
      WaitTimeSeconds: '2',
      VisibilityTimeout: '60',
    })

    return [...xml.matchAll(/<Message>([\s\S]*?)<\/Message>/g)]
      .map((match) => ({
        receipt: /<ReceiptHandle>([\s\S]*?)<\/ReceiptHandle>/.exec(match[1])?.[1] ?? '',
        body: unescapeXml(/<Body>([\s\S]*?)<\/Body>/.exec(match[1])?.[1] ?? ''),
      }))
      .filter((m) => m.receipt && m.body)
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    await this.call({
      Action: 'DeleteMessage',
      Version: '2012-11-05',
      ReceiptHandle: receiptHandle,
    })
  }
}

/**
 * SQS renvoie le corps du message ÉCHAPPÉ en XML. Sans ce décodage, l'enveloppe SNS —
 * du JSON, donc pleine de guillemets — est illisible par `JSON.parse`.
 * `&amp;` en dernier : le décoder en premier ferait réinterpréter les entités qu'il produit.
 */
function unescapeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#10;/g, '\n')
    .replace(/&#13;/g, '\r')
    .replace(/&#9;/g, '\t')
    .replace(/&amp;/g, '&')
}
