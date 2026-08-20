import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'
import { buildCustomArtResumeUrl } from 'App/Services/CustomArt/resumeUrl'
import { renderReadyEmail, normalizeCustomArtLocale } from 'App/Services/CustomArt/emailTemplate'

// SMTP sortant bloqué sur le droplet DO -> envoi via l'API HTTPS Resend
// (même canal que SaveMailer / MockupsReadyMailer / ReviewMailer).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * E-mail « votre création est prête » — envoyé quand une création dépasse la patience du studio
 * (3 min) et que la cliente a demandé à être prévenue.
 *
 * C'est le SEUL lien qui lui reste vers sa création : sans lui, une génération un peu longue
 * était perdue pour elle. Il part donc dans SA langue (cf. renderReadyEmail).
 *
 * Best-effort : retourne false sans throw — un échec d'envoi ne doit jamais faire échouer le job,
 * qui est par ailleurs terminé et consultable.
 */
export default class ReadyMailer {
  public async send(input: {
    email: string
    jobUuid: string
    locale: string | null
    previewUrl: string | null
  }): Promise<boolean> {
    if (!Env.get('RESEND_API_KEY') || !Env.get('RESEND_FROM')) {
      Logger.warn('custom-art ready-mail non envoyé (RESEND_API_KEY/RESEND_FROM absents)')
      return false
    }

    const resumeUrl = buildCustomArtResumeUrl(input.jobUuid)
    const { subject, html, text } = renderReadyEmail({
      locale: normalizeCustomArtLocale(input.locale),
      resumeUrl,
      previewUrl: input.previewUrl,
    })

    try {
      await axios.post(
        RESEND_ENDPOINT,
        { from: Env.get('RESEND_FROM'), to: [input.email], subject, html, text },
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
      Logger.error('custom-art ready-mail échec: %s', (error as any)?.message || error)
      return false
    }
  }
}
