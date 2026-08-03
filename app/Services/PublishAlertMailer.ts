import Env from '@ioc:Adonis/Core/Env'
import axios from 'axios'

// DigitalOcean blocks outbound SMTP on the droplet, so transactional mail is
// sent over Resend's HTTPS API (same approach as EscalationMailer).
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Alerts a human when a published artwork ends up with an incomplete variant
 * matrix (Shopify throttled/limited bulk variant creation during publishing).
 */
export default class PublishAlertMailer {
  public async sendIncompleteVariants(params: {
    productId: string
    title: string
    type: string
    actual: number
    expected: number
  }): Promise<void> {
    const { productId, title, type, actual, expected } = params
    const numericId = productId.replace('gid://shopify/Product/', '')
    const storeDomain = (Env.get('SHOPIFY_STORE_DOMAIN', '') as string) || ''
    const storeHandle = storeDomain.replace('.myshopify.com', '')
    const adminUrl = storeHandle
      ? `https://admin.shopify.com/store/${storeHandle}/products/${numericId}`
      : null

    const subject = `[Publication] Variantes incomplètes — ${title}`

    const text = [
      `Un ${type} vient d'être publié mais sa matrice de variantes est incomplète.`,
      ``,
      `Produit : ${title}`,
      `Variantes créées : ${actual} / ${expected} attendues`,
      ``,
      `Cause probable : Shopify a throttlé/plafonné la création de variantes`,
      `(publication en rafale, ou cap de 1 000 variantes/jour au-delà de 50 000 variantes en boutique).`,
      ``,
      `Pour réparer : node ace shopify:resync_product_variants ${numericId}`,
      adminUrl ? `Admin Shopify : ${adminUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 4px">Variantes incomplètes à la publication</h2>
  <p style="margin:0 0 16px;color:#666">Un ${this.escapeHtml(
    type
  )} a été publié mais sa matrice de variantes n'a pas été créée entièrement.</p>
  <table style="border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:2px 12px 2px 0;color:#666">Produit</td><td><strong>${this.escapeHtml(
      title
    )}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#666">Variantes</td><td><strong>${actual} / ${expected}</strong> attendues</td></tr>
  </table>
  <p style="margin:0 0 8px;color:#666">Cause probable : Shopify a throttlé/plafonné la création de variantes
  (publication en rafale, ou cap de 1&nbsp;000 variantes/jour au-delà de 50&nbsp;000 variantes en boutique).</p>
  <p style="margin:0 0 8px">Pour réparer&nbsp;: <code>node ace shopify:resync_product_variants ${this.escapeHtml(
    numericId
  )}</code></p>
  ${
    adminUrl
      ? `<p style="margin:0 0 16px"><a href="${adminUrl}" style="background:#0095f6;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none">Ouvrir le produit dans Shopify</a></p>`
      : ''
  }
</body></html>`

    await axios.post(
      RESEND_ENDPOINT,
      {
        from: Env.get('RESEND_FROM'),
        to: [Env.get('MAIL_RECIPIENT')],
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
  }

  /**
   * Alerte de dernier recours : le cron de réparation a bien VU des produits en ligne
   * avec une matrice de variantes incomplète, mais n'a pas réussi à les réparer.
   *
   * Volontairement silencieuse quand la réparation passe (le cas normal) : on n'écrit
   * au propriétaire que quand il y a quelque chose à faire à la main.
   */
  public async sendUnrepairableArtworks(
    failures: Array<{ productId: string; title: string; variantsCount: number; reason: string }>
  ): Promise<void> {
    if (failures.length === 0) return

    const storeDomain = (Env.get('SHOPIFY_STORE_DOMAIN', '') as string) || ''
    const storeHandle = storeDomain.replace('.myshopify.com', '')
    const numericIds = failures.map((f) => f.productId.replace('gid://shopify/Product/', ''))

    const subject =
      failures.length === 1
        ? `[Boutique] Produit en ligne invendable — ${failures[0].title}`
        : `[Boutique] ${failures.length} produits en ligne invendables`

    const text = [
      `Ces produits sont en ligne mais leur grille de tailles/cadres est incomplète :`,
      `sans variantes, le client ne peut rien commander.`,
      ``,
      `La réparation automatique a échoué — il faut intervenir à la main.`,
      ``,
      ...failures.map(
        (f, i) =>
          `${i + 1}. ${f.title}\n   ${f.variantsCount} variante(s) — ${f.reason}\n   ${
            storeHandle
              ? `https://admin.shopify.com/store/${storeHandle}/products/${numericIds[i]}`
              : numericIds[i]
          }`
      ),
      ``,
      `Relancer la réparation : node ace shopify:resync_product_variants ${numericIds.join(' ')}`,
    ].join('\n')

    const rows = failures
      .map((f, i) => {
        const adminUrl = storeHandle
          ? `https://admin.shopify.com/store/${storeHandle}/products/${numericIds[i]}`
          : null
        const name = adminUrl
          ? `<a href="${adminUrl}" style="color:#0095f6">${this.escapeHtml(f.title)}</a>`
          : this.escapeHtml(f.title)
        return `<tr>
      <td style="padding:6px 12px 6px 0;border-top:1px solid #eee">${name}</td>
      <td style="padding:6px 12px 6px 0;border-top:1px solid #eee"><strong>${
        f.variantsCount
      }</strong> variante(s)</td>
      <td style="padding:6px 0;border-top:1px solid #eee;color:#666">${this.escapeHtml(
        f.reason
      )}</td>
    </tr>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 4px">Produits en ligne sans variantes</h2>
  <p style="margin:0 0 16px;color:#666">Ces produits sont visibles sur la boutique mais leur grille de
  tailles/cadres est incomplète : le client ne peut rien commander. La réparation automatique n'a pas abouti.</p>
  <table style="border-collapse:collapse;margin-bottom:16px">${rows}</table>
  <p style="margin:0 0 8px">Relancer la réparation&nbsp;: <code>node ace shopify:resync_product_variants ${this.escapeHtml(
    numericIds.join(' ')
  )}</code></p>
</body></html>`

    await axios.post(
      RESEND_ENDPOINT,
      { from: Env.get('RESEND_FROM'), to: [Env.get('MAIL_RECIPIENT')], subject, html, text },
      {
        headers: {
          'Authorization': `Bearer ${Env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        timeout: 10000,
      }
    )
  }

  /**
   * Alerte « refaire les images » (mode reimage du Publisher) : le remplacement a
   * échoué (nouveaux médias FAILED, rollback effectué) ou le nettoyage des anciennes
   * images est incomplet — un humain doit vérifier le produit.
   */
  public async sendReimageIssue(params: {
    productId: string
    title: string
    issue: string
    mediaIds?: string[]
  }): Promise<void> {
    const { productId, title, issue, mediaIds } = params
    const numericId = productId.replace('gid://shopify/Product/', '')
    const storeDomain = (Env.get('SHOPIFY_STORE_DOMAIN', '') as string) || ''
    const storeHandle = storeDomain.replace('.myshopify.com', '')
    const adminUrl = storeHandle
      ? `https://admin.shopify.com/store/${storeHandle}/products/${numericId}`
      : null

    const subject = `[Reimage] Problème de remplacement d'images — ${title}`

    const text = [
      `Le remplacement des images du produit a rencontré un problème.`,
      ``,
      `Produit : ${title}`,
      `Problème : ${issue}`,
      mediaIds?.length ? `Médias concernés : ${mediaIds.join(', ')}` : '',
      ``,
      adminUrl ? `Admin Shopify : ${adminUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 4px">Remplacement d'images — problème détecté</h2>
  <table style="border-collapse:collapse;margin-bottom:16px">
    <tr><td style="padding:2px 12px 2px 0;color:#666">Produit</td><td><strong>${this.escapeHtml(
      title
    )}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#666">Problème</td><td>${this.escapeHtml(
      issue
    )}</td></tr>
  </table>
  ${
    mediaIds?.length
      ? `<p style="margin:0 0 8px;color:#666">Médias concernés&nbsp;:</p><ul style="margin:0 0 16px">${mediaIds
          .map((id) => `<li><code>${this.escapeHtml(id)}</code></li>`)
          .join('')}</ul>`
      : ''
  }
  ${
    adminUrl
      ? `<p style="margin:0 0 16px"><a href="${adminUrl}" style="background:#0095f6;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none">Ouvrir le produit dans Shopify</a></p>`
      : ''
  }
</body></html>`

    await axios.post(
      RESEND_ENDPOINT,
      {
        from: Env.get('RESEND_FROM'),
        to: [Env.get('MAIL_RECIPIENT')],
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
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}
