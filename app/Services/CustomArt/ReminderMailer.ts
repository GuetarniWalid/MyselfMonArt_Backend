import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'
import { DateTime } from 'luxon'
import { buildCustomArtResumeUrl } from 'App/Services/CustomArt/resumeUrl'
import { renderReminderEmail } from 'App/Services/CustomArt/emailTemplate'

// SMTP sortant bloqué sur le droplet DO -> envoi via l'API HTTPS Resend
// (même canal que EscalationMailer / SaveMailer / MockupsReadyMailer).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

// La mention fête des pères n'apparaît que dans les N jours qui précèdent la date
// (au-delà ou après, elle serait hors sujet dans un email de relance).
const FATHERS_DAY_WINDOW_DAYS = 15

/**
 * Relance « création sauvegardée » (M10) : email chaleureux « votre tableau vous
 * attend » envoyé UNE seule fois, 20-28 h après la création, aux sessions qui ont
 * laissé un email sans acheter. Aperçu + lien de reprise (contrat ca_job,
 * même que SaveMailer) + rappel fête des pères quand la date approche (21/06 en 2026).
 * Best-effort : retourne false sans throw (la Task relancera tant que la fenêtre
 * 20-28 h n'est pas dépassée).
 */
export default class ReminderMailer {
  public async send(input: {
    email: string
    jobUuid: string
    /** URL publique (CDN) de l'aperçu du candidat élu, null si indisponible */
    previewUrl: string | null
    playerName: string
  }): Promise<boolean> {
    if (!Env.get('RESEND_API_KEY') || !Env.get('RESEND_FROM')) {
      Logger.warn('custom-art reminder-mail non envoyé (RESEND_API_KEY/RESEND_FROM absents)')
      return false
    }

    const resumeUrl = buildCustomArtResumeUrl(input.jobUuid)
    const { subject, html, text } = renderReminderEmail({
      resumeUrl,
      previewUrl: input.previewUrl,
      playerName: input.playerName,
      fathersDay: this.fathersDayLabel(),
    })

    try {
      await axios.post(
        RESEND_ENDPOINT,
        {
          from: Env.get('RESEND_FROM'),
          to: [input.email],
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
}
