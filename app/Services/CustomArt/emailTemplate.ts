/**
 * Gabarit HTML partagé des emails du studio CustomArt — design « Galerie MyselfMonArt »
 * calé sur les tokens RÉELS du thème live (tw_myselfmonart_shopify_theme) :
 *  - couleurs : encre #21150C, crème #F3E1DA, blush #E9C7BC/#DFAE9D, terracotta #A65437/#6D3724,
 *    et surtout le BOUTON D'ACHAT du site #D79B86 (texte encre) → le CTA email = le bouton du site
 *    (« cliquer = acheter »).
 *  - typographie : titres en pile sans-serif type Harmonia Sans (font-heading du thème), corps Roboto.
 *    Limelight reste un ACCENT (eyebrows/wordmark), comme sur le site — jamais un serif Georgia.
 *    NB email-safe : les webfonts (Harmonia/Limelight) ne se chargent pas partout ; le rendu réel est
 *    la pile de repli (Helvetica/Arial pour les titres) — propre et fidèle à l'esprit du site.
 *  - layout : PLEINE LARGEUR — bandeaux 100% bord-à-bord, contenu centré à 680px (« full-bleed
 *    background, contained content »). AUCUN logo en tête → l'email s'ouvre sur l'ŒUVRE (image d'abord).
 *  - rendu verrouillé en CLAIR (color-scheme: light) : l'email est clair par nature, on neutralise
 *    l'auto-dark-mode des clients qui inverserait partiellement et casserait la lisibilité.
 *
 * Module PUR (aucune dépendance Adonis) : SaveMailer / ReminderMailer / MockupsReadyMailer appellent
 * renderSaveEmail / renderReminderEmail / renderMockupsEmail et envoient le { subject, html, text }
 * via Resend. Un seul endroit pour faire évoluer les 3 emails.
 */

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
    .replace(/&times;/g, '×')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8203;/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

// Typographie email-safe alignée sur le thème : titres = pile humaniste sans-serif (Harmonia Sans
// n'est pas une webfont → repli Helvetica/Arial, même rendu « propre » que le site, PAS de serif) ;
// corps = Roboto ; Limelight = accent display (eyebrow/wordmark), repli sans-serif comme le thème.
const HEADING = "'Harmonia Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
const BODY = "Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif"
const DISPLAY = "'Limelight','Helvetica Neue',Arial,sans-serif"

// Palette de marque (tokens thème live → hex)
const INK = '#21150C' // --color-main : texte, bordures, ombre « neu »
const CREAM = '#F3E1DA' // --color-brand-50 : fond de page + bandeaux
const BLUSH_LT = '#E9C7BC' // --color-brand-100 : passe-partout / blocs doux
const BLUSH = '#DFAE9D' // --color-brand-300 / accent : filets fins
const BUY = '#D79B86' // --color-buy-button / brand-500 : FOND du CTA (bouton d'achat du site)
const TERRA = '#A65437' // --color-brand-700 : eyebrow, liens, accents
const TERRA_DEEP = '#6D3724' // --color-brand-900 : bordures profondes / liens footer
const RUST = '#A93514' // --color-like : alertes (édition fête des pères)
const WHITE = '#FFFFFF'

// Largeur du contenu (le fond des bandeaux reste 100% ; seul le contenu est borné et centré).
const CONTENT_W = 680

// ---------------------------------------------------------------------------
// Briques de shell partagées
// ---------------------------------------------------------------------------

/** Colonne de contenu centrée (max 680px) sur un bandeau pleine largeur. */
function col(innerHtml: string, align: 'left' | 'center', padH = 28): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="width:100%; max-width:${CONTENT_W}px; margin:0 auto;">
                <tr>
                  <td align="${align}" style="padding-left:${padH}px; padding-right:${padH}px;">${innerHtml}</td>
                </tr>
              </table>`
}

function head(titleHtml: string): string {
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${titleHtml}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Limelight&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Limelight&family=Roboto:wght@400;500;700&display=swap');
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
    table { border-collapse:collapse !important; }
    body { margin:0 !important; padding:0 !important; width:100% !important; height:100% !important; background-color:${CREAM}; }
    a { text-decoration:none; }
    @media screen and (max-width:640px) {
      .h1 { font-size:27px !important; line-height:34px !important; }
      .hero-img { max-width:100% !important; }
      .reassure-item { display:block !important; width:100% !important; padding:12px 0 !important; }
      .reassure-sep { display:none !important; }
      .mockup-cell { display:block !important; width:100% !important; padding:0 0 14px 0 !important; }
      .mockup-gap { display:none !important; }
    }
  </style>
</head>`
}

function footerRow(): string {
  const inner = `<p style="margin:0 0 6px 0; font-family:${DISPLAY}; font-size:22px; line-height:26px; letter-spacing:1px; color:${INK};">MyselfMonArt</p>
              <p style="margin:0 0 18px 0; font-family:${HEADING}; font-size:12px; line-height:16px; letter-spacing:2px; text-transform:uppercase; color:${TERRA};">L&rsquo;atelier des tableaux qui vous ressemblent</p>
              <p style="margin:0 0 16px 0; font-family:${BODY}; font-size:13px; line-height:20px; color:${INK};">Une question ? Répondez simplement à cet e-mail, nous sommes là pour vous accompagner.</p>
              <p style="margin:0 0 14px 0; font-family:${BODY}; font-size:12px; line-height:18px; color:${INK};">
                <a href="${STORE_URL}" target="_blank" style="color:${TERRA_DEEP}; text-decoration:underline;">Visiter la boutique</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:${CONTACT_EMAIL}" target="_blank" style="color:${TERRA_DEEP}; text-decoration:underline;">Contacter l&rsquo;atelier</a>
              </p>
              <p style="margin:0; font-family:${BODY}; font-size:12px; line-height:18px; color:${TERRA_DEEP};">Tableaux personnalisés &mdash; conçus en France, imprimés en Europe.</p>`
  return `<tr>
            <td bgcolor="${CREAM}" style="background-color:${CREAM}; padding:36px 0 38px 0;" align="center">
              ${col(inner, 'center')}
            </td>
          </tr>
          <tr>
            <td height="6" bgcolor="${BUY}" style="height:6px; line-height:6px; font-size:1px; mso-line-height-rule:exactly; background-color:${BUY};"><div style="font-size:1px; line-height:1px;">&#8203;</div></td>
          </tr>`
}

function eyebrowRow(text: string): string {
  return `<tr>
            <td align="center" bgcolor="${WHITE}" style="background-color:${WHITE}; padding:30px 0 0 0;">
              ${col(`<p style="margin:0; font-family:${DISPLAY}; font-size:15px; line-height:18px; letter-spacing:3px; text-transform:uppercase; color:${TERRA};">${text}</p>`, 'center')}
            </td>
          </tr>`
}

function h1Row(html: string): string {
  return `<tr>
            <td align="center" bgcolor="${WHITE}" style="background-color:${WHITE}; padding:12px 0 8px 0;">
              ${col(`<h1 class="h1" style="margin:0; font-family:${HEADING}; font-size:32px; line-height:40px; letter-spacing:-0.2px; color:${INK}; font-weight:700;">${html}</h1>`, 'center')}
            </td>
          </tr>`
}

function bodyRow(paragraphsHtml: string[]): string {
  const ps = paragraphsHtml
    .map(
      (p, i) =>
        `<p style="margin:0${i < paragraphsHtml.length - 1 ? ' 0 16px 0' : ''}; font-family:${BODY}; font-size:16px; line-height:27px; color:${INK};">${p}</p>`
    )
    .join('\n                  ')
  return `<tr>
            <td align="center" bgcolor="${WHITE}" style="background-color:${WHITE}; padding:14px 0 0 0;">
              ${col(ps, 'left')}
            </td>
          </tr>`
}

/**
 * CTA = bouton d'achat du site : fond #D79B86, TEXTE ENCRE (#21150C, pas blanc), bordure encre,
 * coins arrondis, ombre « neu » décalée (dégrade en plat sur Outlook/Gmail). Centré de façon
 * robuste (td align=center + table margin auto + VML Outlook, largeur 320px pour tenir les libellés).
 */
function ctaButton(url: string, label: string): string {
  const u = escUrl(url)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${u}" style="height:54px;v-text-anchor:middle;width:320px;" arcsize="20%" strokecolor="${INK}" strokeweight="2px" fillcolor="${BUY}">
                      <w:anchorlock/>
                      <center style="color:${INK};font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;letter-spacing:.2px;">${label}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${u}" target="_blank" style="display:inline-block; padding:16px 40px; border:2px solid ${INK}; border-radius:12px; background-color:${BUY}; color:${INK}; font-family:${HEADING}; font-size:16px; font-weight:700; line-height:18px; letter-spacing:.2px; text-decoration:none; box-shadow:4px 5px 0 ${INK};">${label}</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>`
}

function intentCtaRow(intentHtml: string, url: string, label: string): string {
  const inner = `<p style="margin:0 0 18px 0; font-family:${BODY}; font-size:14px; line-height:22px; color:${TERRA_DEEP};">${intentHtml}</p>
                  ${ctaButton(url, label)}`
  return `<tr>
            <td align="center" bgcolor="${WHITE}" style="background-color:${WHITE}; padding:26px 0 10px 0;">
              ${col(inner, 'center')}
            </td>
          </tr>`
}

function fathersDayRow(lineHtml: string, url: string): string {
  const box = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
                <tr>
                  <td bgcolor="${BLUSH_LT}" style="background-color:${BLUSH_LT}; padding:20px 24px; border:1px solid ${TERRA};">
                    <p style="margin:0 0 6px 0; font-family:${HEADING}; font-size:12px; line-height:16px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:${RUST};">Édition fête des pères</p>
                    <p style="margin:0 0 12px 0; font-family:${BODY}; font-size:14px; line-height:22px; color:${INK};">${lineHtml}</p>
                    <a href="${escUrl(url)}" target="_blank" style="font-family:${HEADING}; font-size:14px; font-weight:700; color:${TERRA_DEEP}; text-decoration:underline;">Composer pour la fête des pères</a>
                  </td>
                </tr>
              </table>`
  return `<tr>
            <td align="center" bgcolor="${WHITE}" style="background-color:${WHITE}; padding:24px 0 0 0;">
              ${col(box, 'center')}
            </td>
          </tr>`
}

function spacerRow(): string {
  return `<tr><td bgcolor="${WHITE}" style="background-color:${WHITE}; height:30px; line-height:30px; font-size:0; mso-line-height-rule:exactly;">&nbsp;</td></tr>`
}

function reassuranceRow(items: ReassureItem[]): string {
  const width = items.length >= 3 ? '33%' : items.length === 2 ? '50%' : '100%'
  const sep = `<td class="reassure-sep" width="1" bgcolor="${BLUSH}" style="width:1px; font-size:1px; line-height:1px; mso-line-height-rule:exactly; background-color:${BLUSH};"><div style="font-size:1px; line-height:1px;">&#8203;</div></td>`
  const cells: string[] = []
  items.forEach((it, i) => {
    if (i > 0) cells.push(sep)
    cells.push(
      `<td class="reassure-item" align="center" valign="top" width="${width}" style="padding:8px 14px;"><p style="margin:0; font-family:${BODY}; font-size:13px; line-height:19px; color:${INK};"><strong style="color:${INK};">${it.strong}</strong><br>${it.rest}</p></td>`
    )
  })
  const grid = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;"><tr>${cells.join('')}</tr></table>`
  return `<tr>
            <td bgcolor="${CREAM}" style="background-color:${CREAM}; padding:22px 0;">
              ${col(grid, 'center', 14)}
            </td>
          </tr>`
}

/** Cartel d'attente (repli sobre quand aucun visuel n'est disponible) — sans cadre simulé. */
function waitingPlate(titleHtml: string, subHtml: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" height="320" style="width:100%;">
                      <tr>
                        <td align="center" valign="middle" height="320" bgcolor="${CREAM}" style="background-color:${CREAM}; padding:44px 24px;">
                          <p style="margin:0 0 8px 0; font-family:${DISPLAY}; font-size:14px; line-height:18px; letter-spacing:3px; text-transform:uppercase; color:${TERRA};">Aperçu</p>
                          <p style="margin:0 0 6px 0; font-family:${HEADING}; font-size:20px; line-height:26px; font-weight:700; color:${INK};">${titleHtml}</p>
                          <p style="margin:0; font-family:${BODY}; font-size:14px; line-height:22px; color:${TERRA_DEEP};">${subHtml}</p>
                        </td>
                      </tr>
                    </table>`
}

function captionP(html: string): string {
  return `<p style="margin:14px 0 0 0; font-family:${BODY}; font-size:13px; line-height:20px; font-style:italic; color:${TERRA_DEEP};">${html}</p>`
}

/** Hero « aperçu unique encadré » — PREMIÈRE section (image d'abord), repli cartel si pas d'image. */
function framedPreviewRow(opts: {
  previewUrl?: string | null
  alt: string
  caption: string
  fallbackTitle: string
  fallbackSub: string
}): string {
  let inner: string
  if (opts.previewUrl) {
    // Image NUE (décision owner) : aucun cadre/passe-partout simulé — l'œuvre se suffit.
    const img = `<img class="hero-img" src="${escUrl(opts.previewUrl)}" alt="${esc(opts.alt)}" width="600" style="display:block; width:100%; max-width:600px; height:auto; margin:0 auto;">`
    inner = img + '\n                  ' + captionP(opts.caption)
  } else {
    inner = waitingPlate(opts.fallbackTitle, opts.fallbackSub)
  }
  return `<tr>
            <td align="center" bgcolor="${WHITE}" style="background-color:${WHITE}; padding:32px 0 6px 0;">
              ${col(inner, 'center', 20)}
            </td>
          </tr>`
}

/** Hero « grille 2 mises en situation » (mockups) — PREMIÈRE section, repli cartel si rien. */
function mockupsGridRow(opts: {
  url1?: string | null
  url2?: string | null
  caption: string
  fallbackTitle: string
  fallbackSub: string
}): string {
  let inner: string
  // Images NUES (décision owner) : pas de cadre/passe-partout simulé autour des mises en situation.
  const cellImg = (url: string, alt: string) =>
    `<img src="${escUrl(url)}" alt="${esc(alt)}" width="300" style="display:block; width:100%; max-width:300px; height:auto; margin:0 auto;">`
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
    inner = grid + '\n                  ' + captionP(opts.caption)
  } else if (opts.url1) {
    inner =
      cellImg(opts.url1, 'Votre tableau personnalisé en situation') +
      '\n                  ' +
      captionP(opts.caption)
  } else {
    inner = waitingPlate(opts.fallbackTitle, opts.fallbackSub)
  }
  return `<tr>
            <td align="center" bgcolor="${WHITE}" style="background-color:${WHITE}; padding:32px 0 6px 0;">
              ${col(inner, 'center', 20)}
            </td>
          </tr>`
}

/**
 * Layout PLEINE LARGEUR : aucun logo en tête, bandeaux 100% bord-à-bord (plus de marges crème),
 * contenu centré à 680px. L'email commence directement par l'œuvre.
 */
function layout(opts: {
  title: string
  preheader: string
  rows: string
  /** Langue du document — les mails historiques sont en français, d'où le défaut. */
  lang?: string
}): string {
  return `<!DOCTYPE html>
<html lang="${opts.lang || 'fr'}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
${head(opts.title)}
<body style="margin:0; padding:0; width:100%; background-color:${WHITE};">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${WHITE};">
    ${opts.preheader}
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:${WHITE};">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-container" bgcolor="${WHITE}" style="width:100%; max-width:100%; background-color:${WHITE};">
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

function textVersion(opts: {
  headline: string
  paragraphs: string[]
  reassurance: ReassureItem[]
  resumeUrl: string
  ctaLabel: string
  fathersDayText?: string | null
}): string {
  const lines = [
    toText(opts.headline),
    '',
    ...opts.paragraphs.map(toText),
    '',
    ...(opts.fathersDayText ? [toText(opts.fathersDayText), ''] : []),
    `${toText(opts.ctaLabel)} : ${opts.resumeUrl}`,
    '',
    ...opts.reassurance.map((r) => `• ${toText(r.strong)} — ${toText(r.rest)}`),
    '',
    'Une question ? Répondez simplement à cet e-mail.',
    'L’atelier MyselfMonArt',
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
    'Tout est gardé intact : le prénom et le numéro floqués, le maillot aux couleurs du club, la lumière du stade. Votre création est précieusement conservée dans notre atelier, prête à reprendre vie dès que le moment vous semblera juste.',
    'Rien n&rsquo;est imprimé à ce stade : l&rsquo;aperçu se valide toujours avant l&rsquo;impression, jamais l&rsquo;inverse. Prenez le temps qu&rsquo;il faut &mdash; votre œuvre reste accessible 30 jours.',
  ]
  const reassurance: ReassureItem[] = [
    { strong: 'Aperçu avant impression', rest: 'vous validez, puis nous imprimons' },
    { strong: 'Conservée 30 jours', rest: 'vous reprenez quand vous voulez' },
    { strong: 'Conçu en France', rest: 'imprimé en Europe &mdash; rendu mat' },
  ]
  const headline = 'Votre petite légende, mise à l&rsquo;abri'
  const ctaLabel = 'Reprendre ma création'
  const rows = [
    framedPreviewRow({
      previewUrl: input.previewUrl,
      alt: 'Aperçu de votre tableau personnalisé',
      caption: 'Épreuve d&rsquo;atelier &mdash; non encore imprimée.',
      fallbackTitle: 'Votre création est conservée',
      fallbackSub: 'L&rsquo;aperçu se révèle dès que vous reprenez votre tableau.',
    }),
    eyebrowRow('Œuvre en atelier'),
    h1Row(headline),
    bodyRow(paragraphs),
    intentCtaRow(INTENT_LINE, input.resumeUrl, ctaLabel),
    spacerRow(),
    reassuranceRow(reassurance),
  ].join('\n          ')

  return {
    subject: 'Votre création est conservée à l’atelier',
    html: layout({
      title: 'Votre création est conservée',
      preheader:
        'Rien n&rsquo;est perdu &mdash; vous validez l&rsquo;aperçu avant toute impression.',
      rows,
    }),
    text: textVersion({ headline, paragraphs, reassurance, resumeUrl: input.resumeUrl, ctaLabel }),
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
    `Hier, vous avez donné à ${p} son maillot, son prénom et son numéro floqués, et sa place sous les projecteurs. Imaginez son émerveillement en se découvrant en véritable légende &mdash; et la fierté que vous aurez à l&rsquo;accrocher au mur.`,
    `Sa création est toujours là, soigneusement mise de côté dans notre atelier, exactement où vous l&rsquo;avez laissée. Avant toute impression, vous validez l&rsquo;aperçu &mdash; on n&rsquo;imprime que ce que vous aimez vraiment. Accessible encore 30 jours.`,
  ]
  const reassurance: ReassureItem[] = [
    { strong: 'Aperçu validé avant impression', rest: 'on valide, on imprime' },
    { strong: 'Conservée 30 jours', rest: 'reprise en un clic' },
    { strong: 'Fabrication 3 à 4 jours', rest: 'ouvrés &mdash; conçu en France' },
  ]
  const headline = `${p} entre dans la légende`
  const ctaLabel = 'Revoir l&rsquo;œuvre'
  const fathersDayHtml = input.fathersDay
    ? `La fête des pères approche &mdash; c&rsquo;est le ${esc(input.fathersDay)}. Pour offrir son tableau à temps, finalisez votre commande dès maintenant : comptez 3 à 4 jours ouvrés de fabrication, puis l&rsquo;expédition avec suivi.`
    : null

  const rows = [
    framedPreviewRow({
      previewUrl: input.previewUrl,
      alt: `Aperçu du tableau personnalisé de ${input.playerName}`,
      caption: 'Épreuve d&rsquo;atelier &mdash; non encore imprimée.',
      fallbackTitle: `Le tableau de ${p} vous attend`,
      fallbackSub: 'L&rsquo;aperçu se révèle dès que vous reprenez votre tableau.',
    }),
    eyebrowRow('Votre légende vous attend'),
    h1Row(headline),
    bodyRow(paragraphs),
    intentCtaRow(INTENT_LINE, input.resumeUrl, ctaLabel),
    ...(fathersDayHtml ? [fathersDayRow(fathersDayHtml, input.resumeUrl)] : []),
    spacerRow(),
    reassuranceRow(reassurance),
  ].join('\n          ')

  return {
    subject: `La légende de ${input.playerName} vous attend à l’atelier`,
    html: layout({
      title: `Le tableau de ${p} vous attend`,
      preheader:
        'Sa place sous les lumières du stade est gardée &mdash; reprise en 1 clic, aperçu validé avant impression.',
      rows,
    }),
    text: textVersion({
      headline,
      paragraphs,
      reassurance,
      resumeUrl: input.resumeUrl,
      ctaLabel,
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
    'Voici votre petite légende mise en situation : la création accrochée sur un vrai mur, à sa juste échelle. Le rendu mat et les formats 30×40 ou 60×80&nbsp;cm prennent alors tout leur sens &mdash; de quoi ressentir dès maintenant la fierté qu&rsquo;elle inspirera, chez vous ou chez la personne à qui vous la destinez.',
    'Il ne reste qu&rsquo;un geste : reprendre votre création, choisir le format et la finition &mdash; sans cadre ou cadre au choix &mdash; puis valider. Nous ne l&rsquo;imprimons qu&rsquo;une fois votre aperçu approuvé, jamais avant.',
  ]
  const reassurance: ReassureItem[] = [
    { strong: '30×40 &amp; 60×80 cm', rest: 'sans cadre ou cadre au choix' },
    { strong: 'Rendu mat, conçu en France', rest: 'imprimé en Europe &mdash; 3 à 4 j ouvrés' },
    { strong: 'Accessible 30 jours', rest: 'votre création reste conservée' },
  ]
  const headline = 'On l&rsquo;a imaginé sur votre mur'
  const ctaLabel = 'Choisir format et finition'
  const rows = [
    mockupsGridRow({
      url1: urls[0] || null,
      url2: urls[1] || null,
      caption: 'Mises en situation &mdash; rendu mat, à l&rsquo;échelle réelle.',
      fallbackTitle: 'Vos aperçus se préparent',
      fallbackSub: 'Les mises en situation se révèlent dès que vous reprenez votre tableau.',
    }),
    eyebrowRow('Aperçus en situation prêts'),
    h1Row(headline),
    bodyRow(paragraphs),
    intentCtaRow(INTENT_LINE, input.resumeUrl, ctaLabel),
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
    text: textVersion({ headline, paragraphs, reassurance, resumeUrl: input.resumeUrl, ctaLabel }),
  }
}

/* ==========================================================================================
 * Email « votre création est prête » — 5 langues.
 *
 * POURQUOI : le studio cesse d'attendre au bout de 3 minutes (POLL_TIMEOUT du thème) alors que
 * la génération, elle, va au bout. La cliente voyait un échec et perdait sa création si elle
 * n'avait pas laissé d'adresse. Elle peut désormais demander à être prévenue : c'est CET email
 * qui arrive quand le rendu est prêt, avec le lien de reprise du studio.
 *
 * Les autres emails custom-art sont français-only (historique). Celui-ci part dans la langue où
 * la cliente a créé : un mail dans une langue qu'elle ne lit pas est un mail perdu, et c'est
 * justement le seul lien qui lui reste vers sa création.
 * ========================================================================================== */

export type CustomArtLocale = 'fr' | 'en' | 'de' | 'nl' | 'es'

const READY_LOCALES: CustomArtLocale[] = ['fr', 'en', 'de', 'nl', 'es']

/** Normalise un code langue quelconque ('EN-gb', 'de_DE'…) vers une locale supportée. */
export function normalizeCustomArtLocale(raw: unknown): CustomArtLocale {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
    .slice(0, 2)
  return (READY_LOCALES as string[]).includes(v) ? (v as CustomArtLocale) : 'fr'
}

interface ReadyStrings {
  subject: string
  title: string
  preheader: string
  eyebrow: string
  headline: string
  paragraphs: string[]
  cta: string
  intent: string
  caption: string
  alt: string
  fallbackTitle: string
  fallbackSub: string
  reassurance: ReassureItem[]
}

const READY_TEXTS: Record<CustomArtLocale, ReadyStrings> = {
  fr: {
    subject: 'Votre création est prête',
    title: 'Votre création est prête',
    preheader: 'Elle vous attend &mdash; rien n&rsquo;est imprimé avant votre validation.',
    eyebrow: 'Sortie d&rsquo;atelier',
    headline: 'Elle est prête, et elle vous ressemble',
    paragraphs: [
      'Votre création a demandé un peu plus de temps que prévu &mdash; la voici. Elle est née de votre photo, redessinée dans notre atelier, et elle n&rsquo;existe qu&rsquo;en un seul exemplaire : le vôtre.',
      'Reprenez-la quand vous voulez : un clic sur le bouton et elle se rouvre là où vous l&rsquo;aviez laissée. Rien n&rsquo;est imprimé tant que vous n&rsquo;avez pas validé.',
    ],
    cta: 'Découvrir ma création',
    intent: 'Un clic, vous validez l&rsquo;aperçu &mdash; on n&rsquo;imprime qu&rsquo;ensuite.',
    caption: 'Épreuve d&rsquo;atelier &mdash; non encore imprimée.',
    alt: 'Aperçu de votre création personnalisée',
    fallbackTitle: 'Votre création vous attend',
    fallbackSub: 'L&rsquo;aperçu se révèle dès que vous la rouvrez.',
    reassurance: [
      { strong: 'Aperçu avant impression', rest: 'vous validez, puis nous imprimons' },
      { strong: 'Conservée 30 jours', rest: 'vous reprenez quand vous voulez' },
      { strong: 'Conçu en France', rest: 'imprimé en Europe &mdash; rendu mat' },
    ],
  },
  en: {
    subject: 'Your creation is ready',
    title: 'Your creation is ready',
    preheader: 'It is waiting for you &mdash; nothing is printed before you approve it.',
    eyebrow: 'Out of the studio',
    headline: 'It is ready, and it looks like you',
    paragraphs: [
      'Your creation took a little longer than expected &mdash; here it is. It was drawn from your own photo in our studio, and it exists in one copy only: yours.',
      'Pick it up whenever you like: one click on the button and it opens again exactly where you left it. Nothing is printed until you approve it.',
    ],
    cta: 'See my creation',
    intent: 'One click and you approve the proof &mdash; we print only afterwards.',
    caption: 'Studio proof &mdash; not printed yet.',
    alt: 'Preview of your personalised creation',
    fallbackTitle: 'Your creation is waiting',
    fallbackSub: 'The preview appears as soon as you open it again.',
    reassurance: [
      { strong: 'Proof before printing', rest: 'you approve, then we print' },
      { strong: 'Kept for 30 days', rest: 'come back whenever you want' },
      { strong: 'Designed in France', rest: 'printed in Europe &mdash; matte finish' },
    ],
  },
  de: {
    subject: 'Ihre Kreation ist fertig',
    title: 'Ihre Kreation ist fertig',
    preheader: 'Sie wartet auf Sie &mdash; gedruckt wird erst nach Ihrer Freigabe.',
    eyebrow: 'Frisch aus dem Atelier',
    headline: 'Sie ist fertig &mdash; und sie sieht Ihnen ähnlich',
    paragraphs: [
      'Ihre Kreation hat etwas länger gedauert als gedacht &mdash; hier ist sie. Sie ist aus Ihrem eigenen Foto entstanden, in unserem Atelier neu gezeichnet, und es gibt sie nur ein einziges Mal: für Sie.',
      'Nehmen Sie sie wieder auf, wann Sie möchten: ein Klick auf den Button und sie öffnet sich genau dort, wo Sie aufgehört haben. Gedruckt wird nichts, solange Sie nicht freigegeben haben.',
    ],
    cta: 'Meine Kreation ansehen',
    intent: 'Ein Klick, Sie geben die Vorschau frei &mdash; erst danach wird gedruckt.',
    caption: 'Atelierabzug &mdash; noch nicht gedruckt.',
    alt: 'Vorschau Ihrer personalisierten Kreation',
    fallbackTitle: 'Ihre Kreation wartet',
    fallbackSub: 'Die Vorschau erscheint, sobald Sie sie wieder öffnen.',
    reassurance: [
      { strong: 'Vorschau vor dem Druck', rest: 'Sie geben frei, dann drucken wir' },
      { strong: '30 Tage aufbewahrt', rest: 'kommen Sie zurück, wann Sie wollen' },
      { strong: 'Entworfen in Frankreich', rest: 'gedruckt in Europa &mdash; matt' },
    ],
  },
  nl: {
    subject: 'Je creatie is klaar',
    title: 'Je creatie is klaar',
    preheader: 'Ze wacht op je &mdash; er wordt niets gedrukt voordat jij akkoord gaat.',
    eyebrow: 'Vers uit het atelier',
    headline: 'Ze is klaar, en ze lijkt op jou',
    paragraphs: [
      'Je creatie had iets meer tijd nodig dan verwacht &mdash; hier is ze. Ze is ontstaan uit je eigen foto, opnieuw getekend in ons atelier, en ze bestaat maar één keer: voor jou.',
      'Pak haar op wanneer je wilt: één klik op de knop en ze opent precies waar je gebleven was. Er wordt niets gedrukt zolang jij niet akkoord gaat.',
    ],
    cta: 'Mijn creatie bekijken',
    intent: 'Eén klik en je keurt het voorbeeld goed &mdash; pas daarna drukken we.',
    caption: 'Atelierproef &mdash; nog niet gedrukt.',
    alt: 'Voorbeeld van je gepersonaliseerde creatie',
    fallbackTitle: 'Je creatie wacht op je',
    fallbackSub: 'Het voorbeeld verschijnt zodra je haar weer opent.',
    reassurance: [
      { strong: 'Voorbeeld vóór het drukken', rest: 'jij keurt goed, dan drukken wij' },
      { strong: '30 dagen bewaard', rest: 'kom terug wanneer je wilt' },
      { strong: 'Ontworpen in Frankrijk', rest: 'gedrukt in Europa &mdash; mat' },
    ],
  },
  es: {
    subject: 'Tu creación está lista',
    title: 'Tu creación está lista',
    preheader: 'Te está esperando &mdash; no se imprime nada antes de que lo apruebes.',
    eyebrow: 'Recién salida del taller',
    headline: 'Ya está lista, y se parece a ti',
    paragraphs: [
      'Tu creación ha tardado un poco más de lo previsto &mdash; aquí la tienes. Ha nacido de tu propia foto, redibujada en nuestro taller, y existe en un solo ejemplar: el tuyo.',
      'Retómala cuando quieras: un clic en el botón y se vuelve a abrir justo donde la dejaste. No se imprime nada mientras no lo apruebes.',
    ],
    cta: 'Ver mi creación',
    intent: 'Un clic y apruebas la vista previa &mdash; solo después imprimimos.',
    caption: 'Prueba de taller &mdash; aún sin imprimir.',
    alt: 'Vista previa de tu creación personalizada',
    fallbackTitle: 'Tu creación te espera',
    fallbackSub: 'La vista previa aparece en cuanto la vuelvas a abrir.',
    reassurance: [
      { strong: 'Vista previa antes de imprimir', rest: 'tú apruebas y luego imprimimos' },
      { strong: 'Guardada 30 días', rest: 'vuelve cuando quieras' },
      { strong: 'Diseñado en Francia', rest: 'impreso en Europa &mdash; acabado mate' },
    ],
  },
}

/** Email « votre création est prête », dans la langue où la cliente a créé. */
export function renderReadyEmail(input: {
  locale: CustomArtLocale
  resumeUrl: string
  previewUrl: string | null
}): RenderedEmail {
  const t = READY_TEXTS[input.locale] || READY_TEXTS.fr
  const rows = [
    framedPreviewRow({
      previewUrl: input.previewUrl,
      alt: t.alt,
      caption: t.caption,
      fallbackTitle: t.fallbackTitle,
      fallbackSub: t.fallbackSub,
    }),
    eyebrowRow(t.eyebrow),
    h1Row(t.headline),
    bodyRow(t.paragraphs),
    intentCtaRow(t.intent, input.resumeUrl, t.cta),
    spacerRow(),
    reassuranceRow(t.reassurance),
  ].join('\n          ')

  return {
    subject: t.subject,
    html: layout({ title: t.title, preheader: t.preheader, rows, lang: input.locale }),
    text: textVersion({
      headline: t.headline,
      paragraphs: t.paragraphs,
      reassurance: t.reassurance,
      resumeUrl: input.resumeUrl,
      ctaLabel: t.cta,
    }),
  }
}
