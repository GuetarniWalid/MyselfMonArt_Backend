import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'
import type CustomArtJob from 'App/Models/CustomArtJob'

// SMTP sortant bloqué sur le droplet DO -> envoi via l'API HTTPS Resend
// (même canal que EscalationMailer / SaveMailer).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Notification « fallback artiste » (décision grill §0.15) : un job vient de passer en
 * manual_review (photo refusée IMAGE_SAFETY ou 2 rounds sans pass). Email à Walid
 * (MAIL_RECIPIENT) avec le contexte du job + lien direct vers la file admin.
 * Best-effort : retourne false sans throw (le job reste en manual_review quoi qu'il arrive).
 */
export default class ReviewMailer {
  public async send(input: {
    job: CustomArtJob
    teamName: string
    reason: string
  }): Promise<boolean> {
    if (!Env.get('RESEND_API_KEY') || !Env.get('RESEND_FROM')) {
      Logger.warn('custom-art review-mail non envoyé (RESEND_API_KEY/RESEND_FROM absents)')
      return false
    }

    const { job, teamName, reason } = input
    const queueUrl = `${Env.get('BACKEND_URL')}/custom-art-review`
    // displayLabel : « WALID 10 » côté foot (sortie inchangée), titre/tokens côté générique
    const who = job.displayLabel || '—'
    const subject = teamName
      ? `[Poster perso] Création à reprendre — ${who} (${teamName})`
      : `[Poster perso] Création à reprendre — ${who}`

    const text = [
      'Un poster personnalisé attend une intervention humaine (promesse client : aperçu sous 24 h).',
      '',
      `Création : ${who}`,
      ...(teamName ? [`Équipe : ${teamName}`] : []),
      `Format / finition : ${job.format} / ${job.frame}`,
      `Raison : ${reason}`,
      `Job : ${job.uuid}`,
      '',
      `File admin : ${queueUrl}`,
    ].join('\n')

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 4px">Poster perso — création à reprendre</h2>
  <p style="margin:0 0 16px;color:#666">Promesse client : aperçu sous 24 h (écran « Faire réaliser par un artiste »).</p>
  <table style="border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:2px 12px 2px 0;color:#666">Création</td><td><strong>${this.escapeHtml(who)}</strong></td></tr>
    ${teamName ? `<tr><td style="padding:2px 12px 2px 0;color:#666">Équipe</td><td>${this.escapeHtml(teamName)}</td></tr>` : ''}
    <tr><td style="padding:2px 12px 2px 0;color:#666">Format / finition</td><td>${this.escapeHtml(job.format)} / ${this.escapeHtml(job.frame)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#666">Raison</td><td>${this.escapeHtml(reason)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#666">Job</td><td><code>${this.escapeHtml(job.uuid)}</code></td></tr>
  </table>
  <p style="margin:0 0 16px"><a href="${queueUrl}" style="background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Ouvrir la file de revue</a></p>
</body></html>`

    try {
      await axios.post(
        RESEND_ENDPOINT,
        {
          from: Env.get('RESEND_FROM'),
          to: [Env.get('MAIL_RECIPIENT')],
          subject,
          html,
          text,
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
      Logger.error('custom-art review-mail échec: %s', (error as any)?.message || error)
      return false
    }
  }

  private escapeHtml(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}
