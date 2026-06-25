import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'
import { buildCustomArtResumeUrl } from 'App/Services/CustomArt/resumeUrl'
import { renderSaveEmail } from 'App/Services/CustomArt/emailTemplate'

// SMTP sortant bloqué sur le droplet DO -> envoi via l'API HTTPS Resend
// (même canal que EscalationMailer).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Email « Sauvegarder ma création » : lien de reprise du studio + aperçu.
 * Gabarit de marque partagé (App/Services/CustomArt/emailTemplate). Retourne false (sans
 * throw) si l'envoi est impossible — la sauvegarde de l'email en session reste acquise
 * même si le mail part plus tard.
 */
export default class SaveMailer {
  public async send(input: {
    email: string
    jobUuid: string
    previewUrl: string | null
  }): Promise<boolean> {
    if (!Env.get('RESEND_API_KEY') || !Env.get('RESEND_FROM')) {
      Logger.warn('custom-art save-mail non envoyé (RESEND_API_KEY/RESEND_FROM absents)')
      return false
    }

    const resumeUrl = buildCustomArtResumeUrl(input.jobUuid)
    const { subject, html, text } = renderSaveEmail({ resumeUrl, previewUrl: input.previewUrl })

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
      Logger.error('custom-art save-mail échec: %s', (error as any)?.message || error)
      return false
    }
  }
}
