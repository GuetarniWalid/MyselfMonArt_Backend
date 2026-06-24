import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'

// SMTP sortant bloqué sur le droplet DO -> envoi via l'API HTTPS Resend
// (même canal que EscalationMailer / SaveMailer / ReminderMailer).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * E-mail de confirmation de « déblocage d'essai » (décision Walid 2026-06-24).
 *
 * Envoyé au PREMIER e-mail laissé par un visiteur ANONYME du studio — le moment où le cap
 * bascule de 2 à 5 essais/jour (cf. CustomArtController.attachEmailIfMissing). Confirme le
 * déblocage, capte le lead, et donne le lien de reprise de la création tout juste lancée
 * (contrat ?ca_job, même que SaveMailer / ReminderMailer).
 *
 * Best-effort : retourne false sans throw — le déblocage et la génération restent acquis
 * même si l'e-mail part en retard ou échoue (l'appelant l'invoque en fire-and-forget).
 */
export default class UnlockMailer {
  public async send(input: { email: string; jobUuid: string }): Promise<boolean> {
    if (!Env.get('RESEND_API_KEY') || !Env.get('RESEND_FROM')) {
      Logger.warn('custom-art unlock-mail non envoyé (RESEND_API_KEY/RESEND_FROM absents)')
      return false
    }

    const resumeUrl = this.buildResumeUrl(input.jobUuid)

    const text = [
      'Bonjour,',
      '',
      'Bonne nouvelle : ton essai est débloqué ! Tu peux continuer à créer ton tableau personnalisé.',
      '',
      `Pour suivre et retrouver ta création : ${resumeUrl}`,
      '',
      'Tes créations restent sauvegardées 30 jours.',
      '',
      'À très vite,',
      "L'équipe MyselfMonArt",
    ].join('\n')

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 8px">Ton essai est débloqué 🎉</h2>
  <p style="margin:0 0 16px">Merci ! Tu peux continuer à créer ton tableau personnalisé MyselfMonArt.</p>
  <p style="margin:0 0 16px"><a href="${resumeUrl}" style="background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Reprendre ma création</a></p>
  <p style="margin:0;color:#666;font-size:13px">Tes créations restent sauvegardées 30 jours.</p>
</body></html>`

    try {
      await axios.post(
        RESEND_ENDPOINT,
        {
          from: Env.get('RESEND_FROM'),
          to: [input.email],
          subject: 'Ton essai MyselfMonArt est débloqué',
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
      Logger.error('custom-art unlock-mail échec: %s', (error as any)?.message || error)
      return false
    }
  }

  /**
   * Lien de reprise vers le studio sur la boutique — même contrat ca_job que
   * SaveMailer / ReminderMailer / MockupsReadyMailer.
   */
  private buildResumeUrl(jobUuid: string): string {
    const base = Env.get('STOREFRONT_URL') || Env.get('SHOPIFY_SHOP_URL')
    return `${base}/products/poster-personnalise-foot?ca_job=${jobUuid}`
  }
}
