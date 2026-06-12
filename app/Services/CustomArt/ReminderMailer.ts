import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'
import { DateTime } from 'luxon'

// SMTP sortant bloqué sur le droplet DO -> envoi via l'API HTTPS Resend
// (même canal que EscalationMailer / SaveMailer / MockupsReadyMailer).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

// La mention fête des pères n'apparaît que dans les N jours qui précèdent la date
// (au-delà ou après, elle serait hors sujet dans un email de relance).
const FATHERS_DAY_WINDOW_DAYS = 15

/**
 * Relance « création sauvegardée » (M10) : email chaleureux « votre tableau vous
 * attend » envoyé UNE seule fois, 20-28 h après la création, aux sessions qui ont
 * laissé un email sans acheter. Aperçu watermarké + lien de reprise (contrat ca_job,
 * même que SaveMailer) + rappel fête des pères quand la date approche (21/06 en 2026).
 * Best-effort : retourne false sans throw (la Task relancera tant que la fenêtre
 * 20-28 h n'est pas dépassée).
 */
export default class ReminderMailer {
  public async send(input: {
    email: string
    jobUuid: string
    /** URL publique (CDN) de l'aperçu watermarké du candidat élu, null si indisponible */
    previewUrl: string | null
    playerName: string
  }): Promise<boolean> {
    if (!Env.get('RESEND_API_KEY') || !Env.get('RESEND_FROM')) {
      Logger.warn('custom-art reminder-mail non envoyé (RESEND_API_KEY/RESEND_FROM absents)')
      return false
    }

    const resumeUrl = this.buildResumeUrl(input.jobUuid)
    const fathersDay = this.fathersDayLabel()

    const text = [
      'Bonjour,',
      '',
      `Hier, vous avez créé le tableau personnalisé de ${input.playerName} — il est toujours là, précieusement gardé, et il n'attend plus que vous.`,
      '',
      `Pour le retrouver et finaliser votre commande : ${resumeUrl}`,
      '',
      ...(fathersDay
        ? [
            `Pensez-y : la fête des pères, c'est le ${fathersDay}. Il est encore temps de recevoir votre tableau à la maison pour le grand jour.`,
            '',
          ]
        : []),
      'Votre création reste sauvegardée 30 jours.',
      '',
      'À très vite,',
      "L'équipe MyselfMonArt",
    ].join('\n')

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 8px">Votre tableau vous attend</h2>
  <p style="margin:0 0 16px">Hier, vous avez créé le tableau personnalisé de <strong>${input.playerName}</strong> — il est toujours là, précieusement gardé, et il n'attend plus que vous.</p>
  ${
    input.previewUrl
      ? `<p style="margin:0 0 16px"><img src="${input.previewUrl}" alt="Aperçu de votre création" style="max-width:320px;border-radius:8px"></p>`
      : ''
  }
  <p style="margin:0 0 16px"><a href="${resumeUrl}" style="background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Reprendre ma création</a></p>
  ${
    fathersDay
      ? `<p style="margin:0 0 16px">Pensez-y : la fête des pères, c'est le <strong>${fathersDay}</strong>. Il est encore temps de recevoir votre tableau à la maison pour le grand jour.</p>`
      : ''
  }
  <p style="margin:0;color:#666;font-size:13px">Votre création reste sauvegardée 30 jours.</p>
</body></html>`

    try {
      await axios.post(
        RESEND_ENDPOINT,
        {
          from: Env.get('RESEND_FROM'),
          to: [input.email],
          subject: 'Votre tableau vous attend',
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
      Logger.error('custom-art reminder-mail échec: %s', (error as any)?.message || error)
      return false
    }
  }

  /**
   * Libellé FR de la fête des pères si elle approche, sinon null.
   * Fête des pères française = 3e dimanche de juin (21/06 en 2026) — calculée
   * dynamiquement pour rester juste les années suivantes.
   */
  private fathersDayLabel(): string | null {
    const now = DateTime.now()
    const firstOfJune = DateTime.fromObject({ year: now.year, month: 6, day: 1 })
    // Premier dimanche de juin + 2 semaines = 3e dimanche
    const firstSunday = firstOfJune.plus({ days: (7 - firstOfJune.weekday) % 7 })
    const fathersDay = firstSunday.plus({ weeks: 2 })

    const days = fathersDay.startOf('day').diff(now.startOf('day'), 'days').days
    if (days < 0 || days > FATHERS_DAY_WINDOW_DAYS) return null
    return fathersDay.setLocale('fr').toFormat('cccc d LLLL')
  }

  /**
   * Lien de reprise vers le studio sur la boutique — même contrat ca_job que
   * SaveMailer / MockupsReadyMailer.
   */
  private buildResumeUrl(jobUuid: string): string {
    const base = Env.get('STOREFRONT_URL') || Env.get('SHOPIFY_SHOP_URL')
    return `${base}/products/poster-personnalise-foot?ca_job=${jobUuid}`
  }
}
