import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'

// SMTP sortant bloqué sur le droplet DO -> envoi via l'API HTTPS Resend
// (même canal que SaveMailer / ReviewMailer / MockupsReadyMailer).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/** Un article personnalisé de la commande (aperçu + mises en situation). */
export interface OrderMailItem {
  /** Libellé de la création : « WALID » côté foot, titre/tokens côté générique */
  playerName: string
  /** null pour une création GÉNÉRIQUE (pas de numéro de maillot) */
  playerNumber: number | null
  /** null pour une création GÉNÉRIQUE (pas d'équipe) */
  teamName: string | null
  /** '30x40' | '60x80' — converti en libellé lisible (« 30 × 40 cm »). */
  format: string
  /** Slug de finition ('none', 'chene'…) — converti en libellé lisible. */
  frame: string
  /** URL publique (CDN) de l'aperçu validé par le client. */
  previewUrl: string | null
  /** URLs publiques des mises en situation déjà rendues (2 max affichées). */
  mockupUrls: string[]
}

const FORMAT_LABELS: Record<string, string> = {
  '30x40': '30 × 40 cm',
  '60x80': '60 × 80 cm',
}

/**
 * Emails transactionnels client de la chaîne post-achat (M9, plan §9) — Resend, FR,
 * ton sobre et chaleureux, cohérent avec SaveMailer / MockupsReadyMailer :
 *   - sendPaidConfirmation : à la commande payée (aperçu + mockups + délais
 *     fabrication 3-4 jours ouvrés + expédition) ;
 *   - sendInProduction : à l'approbation du fichier print (« votre tableau part
 *     en production »).
 * Best-effort : retourne false sans throw (la commande suit son cours quoi qu'il arrive).
 */
export default class OrderMailer {
  /** Email de confirmation à la commande payée. */
  public async sendPaidConfirmation(input: {
    email: string
    orderName: string | null
    items: OrderMailItem[]
  }): Promise<boolean> {
    const { email, orderName, items } = input
    const orderLabel = orderName ? ` ${orderName}` : ''

    const textItems = items
      .map(
        (item) =>
          `- ${this.itemLabel(item)}, ` +
          `${this.formatLabel(item.format)}, ${this.frameLabel(item.frame)}`
      )
      .join('\n')

    const text = [
      'Bonjour,',
      '',
      `Merci pour votre commande${orderLabel} ! Votre tableau personnalisé est entre de bonnes mains.`,
      '',
      textItems,
      '',
      'Et maintenant ?',
      '1. Notre équipe vérifie votre visuel en haute définition.',
      '2. Fabrication soignée : comptez 3 à 4 jours ouvrés.',
      "3. Expédition avec suivi : vous recevrez le numéro dès qu'il part.",
      '',
      'Une question ? Répondez simplement à cet email.',
      '',
      'À très vite,',
      "L'équipe MyselfMonArt",
    ].join('\n')

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 8px">Merci pour votre commande${this.escapeHtml(orderLabel)} !</h2>
  <p style="margin:0 0 16px">Votre tableau personnalisé est entre de bonnes mains. Voici un rappel de votre création :</p>
  ${items.map((item) => this.itemHtml(item, true)).join('\n')}
  <h3 style="margin:24px 0 8px;font-size:16px">Et maintenant ?</h3>
  <ol style="margin:0 0 16px;padding-left:20px;color:#333">
    <li style="margin-bottom:4px">Notre équipe vérifie votre visuel en haute définition.</li>
    <li style="margin-bottom:4px">Fabrication soignée : comptez <strong>3 à 4 jours ouvrés</strong>.</li>
    <li>Expédition avec suivi : vous recevrez le numéro dès qu'il part.</li>
  </ol>
  <p style="margin:0 0 16px;color:#666">Une question ? Répondez simplement à cet email.</p>
  <p style="margin:0">À très vite,<br>L'équipe MyselfMonArt</p>
</body></html>`

    return this.send({
      to: email,
      subject: `Merci ! Votre tableau personnalisé${orderLabel} est en préparation`,
      html,
      text,
    })
  }

  /** Email « votre tableau part en production » à l'approbation du fichier print. */
  public async sendInProduction(input: {
    email: string
    orderName: string | null
    item: OrderMailItem
  }): Promise<boolean> {
    const { email, orderName, item } = input
    const orderLabel = orderName ? ` ${orderName}` : ''

    const text = [
      'Bonjour,',
      '',
      `Bonne nouvelle : votre tableau personnalisé${orderLabel} part en production !`,
      '',
      `${this.itemLabel(item)}, ` +
        `${this.formatLabel(item.format)}, ${this.frameLabel(item.frame)}.`,
      '',
      'Votre visuel a été vérifié en haute définition par notre équipe.',
      "Comptez 3 à 4 jours ouvrés de fabrication, puis l'expédition avec suivi.",
      '',
      'À très vite,',
      "L'équipe MyselfMonArt",
    ].join('\n')

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 8px">Votre tableau part en production</h2>
  <p style="margin:0 0 16px">Bonne nouvelle : votre visuel a été vérifié en haute définition par notre équipe, et votre tableau personnalisé${this.escapeHtml(orderLabel)} entre en fabrication.</p>
  ${this.itemHtml(item, false)}
  <p style="margin:16px 0">Comptez <strong>3 à 4 jours ouvrés</strong> de fabrication, puis l'expédition avec suivi — vous recevrez le numéro dès qu'il part.</p>
  <p style="margin:0">À très vite,<br>L'équipe MyselfMonArt</p>
</body></html>`

    return this.send({
      to: email,
      subject: `Votre tableau personnalisé${orderLabel} part en production`,
      html,
      text,
    })
  }

  // --------------------------------------------------------------------------
  // Helpers privés
  // --------------------------------------------------------------------------

  /** Bloc HTML d'un article : récap + aperçu + (option) mises en situation. */
  private itemHtml(item: OrderMailItem, withMockups: boolean): string {
    const mockups = withMockups
      ? item.mockupUrls
          .slice(0, 2)
          .map(
            (url) =>
              `<img src="${url}" alt="Votre tableau mis en situation" ` +
              `style="max-width:240px;border-radius:8px;margin:8px 8px 0 0">`
          )
          .join('')
      : ''

    const who =
      item.playerNumber !== null ? `${item.playerName} n°${item.playerNumber}` : item.playerName
    return `<div style="margin:0 0 8px;padding:12px 16px;border:1px solid #eee;border-radius:8px">
    <p style="margin:0 0 8px"><strong>${this.escapeHtml(who)}</strong>${item.teamName ? ` — ${this.escapeHtml(item.teamName)}` : ''}<br>
    <span style="color:#666">${this.escapeHtml(this.formatLabel(item.format))} · ${this.escapeHtml(this.frameLabel(item.frame))}</span></p>
    ${
      item.previewUrl
        ? `<img src="${item.previewUrl}" alt="Aperçu de votre tableau personnalisé" style="max-width:280px;border-radius:8px">`
        : ''
    }
    ${mockups}
  </div>`
  }

  /** Ligne d'identité d'un article : « WALID n°10 (PSG) » foot, « La famille Martin » générique. */
  private itemLabel(item: OrderMailItem): string {
    const who =
      item.playerNumber !== null ? `${item.playerName} n°${item.playerNumber}` : item.playerName
    return item.teamName ? `${who} (${item.teamName})` : who
  }

  private formatLabel(format: string): string {
    return FORMAT_LABELS[format] || format
  }

  private escapeHtml(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  private frameLabel(frame: string): string {
    if (!frame || frame === 'none') return 'Sans cadre'
    const readable = frame.replace(/-/g, ' ')
    return `Cadre ${readable}`
  }

  private async send(input: {
    to: string
    subject: string
    html: string
    text: string
  }): Promise<boolean> {
    if (!Env.get('RESEND_API_KEY') || !Env.get('RESEND_FROM')) {
      Logger.warn('custom-art order-mail non envoyé (RESEND_API_KEY/RESEND_FROM absents)')
      return false
    }
    try {
      await axios.post(
        RESEND_ENDPOINT,
        {
          from: Env.get('RESEND_FROM'),
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
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
      Logger.error('custom-art order-mail échec: %s', (error as any)?.message || error)
      return false
    }
  }
}
