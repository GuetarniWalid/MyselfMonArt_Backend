import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'
import { buildCustomArtResumeUrl } from 'App/Services/CustomArt/resumeUrl'
import { renderMockupsEmail } from 'App/Services/CustomArt/emailTemplate'

// SMTP sortant bloqué sur le droplet DO -> envoi via l'API HTTPS Resend
// (même canal que EscalationMailer / SaveMailer / ReviewMailer).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Email « vos aperçus en situation sont prêts » (plan §8, touchpoint de relance bonus) :
 * envoyé quand le backlog mockups d'un job est rattrapé APRÈS coup (moteur Photopea
 * down au moment du reveal) et que la session a laissé un email. Lien de reprise du
 * studio (paramètre ca_job, même contrat que SaveMailer) + aperçus en situation.
 * Best-effort : retourne false sans throw (les mockups restent visibles au polling).
 */
export default class MockupsReadyMailer {
  public async send(input: {
    email: string
    jobUuid: string
    /** URLs publiques (CDN) des mises en situation rendues, dans l'ordre des PSD */
    mockupUrls: string[]
  }): Promise<boolean> {
    if (!Env.get('RESEND_API_KEY') || !Env.get('RESEND_FROM')) {
      Logger.warn('custom-art mockups-mail non envoyé (RESEND_API_KEY/RESEND_FROM absents)')
      return false
    }

    const resumeUrl = buildCustomArtResumeUrl(input.jobUuid)
    const { subject, html, text } = renderMockupsEmail({ resumeUrl, mockupUrls: input.mockupUrls })

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
      Logger.error('custom-art mockups-mail échec: %s', (error as any)?.message || error)
      return false
    }
  }
}
