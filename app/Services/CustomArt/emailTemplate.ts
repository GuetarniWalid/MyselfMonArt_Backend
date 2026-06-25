/**
 * Gabarit HTML partagé des emails du studio CustomArt — design « Galerie Terracotta »
 * dérivé de la palette du thème live MyselfMonArt (terracotta/blush sur crème, encre
 * brun-noir, CTA = couleur du bouton d'achat du site). Issu de la refonte multi-agents
 * (design system + copywriting + UI/UX + revue email-safe : Outlook VML, dark mode,
 * mobile, préheader caché, accessibilité).
 *
 * Module PUR (aucune dépendance Adonis) : SaveMailer / ReminderMailer / MockupsReadyMailer
 * appellent renderSaveEmail / renderReminderEmail / renderMockupsEmail et envoient le
 * { subject, html, text } via Resend. Un seul endroit pour faire évoluer le shell.
 */

const LOGO_URL =
  'https://www.myselfmonart.com/cdn/shop/files/logo-MyselfMonArt_a7b9a9ae-c049-4b20-a2d1-b8ec0116ac7e.png?v=1683973841&width=600'
const STORE_URL = 'https://www.myselfmonart.com'
const CONTACT_EMAIL = 'contact@myselfmonart.com'

export interface ReassureItem {
  strong: string
  rest: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/** Échappe le texte dynamique injecté dans le HTML (ex: prénom du joueur). */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Échappe une URL pour un attribut href/src (& -> &amp;). */
function escUrl(u: string): string {
  return String(u ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
}

/** Convertit un fragment HTML de marque en texte brut (version texte de l'email). */
function toText(html: string): string {
  return String(html)
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/&rsquo;/g, '’')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8203;/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

const SANS = "Roboto,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
const SERIF = "'Limelight',Georgia,'Times New Roman',serif"

// ---------------------------------------------------------------------------
// Briques de shell partagées
// ---------------------------------------------------------------------------

function head(titleHtml: string): string {
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${titleHtml}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Limelight&family=Roboto:wght@400;700&display=swap');
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
    table { border-collapse:collapse !important; }
    body { margin:0 !important; padding:0 !important; width:100% !important; height:100% !important; }
    a { text-decoration:none; }
    @media screen and (max-width:600px) {
      .email-container { width:100% !important; }
      .gutter { padding-left:24px !important; padding-right:24px !important; }
      .h1 { font-size:26px !important; line-height:32px !important; }
      .cta-btn { width:100% !important; max-width:320px !important; }
      .cta-btn-a { padding-left:20px !important; padding-right:20px !important; }
      .reassure-item { display:block !important; width:100% !important; padding:10px 0 !important; }
      .reassure-sep { display:none !important; }
    }
    @media (prefers-color-scheme: dark) {
      .dm-card { background-color:#FFFFFF !important; }
      .dm-cream { background-color:#F3E1DA !important; }
      .dm-body { background-color:#FFFFFF !important; }
      .dm-cta { color:#FFFFFF !important; background-color:#A65437 !important; }
    }
  </style>
</head>`
}

function headerRow(): string {
  return `<tr>
            <td class="gutter dm-cream" align="center" bgcolor="#F3E1DA" style="background-color:#F3E1DA; padding:28px 32px;">
              <a href="${STORE_URL}" target="_blank" style="text-decoration:none; color:#21150C;">
                <img src="${escUrl(LOGO_URL)}" alt="MyselfMonArt" width="160" style="display:block; width:160px; max-width:160px; height:auto; margin:0 auto;">
              </a>
            </td>
          </tr>
          <tr>
            <td height="1" bgcolor="#DFAE9D" style="height:1px; line-height:1px; font-size:1px; mso-line-height-rule:exactly; background-color:#DFAE9D;"><div style="font-size:1px; line-height:1px;">&#8203;</div></td>
          </tr>`
}

function footerRow(): string {
  return `<tr>
            <td bgcolor="#21150C" style="background-color:#21150C; padding:28px 32px;" align="center">
              <p style="margin:0 0 8px 0; font-family:${SERIF}; font-size:18px; line-height:24px; color:#F3E1DA;">L&rsquo;atelier MyselfMonArt</p>
              <p style="margin:0 0 16px 0; font-family:${SANS}; font-size:13px; line-height:20px; color:#E9C7BC;">Une question ? Répondez simplement à cet e-mail, nous sommes là pour vous accompagner.</p>
              <p style="margin:0 0 12px 0; font-family:${SANS}; font-size:12px; line-height:18px; color:#E9C7BC;">
                <a href="${STORE_URL}" target="_blank" style="color:#DFAE9D; text-decoration:underline;">Visiter la boutique</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:${CONTACT_EMAIL}" target="_blank" style="color:#DFAE9D; text-decoration:underline;">Contacter l&rsquo;atelier</a>
              </p>
              <p style="margin:0; font-family:${SANS}; font-size:12px; line-height:18px; color:#E9C7BC;">MyselfMonArt &middot; myselfmonart.com &mdash; tableaux personnalisés, conçus en France.</p>
            </td>
          </tr>`
}

function eyebrowRow(text: string): string {
  return `<tr>
            <td class="gutter dm-body" align="center" bgcolor="#FFFFFF" style="background-color:#FFFFFF; padding:32px 32px 0 32px;">
              <p style="margin:0; font-family:${SANS}; font-size:12px; line-height:16px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#A65437;">${text}</p>
            </td>
          </tr>`
}

function h1Row(html: string): string {
  return `<tr>
            <td class="gutter dm-body" align="center" bgcolor="#FFFFFF" style="background-color:#FFFFFF; padding:16px 32px 8px 32px;">
              <h1 class="h1" style="margin:0; font-family:${SERIF}; font-size:30px; line-height:38px; letter-spacing:0.5px; color:#21150C; font-weight:400;">${html}</h1>
            </td>
          </tr>`
}

function bodyRow(paragraphsHtml: string[]): string {
  const ps = paragraphsHtml
    .map(
      (p, i) =>
        `<p style="margin:0${i < paragraphsHtml.length - 1 ? ' 0 16px 0' : ''}; font-family:${SANS}; font-size:16px; line-height:26px; color:#21150C;">${p}</p>`
    )
    .join('\n              ')
  return `<tr>
            <td class="gutter dm-body" align="left" bgcolor="#FFFFFF" style="background-color:#FFFFFF; padding:16px 32px 0 32px;">
              ${ps}
            </td>
          </tr>`
}

function ctaButton(url: string, label: string): string {
  const u = escUrl(url)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr>
                  <td align="center" bgcolor="#A65437" style="border-radius:6px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${u}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="12%" strokecolor="#6D3724" fillcolor="#A65437">
                      <w:anchorlock/>
                      <center style="color:#FFFFFF;font-family:Roboto,Arial,sans-serif;font-size:16px;font-weight:700;letter-spacing:.3px;">${label}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a class="cta-btn cta-btn-a dm-cta" href="${u}" target="_blank" style="display:inline-block; padding:16px 36px; border:1px solid #6D3724; border-radius:6px; background-color:#A65437; color:#FFFFFF; font-family:${SANS}; font-size:16px; font-weight:700; line-height:16px; letter-spacing:.3px; text-decoration:none;">${label}</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>`
}

function intentCtaRow(intentHtml: string, url: string, label: string): string {
  return `<tr>
            <td class="gutter dm-body" align="center" bgcolor="#FFFFFF" style="background-color:#FFFFFF; padding:24px 32px 8px 32px;">
              <p style="margin:0 0 16px 0; font-family:${SANS}; font-size:14px; line-height:22px; color:#6D3724;">${intentHtml}</p>
              ${ctaButton(url, label)}
            </td>
          </tr>`
}

function fathersDayRow(lineHtml: string, url: string): string {
  return `<tr>
            <td class="gutter dm-body" bgcolor="#FFFFFF" style="background-color:#FFFFFF; padding:24px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                <tr>
                  <td bgcolor="#E9C7BC" style="background-color:#E9C7BC; padding:20px 24px; border:1px solid #A65437;">
                    <p style="margin:0 0 6px 0; font-family:Roboto,Arial,sans-serif; font-size:12px; line-height:16px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#A93514;">Édition fête des pères</p>
                    <p style="margin:0 0 12px 0; font-family:Roboto,Arial,sans-serif; font-size:14px; line-height:22px; color:#21150C;">${lineHtml}</p>
                    <a href="${escUrl(url)}" target="_blank" style="font-family:Roboto,Arial,sans-serif; font-size:14px; font-weight:700; color:#A65437; text-decoration:underline;">Composer pour la fête des pères</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
}

function spacerRow(): string {
  return `<tr><td class="dm-body" bgcolor="#FFFFFF" style="background-color:#FFFFFF; height:28px; line-height:28px; font-size:0; mso-line-height-rule:exactly;">&nbsp;</td></tr>`
}

function reassuranceRow(items: ReassureItem[]): string {
  const width = items.length >= 3 ? '33%' : items.length === 2 ? '50%' : '100%'
  const sep = `<td class="reassure-sep" width="1" bgcolor="#DFAE9D" style="width:1px; font-size:1px; line-height:1px; mso-line-height-rule:exactly; background-color:#DFAE9D;"><div style="font-size:1px; line-height:1px;">&#8203;</div></td>`
  const cells: string[] = []
  items.forEach((it, i) => {
    if (i > 0) cells.push(sep)
    cells.push(
      `<td class="reassure-item" align="center" valign="top" width="${width}" style="padding:6px 10px;"><p style="margin:0; font-family:Roboto,Arial,sans-serif; font-size:13px; line-height:18px; color:#21150C;"><strong style="color:#21150C;">${it.strong}</strong><br>${it.rest}</p></td>`
    )
  })
  return `<tr>
            <td bgcolor="#F3E1DA" class="dm-cream" style="background-color:#F3E1DA; padding:20px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;"><tr>${cells.join('')}</tr></table>
            </td>
          </tr>`
}

/** Cellule « cadre crème + passe-partout blanc » autour d'une image (ou d'un contenu). */
function framedCell(innerHtml: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                <tr>
                  <td align="center" bgcolor="#F3E1DA" style="background-color:#F3E1DA; padding:14px;">
                    ${innerHtml}
                  </td>
                </tr>
              </table>`
}

/** Cartel d'attente (repli quand aucun visuel n'est disponible). */
function waitingPlate(titleHtml: string, subHtml: string): string {
  return framedCell(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" height="360" style="width:100%;">
                      <tr>
                        <td align="center" valign="middle" height="360" bgcolor="#E9C7BC" style="background-color:#E9C7BC; padding:32px 24px; border:1px solid #A65437;">
                          <p style="margin:0 0 6px 0; font-family:${SERIF}; font-size:14px; line-height:18px; letter-spacing:2px; text-transform:uppercase; color:#A65437;">Aperçu</p>
                          <p style="margin:0 0 6px 0; font-family:${SERIF}; font-size:20px; line-height:26px; color:#6D3724;">${titleHtml}</p>
                          <p style="margin:0; font-family:${SANS}; font-size:14px; line-height:22px; color:#6D3724;">${subHtml}</p>
                        </td>
                      </tr>
                    </table>`
  )
}

function captionP(html: string): string {
  return `<p style="margin:12px 0 0 0; font-family:${SANS}; font-size:14px; line-height:22px; font-style:italic; color:#21150C;">${html}</p>`
}

/** Hero « aperçu unique encadré » (save / reminder), avec repli cartel si pas d'image. */
function framedPreviewRow(opts: {
  previewUrl?: string | null
  alt: string
  caption: string
  fallbackTitle: string
  fallbackSub: string
}): string {
  let inner: string
  if (opts.previewUrl) {
    const img = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                      <tr>
                        <td align="center" bgcolor="#FFFFFF" style="background-color:#FFFFFF; padding:24px; border:1px solid #A65437;">
                          <img src="${escUrl(opts.previewUrl)}" alt="${esc(opts.alt)}" width="476" style="display:block; width:100%; max-width:476px; height:auto; border:1px solid #E9C7BC;">
                        </td>
                      </tr>
                    </table>`
    inner = framedCell(img) + '\n              ' + captionP(opts.caption)
  } else {
    inner = waitingPlate(opts.fallbackTitle, opts.fallbackSub)
  }
  return `<tr>
            <td class="gutter dm-body" align="center" bgcolor="#FFFFFF" style="background-color:#FFFFFF; padding:20px 32px 8px 32px;">
              ${inner}
            </td>
          </tr>`
}

/** Hero « grille 2 mises en situation » (mockups), repli cartel si rien. */
function mockupsGridRow(opts: {
  url1?: string | null
  url2?: string | null
  caption: string
  fallbackTitle: string
  fallbackSub: string
}): string {
  let inner: string
  const cellImg = (url: string, alt: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                            <tr>
                              <td align="center" bgcolor="#FFFFFF" style="background-color:#FFFFFF; padding:14px; border:1px solid #A65437;">
                                <img src="${escUrl(url)}" alt="${esc(alt)}" width="218" style="display:block; width:100%; max-width:218px; height:auto; border:1px solid #E9C7BC;">
                              </td>
                            </tr>
                          </table>`
  if (opts.url1 && opts.url2) {
    const grid = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                      <tr>
                        <td class="mockup-cell" align="center" valign="top" width="50%" style="width:50%; padding:0 7px 0 0;">${cellImg(
                          opts.url1,
                          'Votre tableau personnalisé accroché sur un mur'
                        )}</td>
                        <td class="mockup-gap" width="14" style="font-size:0; line-height:0; width:14px;">&nbsp;</td>
                        <td class="mockup-cell" align="center" valign="top" width="50%" style="width:50%; padding:0 0 0 7px;">${cellImg(
                          opts.url2,
                          'Votre tableau personnalisé en situation dans un intérieur'
                        )}</td>
                      </tr>
                    </table>`
    inner = framedCell(grid) + '\n              ' + captionP(opts.caption)
  } else if (opts.url1) {
    inner =
      framedCell(cellImg(opts.url1, 'Votre tableau personnalisé en situation')) +
      '\n              ' +
      captionP(opts.caption)
  } else {
    inner = waitingPlate(opts.fallbackTitle, opts.fallbackSub)
  }
  return `<tr>
            <td class="gutter dm-body" align="center" bgcolor="#FFFFFF" style="background-color:#FFFFFF; padding:20px 32px 8px 32px;">
              ${inner}
            </td>
          </tr>`
}

function layout(opts: { title: string; preheader: string; rows: string }): string {
  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
${head(opts.title)}
<body style="margin:0; padding:0; width:100%; background-color:#F3E1DA;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F3E1DA;">
    ${opts.preheader}
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F3E1DA;">
    <tr>
      <td align="center" style="padding:24px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="email-container dm-card" bgcolor="#FFFFFF" style="width:600px; max-width:600px; background-color:#FFFFFF;">
          ${headerRow()}
          ${opts.rows}
          ${footerRow()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

const INTENT_LINE =
  'Un clic, vous validez l&rsquo;aperçu &mdash; on n&rsquo;imprime qu&rsquo;ensuite.'
const CTA_LABEL = 'Reprendre ma création'

function textVersion(opts: {
  headline: string
  paragraphs: string[]
  reassurance: ReassureItem[]
  resumeUrl: string
  fathersDayText?: string | null
}): string {
  const lines = [
    toText(opts.headline),
    '',
    ...opts.paragraphs.map(toText),
    '',
    ...(opts.fathersDayText ? [toText(opts.fathersDayText), ''] : []),
    `${toText(CTA_LABEL)} : ${opts.resumeUrl}`,
    '',
    ...opts.reassurance.map((r) => `• ${toText(r.strong)} — ${toText(r.rest)}`),
    '',
    'Une question ? Répondez simplement à cet e-mail.',
    'L’équipe MyselfMonArt',
  ]
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Emails publics
// ---------------------------------------------------------------------------

/** Email « sauvegarde de création » (avant achat). */
export function renderSaveEmail(input: {
  resumeUrl: string
  previewUrl: string | null
}): RenderedEmail {
  const paragraphs = [
    'Tout est gardé tel quel : le prénom, le numéro floqué, le maillot aux couleurs du club, l&rsquo;ambiance du stade. Rien n&rsquo;est perdu, rien ne presse &mdash; votre création reste accessible 30 jours.',
    'Quand le moment vous semblera juste, un seul clic vous y ramène. Vous gardez la main jusqu&rsquo;au bout : vous validez l&rsquo;aperçu, et nous n&rsquo;imprimons qu&rsquo;ensuite. Pas avant.',
  ]
  const reassurance: ReassureItem[] = [
    { strong: 'Aperçu avant achat', rest: 'vous validez, puis nous imprimons' },
    { strong: 'Conçu en France', rest: 'imprimé en Europe &mdash; rendu mat' },
    { strong: 'Fabrication 3 à 4 jours ouvrés', rest: 'expédition suivie' },
  ]
  const headline = 'Votre création vous attend, intacte'
  const rows = [
    eyebrowRow('Brouillon conservé'),
    framedPreviewRow({
      previewUrl: input.previewUrl,
      alt: 'Aperçu de votre tableau personnalisé',
      caption: 'Épreuve d&rsquo;atelier &mdash; non encore imprimée.',
      fallbackTitle: 'Votre création est conservée',
      fallbackSub: 'L&rsquo;aperçu se révèle dès que vous reprenez votre tableau.',
    }),
    h1Row(headline),
    bodyRow(paragraphs),
    intentCtaRow(INTENT_LINE, input.resumeUrl, CTA_LABEL),
    spacerRow(),
    reassuranceRow(reassurance),
  ].join('\n          ')

  return {
    subject: 'Votre création est conservée — reprenez en 1 clic',
    html: layout({
      title: 'Votre création est conservée',
      preheader: 'Reprenez en 1 clic &mdash; vous validez l&rsquo;aperçu avant toute impression.',
      rows,
    }),
    text: textVersion({ headline, paragraphs, reassurance, resumeUrl: input.resumeUrl }),
  }
}

/** Email « relance J+1 » (création non achetée). fathersDay = libellé daté ou null. */
export function renderReminderEmail(input: {
  resumeUrl: string
  previewUrl: string | null
  playerName: string
  fathersDay: string | null
}): RenderedEmail {
  const p = esc(input.playerName)
  const paragraphs = [
    `Hier, vous avez donné à ${p} son maillot, son prénom et son numéro floqués, et sa place sous les lumières du stade. Le voilà transformé en joueur de légende &mdash; et votre création est toujours là, soigneusement mise de côté, exactement là où vous l&rsquo;avez laissée.`,
    'Imaginez son regard en se découvrant affiché comme une star, fièrement accroché au mur. Rien n&rsquo;est figé : avant toute impression, vous validez l&rsquo;aperçu &mdash; on n&rsquo;imprime que ce que vous aimez vraiment. Votre création reste accessible 30 jours.',
  ]
  const reassurance: ReassureItem[] = [
    { strong: 'Aperçu validé avant impression', rest: 'on valide, on imprime' },
    { strong: 'Rendu mat haute qualité', rest: 'conçu en France &mdash; imprimé en Europe' },
    {
      strong: 'Création gardée 30 jours',
      rest: 'fabrication 3 à 4 jours ouvrés, expédition suivie',
    },
  ]
  const headline = `${p} n&rsquo;attend plus que vous`
  const fathersDayHtml = input.fathersDay
    ? `La fête des pères approche &mdash; c&rsquo;est le ${esc(input.fathersDay)}. Pour offrir ${p} à temps, finalisez votre commande dès maintenant : comptez 3 à 4 jours ouvrés de fabrication, puis l&rsquo;expédition avec suivi.`
    : null

  const rows = [
    eyebrowRow('Reprise en 1 clic'),
    framedPreviewRow({
      previewUrl: input.previewUrl,
      alt: `Aperçu du tableau personnalisé de ${input.playerName}`,
      caption: 'Épreuve d&rsquo;atelier &mdash; non encore imprimée.',
      fallbackTitle: `Le tableau de ${p} vous attend`,
      fallbackSub: 'L&rsquo;aperçu se révèle dès que vous reprenez votre tableau.',
    }),
    h1Row(headline),
    bodyRow(paragraphs),
    intentCtaRow(INTENT_LINE, input.resumeUrl, CTA_LABEL),
    ...(fathersDayHtml ? [fathersDayRow(fathersDayHtml, input.resumeUrl)] : []),
    spacerRow(),
    reassuranceRow(reassurance),
  ].join('\n          ')

  return {
    subject: `Le tableau de ${input.playerName} vous attend`,
    html: layout({
      title: `Le tableau de ${p} vous attend`,
      preheader:
        'Reprenez votre création là où vous l&rsquo;avez laissée &mdash; vous validez l&rsquo;aperçu avant toute impression.',
      rows,
    }),
    text: textVersion({
      headline,
      paragraphs,
      reassurance,
      resumeUrl: input.resumeUrl,
      fathersDayText: fathersDayHtml,
    }),
  }
}

/** Email « aperçus en situation prêts » (mockups rattrapés). */
export function renderMockupsEmail(input: {
  resumeUrl: string
  mockupUrls: string[]
}): RenderedEmail {
  const urls = (input.mockupUrls || []).filter(Boolean)
  const paragraphs = [
    'Voici les aperçus de votre tableau personnalisé mis en situation : votre création, accrochée sur un vrai mur, à sa juste échelle. De quoi voir, enfin, le rendu mat et l&rsquo;effet qu&rsquo;elle aura une fois chez vous &mdash; ou chez la personne à qui vous la destinez.',
    'Il ne vous reste qu&rsquo;un geste : reprendre votre création là où vous l&rsquo;aviez laissée, choisir le format et la finition, puis valider. Nous ne l&rsquo;imprimons qu&rsquo;une fois votre aperçu approuvé.',
  ]
  const reassurance: ReassureItem[] = [
    { strong: '30x40 &amp; 60x80 cm', rest: 'sans cadre ou cadre au choix' },
    { strong: 'Rendu mat, conçu en France', rest: 'imprimé en Europe &mdash; 3 à 4 j ouvrés' },
    { strong: 'Accessible 30 jours', rest: 'votre création reste conservée' },
  ]
  const headline = 'On a imaginé votre création sur un mur.'
  const rows = [
    eyebrowRow('Aperçus prêts'),
    mockupsGridRow({
      url1: urls[0] || null,
      url2: urls[1] || null,
      caption: 'Mises en situation &mdash; rendu mat, à l&rsquo;échelle réelle.',
      fallbackTitle: 'Vos aperçus se préparent',
      fallbackSub: 'Les mises en situation se révèlent dès que vous reprenez votre tableau.',
    }),
    h1Row(headline),
    bodyRow(paragraphs),
    intentCtaRow(INTENT_LINE, input.resumeUrl, CTA_LABEL),
    spacerRow(),
    reassuranceRow(reassurance),
  ].join('\n          ')

  return {
    subject: 'Votre tableau, accroché chez vous',
    html: layout({
      title: 'Votre tableau, accroché chez vous',
      preheader: 'Découvrez vos aperçus en situation &mdash; un clic pour finaliser.',
      rows,
    }),
    text: textVersion({ headline, paragraphs, reassurance, resumeUrl: input.resumeUrl }),
  }
}
