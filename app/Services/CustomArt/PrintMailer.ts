import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'
import type CustomArtJob from 'App/Models/CustomArtJob'
import type CustomArtOrder from 'App/Models/CustomArtOrder'

// SMTP sortant bloqué sur le droplet DO -> envoi via l'API HTTPS Resend
// (même canal que EscalationMailer / SaveMailer / ReviewMailer).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Notifications admin de la file print (M9, plan §9) — destinataire MAIL_RECIPIENT :
 *   - sendAwaitingReview : un fichier print vient d'être préparé, validation humaine
 *     requise avant la commande manuelle sur le portail Picanova ;
 *   - sendFailure : la préparation a échoué (après retry) — la commande reste en
 *     awaiting_file, bouton « Régénérer l'upscale » dans la file.
 * Best-effort : retourne false sans throw (le statut DB fait foi, pas l'email).
 */
export default class PrintMailer {
  public async sendAwaitingReview(input: {
    order: CustomArtOrder
    job: CustomArtJob
    teamName: string
  }): Promise<boolean> {
    const { order, job, teamName } = input
    const subject = `[Poster perso] Fichier print à valider — commande ${order.orderName || order.shopifyOrderId}`
    const intro =
      'Le fichier d’impression est prêt. Vérifie-le à 100 % dans la file print, ' +
      'puis approuve avant de passer la commande sur le portail Picanova.'
    return this.send(subject, intro, order, job, teamName, null)
  }

  public async sendFailure(input: {
    order: CustomArtOrder
    job: CustomArtJob | null
    teamName: string
    reason: string
  }): Promise<boolean> {
    const { order, job, teamName, reason } = input
    const subject = `[Poster perso] ÉCHEC préparation du fichier print — commande ${order.orderName || order.shopifyOrderId}`
    const intro =
      'La préparation du fichier d’impression a échoué (après un nouvel essai). ' +
      'La commande reste en attente de fichier : relance l’upscale depuis la file print.'
    return this.send(subject, intro, order, job, teamName, reason)
  }

  private async send(
    subject: string,
    intro: string,
    order: CustomArtOrder,
    job: CustomArtJob | null,
    teamName: string,
    reason: string | null
  ): Promise<boolean> {
    if (!Env.get('RESEND_API_KEY') || !Env.get('RESEND_FROM')) {
      Logger.warn('custom-art print-mail non envoyé (RESEND_API_KEY/RESEND_FROM absents)')
      return false
    }

    const queueUrl = `${Env.get('BACKEND_URL')}/custom-art-print-queue`
    const lines = [
      intro,
      '',
      `Commande : ${order.orderName || order.shopifyOrderId}`,
      // displayLabel : « WALID 10 » foot (inchangé), titre/tokens pour un job générique
      job ? `Création : ${job.displayLabel}` : `Job : #${order.jobId}`,
      `Équipe : ${teamName}`,
      job ? `Format / finition : ${job.format} / ${job.frame}` : '',
      reason ? `Erreur : ${reason}` : '',
      '',
      `File print : ${queueUrl}`,
    ].filter((l) => l !== '')

    const rows = [
      ['Commande', order.orderName || order.shopifyOrderId],
      job ? ['Création', job.displayLabel] : null,
      ['Équipe', teamName],
      job ? ['Format / finition', `${job.format} / ${job.frame}`] : null,
      job ? ['Job', job.uuid] : null,
      reason ? ['Erreur', reason] : null,
    ].filter(Boolean) as Array<[string, string]>

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 4px">Poster perso — file print</h2>
  <p style="margin:0 0 16px;color:#666">${this.escapeHtml(intro)}</p>
  <table style="border-collapse:collapse;margin-bottom:16px">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:2px 12px 2px 0;color:#666">${this.escapeHtml(k)}</td><td><strong>${this.escapeHtml(v)}</strong></td></tr>`
      )
      .join('\n    ')}
  </table>
  <p style="margin:0 0 16px"><a href="${queueUrl}" style="background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Ouvrir la file print</a></p>
</body></html>`

    try {
      await axios.post(
        RESEND_ENDPOINT,
        {
          from: Env.get('RESEND_FROM'),
          to: [Env.get('MAIL_RECIPIENT')],
          subject,
          html,
          text: lines.join('\n'),
        },
        {
          headers: {
            'Authorization': `Bearer ${Env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          timeout: 10000,
        }
      )
      return true
    } catch (error) {
      Logger.error('custom-art print-mail échec: %s', (error as any)?.message || error)
      return false
    }
  }

  private escapeHtml(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}
