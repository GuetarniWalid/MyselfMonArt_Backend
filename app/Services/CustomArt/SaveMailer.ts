import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'

// SMTP sortant bloqué sur le droplet DO -> envoi via l'API HTTPS Resend
// (même canal que EscalationMailer).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Email « Sauvegarder ma création » : lien de reprise du studio + aperçu watermarké.
 * Texte simple FR. Retourne false (sans throw) si l'envoi est impossible — la sauvegarde
 * de l'email en session reste acquise même si le mail part plus tard.
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

    const resumeUrl = this.buildResumeUrl(input.jobUuid)

    const text = [
      'Bonjour,',
      '',
      'Votre création personnalisée MyselfMonArt est bien sauvegardée.',
      '',
      `Pour la retrouver et finaliser votre tableau : ${resumeUrl}`,
      '',
      'Le lien reste valable 30 jours.',
      '',
      'À très vite,',
      "L'équipe MyselfMonArt",
    ].join('\n')

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 8px">Votre création vous attend</h2>
  <p style="margin:0 0 16px">Votre tableau personnalisé MyselfMonArt est bien sauvegardé.</p>
  ${
    input.previewUrl
      ? `<p style="margin:0 0 16px"><img src="${input.previewUrl}" alt="Aperçu de votre création" style="max-width:320px;border-radius:8px"></p>`
      : ''
  }
  <p style="margin:0 0 16px"><a href="${resumeUrl}" style="background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Reprendre ma création</a></p>
  <p style="margin:0;color:#666;font-size:13px">Le lien reste valable 30 jours.</p>
</body></html>`

    try {
      await axios.post(
        RESEND_ENDPOINT,
        {
          from: Env.get('RESEND_FROM'),
          to: [input.email],
          subject: 'Votre création MyselfMonArt vous attend',
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

  /**
   * Lien de reprise vers le studio sur la boutique. Le chemin exact de la fiche
   * personnalisée sera figé en M6/M8 — le paramètre ca_job est le contrat.
   */
  private buildResumeUrl(jobUuid: string): string {
    const base = Env.get('STOREFRONT_URL') || Env.get('SHOPIFY_SHOP_URL')
    return `${base}/products/poster-personnalise-foot?ca_job=${jobUuid}`
  }
}
