import Env from '@ioc:Adonis/Core/Env'
import axios from 'axios'

/**
 * Alerte « le jeton d'un réseau social est mort ».
 *
 * Deux défauts corrigés ici, tous deux constatés en production :
 *
 *   1. L'alerte partait par SMTP via @adonisjs/mail — or DigitalOcean bloque les
 *      ports sortants 25/465/587 sur le droplet. Le message n'est jamais arrivé,
 *      et Pinterest comme Instagram ont pu rester muets des semaines sans que
 *      personne ne soit prévenu. On passe par l'API HTTPS de Resend, le seul
 *      chemin qui fonctionne depuis ce serveur (cf. EscalationMailer).
 *   2. L'envoi lançait une exception qui REMPLAÇAIT l'erreur d'origine : les
 *      logs affichaient « Connection timeout » (nodemailer) au lieu de
 *      « Refresh token is expired ». Le diagnostic devenait impossible. Ici on
 *      n'échoue jamais : au pire on trace l'échec d'envoi, et l'erreur réelle
 *      continue de remonter intacte.
 */
export default class TokenAlert {
  private static readonly RESEND_ENDPOINT = 'https://api.resend.com/emails'

  public static async notify(channel: 'pinterest' | 'instagram', error: unknown): Promise<void> {
    const detail = TokenAlert.describe(error)
    const subject = `[${channel}] jeton invalide — publication automatique à l'arrêt`

    // Toujours dans les logs, même si l'e-mail ne part pas.
    console.error(`🔴 ${subject}: ${detail}`)

    try {
      await axios.post(
        TokenAlert.RESEND_ENDPOINT,
        {
          from: Env.get('RESEND_FROM'),
          to: [Env.get('MAIL_RECIPIENT')],
          subject,
          html: `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 4px">${channel} — jeton invalide</h2>
  <p style="margin:0 0 16px;color:#666">La publication automatique est à l'arrêt tant que le compte n'est pas ré-autorisé.</p>
  <pre style="background:#f6f6f6;padding:12px;border-radius:6px;white-space:pre-wrap">${TokenAlert.escapeHtml(detail)}</pre>
</body></html>`,
          text: `${channel} — jeton invalide. La publication automatique est à l'arrêt.\n\n${detail}`,
        },
        {
          headers: {
            'Authorization': `Bearer ${Env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          timeout: 10000,
        }
      )
    } catch (sendError) {
      // Ne jamais masquer l'erreur d'origine : on se contente de tracer.
      console.error(`[${channel}] alerte non délivrée: ${(sendError as any)?.message ?? sendError}`)
    }
  }

  private static describe(error: unknown): string {
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }

  private static escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}
