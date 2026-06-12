import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'

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

    const resumeUrl = this.buildResumeUrl(input.jobUuid)

    const text = [
      'Bonjour,',
      '',
      'Les aperçus de votre tableau personnalisé mis en situation sont prêts !',
      '',
      `Pour les découvrir et finaliser votre tableau : ${resumeUrl}`,
      '',
      'Le lien reste valable 30 jours.',
      '',
      'À très vite,',
      "L'équipe MyselfMonArt",
    ].join('\n')

    const thumbs = input.mockupUrls
      .slice(0, 2)
      .map(
        (url) =>
          `<img src="${url}" alt="Aperçu de votre tableau en situation" ` +
          `style="max-width:280px;border-radius:8px;margin:0 8px 8px 0">`
      )
      .join('')

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 8px">Vos aperçus en situation sont prêts</h2>
  <p style="margin:0 0 16px">Découvrez votre tableau personnalisé MyselfMonArt mis en situation, comme chez vous.</p>
  ${thumbs ? `<p style="margin:0 0 16px">${thumbs}</p>` : ''}
  <p style="margin:0 0 16px"><a href="${resumeUrl}" style="background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Voir mon tableau en situation</a></p>
  <p style="margin:0;color:#666;font-size:13px">Le lien reste valable 30 jours.</p>
</body></html>`

    try {
      await axios.post(
        RESEND_ENDPOINT,
        {
          from: Env.get('RESEND_FROM'),
          to: [input.email],
          subject: 'Vos aperçus en situation sont prêts',
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

  /**
   * Lien de reprise vers le studio sur la boutique — même contrat ca_job que SaveMailer
   * (le chemin exact de la fiche personnalisée est figé en M6/M8).
   */
  private buildResumeUrl(jobUuid: string): string {
    const base = Env.get('STOREFRONT_URL') || Env.get('SHOPIFY_SHOP_URL')
    return `${base}/products/poster-personnalise-foot?ca_job=${jobUuid}`
  }
}
