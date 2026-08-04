import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'

// DigitalOcean bloque le SMTP sortant sur le droplet : le transactionnel passe par l'API
// HTTPS de Resend (même approche que PublishAlertMailer / EscalationMailer).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Le marchand ne surveille rien — c'est tout l'objet de la demande. Le dispositif doit donc
 * l'alerter, jamais l'inverse.
 *
 * Un seul e-mail, envoyé après DEUX passages en échec consécutifs (verrou `alert_sent_at`
 * en base : au plus une alerte par semaine ISO, même si la panne dure).
 */
export default class PromoAlertMailer {
  public async sendRotationFailure(params: {
    isoWeek: string
    attempts: number
    /** Jours écoulés depuis la dernière rotation publiée avec succès (null si aucune). */
    daysSinceLastSuccess: number | null
    /** Code encore publié et valide, s'il y en a un. */
    currentCode: string | null
    currentEndsAt: string | null
    error: string
  }): Promise<boolean> {
    const { isoWeek, attempts, daysSinceLastSuccess, currentCode, currentEndsAt, error } = params

    const since =
      daysSinceLastSuccess === null
        ? 'aucune rotation n’a jamais abouti'
        : `dernière rotation réussie il y a ${daysSinceLastSuccess} jour(s)`

    const subject =
      daysSinceLastSuccess === null
        ? `[Promo] Rotation du code promo en échec (${isoWeek})`
        : `[Promo] Rotation du code promo en échec depuis ${daysSinceLastSuccess} jour(s)`

    const statusUrl = `${Env.get('BACKEND_URL', '')}/promo/status`

    const text = [
      `La rotation automatique du code promo de l'encart produit a échoué ${attempts} fois de suite.`,
      ``,
      `Semaine visée : ${isoWeek}`,
      `Historique : ${since}`,
      `Dernière erreur : ${error}`,
      ``,
      currentCode
        ? `Rien n'est cassé côté client pour l'instant : le code ${currentCode} reste affiché et valide jusqu'au ${currentEndsAt}.`
        : `⚠️ Aucun code valide n'est publié : l'encart ne s'affiche pas.`,
      ``,
      `Aucune action destructive n'a été tentée — le cron réessaiera au prochain tour.`,
      statusUrl ? `État en direct : ${statusUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 4px">Rotation du code promo en échec</h2>
  <p style="margin:0 0 16px;color:#666">Le cron n'a pas réussi à publier le code de la semaine
  après ${attempts} tentatives.</p>
  <table style="border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:2px 12px 2px 0;color:#666">Semaine visée</td><td><strong>${this.escapeHtml(
      isoWeek
    )}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#666">Historique</td><td>${this.escapeHtml(
      since
    )}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#666">Dernière erreur</td><td><code>${this.escapeHtml(
      error
    )}</code></td></tr>
  </table>
  ${
    currentCode
      ? `<p style="margin:0 0 8px">Rien n'est cassé côté client pour l'instant&nbsp;: le code
         <strong>${this.escapeHtml(currentCode)}</strong> reste affiché et valide jusqu'au
         ${this.escapeHtml(currentEndsAt ?? '')}.</p>`
      : `<p style="margin:0 0 8px;color:#b00020"><strong>Aucun code valide n'est publié</strong>&nbsp;:
         l'encart ne s'affiche pas.</p>`
  }
  <p style="margin:0 0 16px;color:#666">Aucune action destructive n'a été tentée — le cron
  réessaiera au prochain tour.</p>
  ${
    statusUrl
      ? `<p style="margin:0 0 16px"><a href="${statusUrl}" style="background:#0095f6;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none">Voir l'état en direct</a></p>`
      : ''
  }
</body></html>`

    try {
      await axios.post(
        RESEND_ENDPOINT,
        { from: Env.get('RESEND_FROM'), to: [Env.get('MAIL_RECIPIENT')], subject, html, text },
        {
          headers: {
            'Authorization': `Bearer ${Env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          timeout: 10000,
        }
      )
      return true
    } catch (e) {
      // L'alerte est un confort, pas une dépendance : son échec ne doit jamais faire
      // échouer la rotation elle-même.
      Logger.error('promo rotation: envoi de l’alerte impossible — %s', e.message)
      return false
    }
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}
