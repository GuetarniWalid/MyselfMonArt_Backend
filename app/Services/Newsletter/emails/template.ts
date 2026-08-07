import { pack } from './strings'
import { DARK_MODE_CSS } from './darkMode'
import { formatAnnouncedDate, intlTag } from '../expiry'
import { moneyLabel } from '../currency'
import { redirectPathFrom } from '../sourceUrl'
import type { Bullet } from './strings'
import type { VoucherCurrency } from '../currency'
import type { NewsletterLocale } from '../config'

/**
 * LES TROIS GABARITS VALIDÉS PAR LE DESIGNER, portés en TypeScript.
 *
 * Le balisage vient de `emails/mail-1-votre-bon.html`, `mail-2-choisir.html` et
 * `mail-3-derniere-chance.html` du projet Claude Design « Popup bon 15 euros » : tables
 * imbriquées, styles en ligne, testé Outlook, aucune hauteur fixe. Il est recopié tel quel ;
 * seules les valeurs d'exemple deviennent des variables. Le mode sombre vit dans `darkMode.ts`.
 *
 * ⛔ AUCUN PIXEL DE SUIVI D'OUVERTURE. La seule balise `<img>` de ces e-mails est l'œuvre du
 * bloc produit. On pilote au clic — c'est la recommandation CNIL, et un pixel invisible est
 * exactement le genre de chose qu'on ajoute « pour voir » et qu'on ne retire jamais.
 *
 * ⛔ UNE SEULE ADRESSE POSTALE PAR E-MAIL, celle du pied de page. Elle est obligatoire
 * (CAN-SPAM aux États-Unis, CASL au Canada) ; en afficher deux serait pire que zéro, parce que
 * ça donne l'air d'un message assemblé par une machine mal réglée.
 *
 * ⛔ TOUS LES MONTANTS SONT DES VARIABLES, y compris dans les blocs produit. Les gabarits
 * portaient « 129 € — soit 114 € », « 89 € », « 95 € », « 150 € » : ce sont des exemples. Un
 * client facturé en dollars qui lit un montant en euros reçoit une annonce fausse.
 */

const CONTENT_W = 600

/** Une œuvre affichée dans un e-mail. */
export interface RenderProduct {
  title: string
  /** Ligne de détail sous le titre (« Toile 285 g, 60 × 90 cm, cadre chêne clair »). */
  subtitle?: string
  imageUrl: string
  /** Prix mis en forme dans la devise de l'acheteur : « 129,00 € », « 149.00 $ ». */
  price: string
  /** Le même, bon déduit. */
  priceWithVoucher: string
  /**
   * Le prix en NOMBRE, dans la devise d'affichage. Sert à la règle du designer : la ligne de
   * prix ne s'affiche que si elle atteint le seuil du bon — en dessous, le bon ne s'applique
   * pas au format montré et l'e-mail affirmerait le contraire.
   */
  priceAmount: number
  url: string
}

export interface RenderInput {
  emailNo: 1 | 2 | 3
  locale: NewsletterLocale
  code: string
  /**
   * Date ANNONCÉE du bon, `YYYY-MM-DD`.
   *
   * ⛔ Une DATE, jamais un instant, et affichée SANS HEURE. « 23 h 59 » ne serait vrai qu'à
   * Paris : le bon est ouvert aux États-Unis, au Canada, à la Suisse et au Royaume-Uni. Le code
   * s'arrête d'ailleurs plus tard que cette date (le lendemain 11:59:59 UTC) précisément pour
   * que la promesse tienne partout — cf. `expiry.ts`.
   */
  announcedDate: string
  /** Instant de l'inscription, en secondes epoch — pour le rappel du contexte de collecte. */
  signupTs: number
  /**
   * Ce que le client a vu promis, DANS SA DEVISE : 15 € / 15 $ / 20 $ CA / 14 CHF / 13 £.
   *
   * ⛔ Ce n'est PAS le montant posé sur le code (celui-là est en euros, calibré au taux du jour
   * pour tomber sur cette cible ronde). L'e-mail annonce ce qui a été promis à l'inscription,
   * jamais un montant recalculé : E3 part six jours plus tard, à un autre taux.
   */
  amount: number
  threshold: number
  currency: VoucherCurrency
  storeUrl: string
  unsubscribeUrl: string
  contactEmail: string
  /**
   * Note et nombre d'avis Trustpilot. ⛔ Valeurs RÉELLES du thème, jamais majorées : une note
   * gonflée est une pratique commerciale trompeuse, et le lecteur vérifie en trois secondes.
   */
  trustpilotScore?: number
  trustpilotCount?: number
  /**
   * L'œuvre regardée au moment de l'inscription, déduite de `source_url`. Bloc OPTIONNEL :
   * `undefined` quand l'inscription ne vient pas d'une fiche produit, ou quand la fiche n'est
   * plus publiée — le bloc disparaît alors ENTIÈREMENT. Jamais de moitié de bloc.
   *
   * ⛔ SA PRÉSENCE COMMANDE AUSSI LA DESTINATION DU BOUTON : il ne mène à la fiche que si le
   * bloc est là. Résolu à l'envoi, `product` est la PREUVE que la page existe encore — c'est
   * ce qui protège le 3ᵉ e-mail, parti sept jours après l'inscription.
   */
  product?: RenderProduct
  /**
   * La page d'où venait l'inscription — `location.href` transmis par le thème.
   *
   * ⛔ DONNÉE SOUMISE PAR LE NAVIGATEUR, non fiable, et le seul usage autorisé est de la
   * passer à `redirectPathFrom` (cf. `sourceUrl.ts`), qui refuse tout ce qui ne mène pas chez
   * nous. Elle n'est jamais écrite telle quelle dans l'e-mail.
   */
  sourceUrl?: string | null
  /**
   * Mail 2 : « les plus choisies cette semaine ». Il en faut DEUX — une seule déséquilibrerait
   * la mise en page du designer, zéro ne se remarque pas. Moins de deux = bloc supprimé.
   */
  bestSellers?: RenderProduct[]
  /**
   * Mail 3 : panier à partir duquel la promotion automatique bat le bon, DANS LA DEVISE DU
   * LECTEUR. `null`/absent = aucune promotion active, le paragraphe d'honnêteté disparaît.
   *
   * ⛔ Ce nombre se CALCULE (montant du bon ÷ taux de la promotion), il ne se convertit pas —
   * cf. `BetterDeal.ts`.
   */
  betterDealAmount?: number | null
  /**
   * Mention postale de l'expéditeur, en pied d'e-mail.
   *
   * ⛔ OBLIGATOIRE, et plus une option : le CAN-SPAM américain et la CASL canadienne l'exigent
   * dans chaque message commercial, et la séquence sert désormais ces deux marchés. Vide, la
   * ligne disparaît — ce qui ne doit arriver qu'en test.
   */
  postalAddress?: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

// --- Utilitaires ---------------------------------------------------------------------------

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escUrl(u: string): string {
  return String(u ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
}

/**
 * Préfixe de langue de la boutique.
 *
 * ⛔ Un lien SANS préfixe renvoie un Néerlandais sur une page française. Le français est la
 * langue source du site : il n'a pas de préfixe, les quatre autres en ont un.
 */
export function localePath(locale: NewsletterLocale): string {
  return locale === 'fr' ? '' : `/${locale}`
}

/** Date courte « 6 août » / « 6. August » pour la ligne de contexte de collecte. */
function shortDate(ts: number, locale: NewsletterLocale): string {
  try {
    return new Intl.DateTimeFormat(intlTag(locale), {
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Paris',
    }).format(new Date(ts * 1000))
  } catch {
    return new Date(ts * 1000).toISOString().slice(0, 10)
  }
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : whole
  )
}

/** Une puce ou un encart : partie en gras, puis la suite. */
function bullet(b: Bullet, values: Record<string, string>): string {
  return `<strong>${esc(fill(b.strong, values))}</strong>${esc(fill(b.rest, values))}`
}

function bulletText(b: Bullet, values: Record<string, string>): string {
  return `${fill(b.strong, values)}${fill(b.rest, values)}`
}

// --- Fragments partagés --------------------------------------------------------------------

const BASE_CSS = `  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
  a{color:#a65437}`

/** Media queries propres à chaque e-mail — celles du designer, inchangées. */
const RESPONSIVE_CSS: Record<1 | 2 | 3, string> = {
  1: `  @media only screen and (max-width:620px){
    .wrap{width:100% !important}
    .px{padding-left:20px !important;padding-right:20px !important}
    .amount{font-size:46px !important;line-height:46px !important}
    .h2{font-size:20px !important;line-height:27px !important}
    .code{font-size:22px !important;letter-spacing:1px !important}
  }`,
  2: `  @media only screen and (max-width:620px){
    .wrap{width:100% !important}
    .px{padding-left:20px !important;padding-right:20px !important}
    .h1{font-size:25px !important;line-height:32px !important}
    .strip{font-size:12px !important;letter-spacing:0.5px !important;display:block !important;width:100% !important;padding-bottom:6px !important}
    .stripcode{display:block !important;width:100% !important;text-align:left !important}
  }`,
  3: `  @media only screen and (max-width:620px){
    .wrap{width:100% !important}
    .px{padding-left:20px !important;padding-right:20px !important}
    .h1{font-size:29px !important;line-height:37px !important}
    .code{font-size:22px !important;letter-spacing:1px !important}
  }`,
}

/** Caractères invisibles qui empêchent le client de messagerie de rogner le préheader. */
const PREHEADER_PAD =
  '&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;'

const HIDDEN =
  'display:none;font-size:1px;color:#efece8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;'

function head(emailNo: 1 | 2 | 3, locale: NewsletterLocale, docTitle: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${locale}">
<head>
<meta charset="utf-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${esc(docTitle)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style type="text/css">
${BASE_CSS}
${RESPONSIVE_CSS[emailNo]}

${DARK_MODE_CSS}
</style>
</head>`
}

function openBody(preheader: string, logoUrl: string): string {
  return `<body class="bg" style="margin:0;padding:0;width:100%;background-color:#efece8;">
<span style="${HIDDEN}">${esc(preheader)}</span>
<span style="${HIDDEN}">${PREHEADER_PAD}</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="bg" style="background-color:#efece8;">
<tr><td align="center" style="padding:0 10px;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${CONTENT_W}" class="wrap" style="width:${CONTENT_W}px;max-width:${CONTENT_W}px;">

    <tr><td align="center" class="px logo" style="padding:26px 30px 18px;font-family:Georgia,'Times New Roman',Times,serif;font-size:15px;line-height:20px;letter-spacing:3px;color:#21150c;text-transform:uppercase;mso-line-height-rule:exactly;">
      <a href="${escUrl(logoUrl)}" style="color:#21150c;text-decoration:none;">MyselfMonArt</a>
    </td></tr>`
}

const CLOSE_BODY = `
  </table>

</td></tr>
</table>
</body>
</html>`

/** Bouton d'appel à l'action. `dark` = fond encre (mails 1 et 2), sinon blush (mail 3). */
function ctaButton(url: string, label: string, dark: boolean): string {
  const bg = dark ? '#21150c' : '#d79b86'
  const fg = dark ? '#ffffff' : '#21150c'
  const cls = dark ? 'btn' : 'btnLight'
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;">
            <tr><td align="center" class="${cls}" bgcolor="${bg}" style="background-color:${bg};border-radius:12px;mso-padding-alt:16px 24px;">
              <a href="${escUrl(url)}" style="display:block;padding:16px 24px;font-family:Georgia,'Times New Roman',Times,serif;font-size:18px;line-height:26px;font-weight:bold;color:${fg};text-decoration:none;border-radius:12px;mso-line-height-rule:exactly;">${esc(label)}</a>
            </td></tr>
          </table>`
}

/** L'image d'une œuvre. Toujours une vraie image : jamais le cadre pointillé du gabarit. */
function productImage(product: RenderProduct): string {
  return `<img src="${escUrl(product.imageUrl)}" width="538" alt="${esc(product.title)}" style="display:block;width:100%;max-width:538px;height:auto;border-radius:12px;" />`
}

/**
 * La ligne de prix — VIDE quand l'œuvre est sous le seuil du bon.
 *
 * Règle du designer, et elle a une raison : sous le seuil, le bon ne s'applique pas au format
 * montré. Afficher « soit X avec votre bon » y serait une promesse que le paiement contredit.
 */
function productPriceLine(
  product: RenderProduct,
  thresholdAmount: number,
  priceTemplate: string,
  values: Record<string, string>
): string {
  if (!(product.priceAmount >= thresholdAmount)) return ''
  return fill(priceTemplate, {
    ...values,
    price: product.price,
    priceWithVoucher: product.priceWithVoucher,
  })
}

/** La note Trustpilot avec le séparateur décimal de la langue : « 4,2 » en fr, « 4.2 » en en. */
function formatScore(score: number | undefined, locale: NewsletterLocale): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) return ''
  try {
    return new Intl.NumberFormat(intlTag(locale), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(score)
  } catch {
    return String(score)
  }
}

// --- Le rendu ------------------------------------------------------------------------------

export function renderNewsletterEmail(input: RenderInput): RenderedEmail {
  const strings = pack(input.locale)
  const prefix = localePath(input.locale)
  const store = String(input.storeUrl).replace(/\/+$/, '')

  /**
   * Lien qui APPLIQUE la remise puis mène quelque part.
   *
   * ⚠️ Le chemin de redirection porte le préfixe de langue ou de marché : sans lui, un
   * Néerlandais qui clique atterrit sur la version française du site, son bon appliqué mais la
   * mauvaise langue — et c'est le moment précis où il referme l'e-mail.
   *
   * ⛔ LES DEUX VALEURS SONT ENCODÉES. Le code finit dans un chemin d'URL, le chemin de retour
   * dans une chaîne de requête : non encodé, un `?variant=…` resté dans le chemin couperait la
   * valeur en deux et Shopify ne lirait qu'un morceau. Un lien de remise qui échoue est
   * invisible depuis ici — c'est le client qui le découvre.
   */
  const applyUrl = (path: string) =>
    `${store}/discount/${encodeURIComponent(input.code)}?redirect=${encodeURIComponent(path)}`

  /**
   * OÙ MÈNE LE BOUTON — LA MÊME DESTINATION DANS LES TROIS E-MAILS.
   *
   * La fiche que la personne regardait quand elle a demandé son bon, plutôt que le catalogue
   * entier : le bloc « vous regardiez » prouve qu'on la connaît, l'envoyer chercher dans huit
   * cents œuvres ce qu'elle avait sous les yeux est une marche pour rien.
   *
   * ⛔ CONDITIONNÉ À `input.product`, ET C'EST TOUT L'INTÉRÊT. `product` n'existe que si la
   * fiche a répondu À L'INSTANT DE L'ENVOI. E3 part sept jours après l'inscription : une œuvre
   * dépubliée entre-temps fait disparaître le bloc ET ramène le bouton au catalogue, d'un seul
   * geste. Jamais de bouton vers un 404 — c'est le pire endroit possible pour en trouver un.
   *
   * Calculé UNE FOIS, ici, et non dans chacun des trois constructeurs : trois copies finissent
   * toujours par diverger, et celle qu'on oublierait de corriger serait invisible.
   */
  const ctaUrl = applyUrl(
    (input.product ? redirectPathFrom(input.sourceUrl) : null) ?? `${prefix}/collections/all`
  )

  const values: Record<string, string> = {
    code: input.code,
    date: formatAnnouncedDate(input.announcedDate, input.locale),
    amount: moneyLabel(input.amount, input.currency, input.locale),
    min: moneyLabel(input.threshold, input.currency, input.locale),
    signupDate: shortDate(input.signupTs, input.locale),
    contact: input.contactEmail,
    betterDeal:
      typeof input.betterDealAmount === 'number'
        ? moneyLabel(input.betterDealAmount, input.currency, input.locale)
        : '',
    score: formatScore(input.trustpilotScore, input.locale),
    count: String(input.trustpilotCount ?? ''),
  }

  const ctx: Ctx = {
    input,
    values,
    ctaUrl,
    store,
    prefix,
    footerHtml: renderFooter(input, strings.footer, values, store, prefix),
    footerText: renderFooterText(input, strings.footer, values),
  }

  if (input.emailNo === 1) return mail1(ctx)
  if (input.emailNo === 2) return mail2(ctx)
  return mail3(ctx)
}

/** Ce que les trois constructeurs se partagent, pour ne pas repasser huit arguments. */
interface Ctx {
  input: RenderInput
  values: Record<string, string>
  /** Le lien du bouton, déjà résolu — cf. `renderNewsletterEmail`. Les trois mails le partagent. */
  ctaUrl: string
  store: string
  prefix: string
  footerHtml: string
  footerText: string
}

// --- Pied de page (commun aux trois) ---------------------------------------------------------

function renderFooter(
  input: RenderInput,
  footer: ReturnType<typeof pack>['footer'],
  values: Record<string, string>,
  store: string,
  prefix: string
): string {
  // Le mot de la fin n'existe que sur le mail 3, et il ouvre le pied plutôt que le corps.
  const lastWord =
    input.emailNo === 3 ? `${esc(fill(pack(input.locale).mail3.lastWord, values))}<br /><br />` : ''

  // Vide en test seulement : en production l'adresse est obligatoire (CAN-SPAM / CASL).
  const postal = input.postalAddress ? `${esc(input.postalAddress)}<br />` : ''

  return `
    <tr><td class="px foot" align="center" style="padding:24px 30px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;line-height:20px;color:#574a41;mso-line-height-rule:exactly;">
      ${lastWord}${esc(fill(footer.context, values))}<br />
      <a href="${escUrl(`${store}${prefix}/policies/privacy-policy`)}" style="color:#4a3f37;text-decoration:underline;">${esc(footer.privacy)}</a>
      &nbsp;&#183;&nbsp;
      <a href="${escUrl(input.unsubscribeUrl)}" style="color:#4a3f37;font-weight:bold;text-decoration:underline;">${esc(footer.unsubscribe)}</a>
      <br /><br />
      ${esc(footer.tagline)}<br />
      ${postal}<a href="${escUrl(`${store}${prefix}/policies/legal-notice`)}" style="color:#4a3f37;text-decoration:underline;">${esc(footer.legal)}</a><br />
      ${esc(fill(footer.reply, values))}
    </td></tr>`
}

function renderFooterText(
  input: RenderInput,
  footer: ReturnType<typeof pack>['footer'],
  values: Record<string, string>
): string {
  return [
    '---',
    ...(input.emailNo === 3 ? [fill(pack(input.locale).mail3.lastWord, values), ''] : []),
    fill(footer.context, values),
    footer.tagline,
    ...(input.postalAddress ? [input.postalAddress] : []),
    fill(footer.reply, values),
    `${footer.unsubscribe} : ${input.unsubscribeUrl}`,
  ].join('\n')
}

// --- Mail 1 : livraison du bon ---------------------------------------------------------------

function mail1(ctx: Ctx): RenderedEmail {
  const { input, values, ctaUrl, store, prefix } = ctx
  const s = pack(input.locale).mail1
  const common = pack(input.locale).common
  const subject = fill(s.subject, values)
  const cta = fill(s.cta, values)

  const conditions = s.cond
    .map(
      (c, i) =>
        `            <tr><td class="cond" style="padding-top:${i === 0 ? 18 : 7}px;font-family:Helvetica,Arial,sans-serif;font-size:13.5px;line-height:22px;color:#3d2f26;mso-line-height-rule:exactly;">
              <span style="color:#a65437;">&bull;</span>&nbsp;&nbsp;${bullet(c, values)}
            </td></tr>`
    )
    .join('\n')

  const html = `${head(1, input.locale, fill(s.docTitle, values))}
${openBody(fill(s.preheader, values), `${store}${prefix}`)}

    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="card" style="background-color:#ffffff;border:1px solid #21150c;border-radius:18px;">

        <tr><td class="px hero" bgcolor="#d79b86" style="background-color:#d79b86;padding:28px 30px 30px;border-radius:17px 17px 0 0;">
          <div class="amount" style="font-family:Georgia,'Times New Roman',Times,serif;font-size:62px;line-height:62px;font-weight:bold;letter-spacing:-1px;color:#21150c;text-shadow:2px 3px 0 rgba(255,255,255,0.85);mso-line-height-rule:exactly;">${esc(values.amount)}</div>
          <div class="h2" style="padding-top:8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;line-height:29px;font-weight:bold;color:#21150c;mso-line-height-rule:exactly;">${esc(s.heroH2)}</div>
          <div class="heroSub" style="padding-top:10px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:22px;color:#3d2a1c;mso-line-height-rule:exactly;">${esc(s.heroSub)}</div>
        </td></tr>

        <tr><td class="px" style="padding:26px 30px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;">
            <tr><td align="center" class="codebox" style="border:2px dashed #21150c;border-radius:12px;padding:18px 16px 16px;">
              <div class="code" style="font-family:'Courier New',Courier,monospace;font-size:27px;line-height:34px;font-weight:bold;letter-spacing:2px;color:#21150c;mso-line-height-rule:exactly;">${esc(input.code)}</div>
              <div class="codeexp" style="padding-top:6px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:19px;font-weight:bold;color:#a65437;mso-line-height-rule:exactly;">${esc(fill(s.codeValidity, values))}</div>
            </td></tr>
          </table>
        </td></tr>

        <tr><td class="px" style="padding:18px 30px 0;">
          ${ctaButton(ctaUrl, cta, true)}
          <div class="fine" style="padding-top:9px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:19px;color:#5c5049;text-align:center;mso-line-height-rule:exactly;">${esc(s.ctaFine)}</div>
        </td></tr>
${productBlockMail1(input, s.productEyebrow, s.productLink, common.productPrice, values)}
        <tr><td class="px" style="padding:24px 30px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="hair" style="border-top:1px solid #e4ded7;">
${conditions}
          </table>
        </td></tr>

        <tr><td class="px fine" align="center" style="padding:22px 30px 26px;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;line-height:20px;color:#5c5049;mso-line-height-rule:exactly;">
          ${esc(s.materials)}
        </td></tr>

      </table>
    </td></tr>
${ctx.footerHtml}${CLOSE_BODY}`

  const text = [
    `${values.amount} ${s.heroH2}`,
    '',
    s.heroSub,
    '',
    `${input.code} — ${fill(s.codeValidity, values)}`,
    '',
    `${cta} : ${ctaUrl}`,
    s.ctaFine,
    '',
    ...productTextLines(input, s.productEyebrow, common.productPrice, values),
    ...s.cond.map((c) => `- ${bulletText(c, values)}`),
    '',
    s.materials,
    '',
    ctx.footerText,
  ].join('\n')

  return { subject, html, text }
}

/** Bloc « Vous regardiez » du mail 1 — supprimé ENTIER quand l'œuvre manque. */
function productBlockMail1(
  input: RenderInput,
  eyebrow: string,
  linkLabel: string,
  priceTemplate: string,
  values: Record<string, string>
): string {
  const p = input.product
  if (!p) return ''

  const priceLine = productPriceLine(p, input.threshold, priceTemplate, values)
  const subtitle = p.subtitle
    ? `
            <tr><td class="sub" style="padding-top:4px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:21px;color:#5c5049;mso-line-height-rule:exactly;">${esc(p.subtitle)}</td></tr>`
    : ''
  const price = priceLine
    ? `
            <tr><td class="ink" style="padding-top:8px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:23px;color:#21150c;mso-line-height-rule:exactly;">
              ${esc(priceLine)}
            </td></tr>`
    : ''

  return `
        <tr><td class="px" style="padding:26px 30px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td class="eyebrow" style="border-top:1px solid #e4ded7;padding-top:22px;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:16px;letter-spacing:1.5px;font-weight:bold;color:#a65437;text-transform:uppercase;mso-line-height-rule:exactly;">${esc(eyebrow)}</td></tr>
            <tr><td style="padding-top:12px;">${productImage(p)}</td></tr>
            <tr><td class="ink" style="padding-top:14px;font-family:Georgia,'Times New Roman',Times,serif;font-size:20px;line-height:27px;font-weight:bold;color:#21150c;mso-line-height-rule:exactly;">${esc(p.title)}</td></tr>${subtitle}${price}
            <tr><td class="link" style="padding-top:12px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:22px;mso-line-height-rule:exactly;">
              <a href="${escUrl(p.url)}" style="color:#a65437;font-weight:bold;text-decoration:underline;">${esc(linkLabel)} &rarr;</a>
            </td></tr>
          </table>
        </td></tr>
`
}

function productTextLines(
  input: RenderInput,
  eyebrow: string,
  priceTemplate: string,
  values: Record<string, string>
): string[] {
  const p = input.product
  if (!p) return []
  const priceLine = productPriceLine(p, input.threshold, priceTemplate, values)
  return [
    `${eyebrow} : ${p.title}`,
    ...(p.subtitle ? [p.subtitle] : []),
    ...(priceLine ? [priceLine] : []),
    p.url,
    '',
  ]
}

// --- Mail 2 : levée d'objection ---------------------------------------------------------------

function mail2(ctx: Ctx): RenderedEmail {
  const { input, values, ctaUrl, store, prefix } = ctx
  const s = pack(input.locale).mail2
  const common = pack(input.locale).common
  const subject = fill(s.subject, values)

  const questions = s.questions
    .map((q, i) => {
      const link = q.link
        ? `
                <div class="link" style="padding-top:8px;font-family:Helvetica,Arial,sans-serif;font-size:14.5px;line-height:23px;mso-line-height-rule:exactly;"><a href="${escUrl(ctaUrl)}" style="color:#a65437;font-weight:bold;text-decoration:underline;">${esc(q.link)} &rarr;</a></div>`
        : ''
      return `        <tr><td class="px" style="padding:${i === 0 ? 26 : 20}px 30px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="44" valign="top" style="width:44px;padding-right:14px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="40" style="width:40px;">
                  <tr><td align="center" class="num" bgcolor="#f3e1da" style="background-color:#f3e1da;border-radius:20px;padding:9px 0;font-family:Georgia,'Times New Roman',Times,serif;font-size:17px;line-height:21px;font-weight:bold;color:#a65437;mso-line-height-rule:exactly;">${i + 1}</td></tr>
                </table>
              </td>
              <td valign="top">
                <div class="ink" style="font-family:Georgia,'Times New Roman',Times,serif;font-size:19px;line-height:26px;font-weight:bold;color:#21150c;mso-line-height-rule:exactly;">${esc(q.title)}</div>
                <div class="txt" style="padding-top:6px;font-family:Helvetica,Arial,sans-serif;font-size:14.5px;line-height:23px;color:#3d2f26;mso-line-height-rule:exactly;">${esc(q.body)}</div>${link}
              </td>
            </tr>
          </table>
        </td></tr>`
    })
    .join('\n\n')

  const html = `${head(2, input.locale, fill(s.docTitle, values))}
${openBody(fill(s.preheader, values), `${store}${prefix}`)}

    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="card" style="background-color:#ffffff;border:1px solid #21150c;border-radius:18px;">

        <tr><td class="px band" bgcolor="#21150c" style="background-color:#21150c;padding:14px 30px;border-radius:17px 17px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td class="strip bandlab" valign="middle" style="font-family:Helvetica,Arial,sans-serif;font-size:12.5px;line-height:19px;letter-spacing:1px;color:#f3e1da;mso-line-height-rule:exactly;">
                ${esc(fill(s.band, values))}
              </td>
              <td class="stripcode bandcode" align="right" valign="middle" style="font-family:'Courier New',Courier,monospace;font-size:15px;line-height:19px;font-weight:bold;letter-spacing:1px;color:#ffffff;mso-line-height-rule:exactly;">
                ${esc(input.code)}
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td class="px" style="padding:30px 30px 0;">
          <div class="h1 ink" style="font-family:Georgia,'Times New Roman',Times,serif;font-size:29px;line-height:37px;font-weight:bold;color:#21150c;mso-line-height-rule:exactly;">${esc(s.h1)}</div>
          <div class="txt" style="padding-top:12px;font-family:Helvetica,Arial,sans-serif;font-size:15.5px;line-height:24px;color:#3d2f26;mso-line-height-rule:exactly;">${esc(s.intro)}</div>
        </td></tr>

${questions}
${bestSellersBlock(input, s.bestEyebrow, common.productPrice, values)}
        <tr><td class="px" style="padding:26px 30px 0;">
          ${ctaButton(ctaUrl, s.cta, true)}
          <div class="fine" style="padding-top:9px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#5c5049;text-align:center;mso-line-height-rule:exactly;">${esc(fill(s.ctaFine, values))}</div>
        </td></tr>
${trustpilotBlock(input, s.trustpilot, values, store, prefix)}
      </table>
    </td></tr>
${ctx.footerHtml}${CLOSE_BODY}`

  const best = (input.bestSellers ?? []).length >= 2 ? input.bestSellers!.slice(0, 2) : []

  const text = [
    s.h1,
    '',
    s.intro,
    '',
    ...s.questions.flatMap((q) => [
      q.title,
      q.body,
      ...(q.link ? [`${q.link} : ${ctaUrl}`] : []),
      '',
    ]),
    ...(best.length
      ? [
          s.bestEyebrow,
          ...best.map((p) => {
            const line = productPriceLine(p, input.threshold, common.productPrice, values)
            return `- ${p.title}${p.subtitle ? ` — ${p.subtitle}` : ''}${line ? ` — ${line}` : ''}`
          }),
          '',
        ]
      : []),
    `${s.cta} : ${ctaUrl}`,
    fill(s.ctaFine, values),
    '',
    ...(input.trustpilotScore ? [fill(s.trustpilot, values), ''] : []),
    ctx.footerText,
  ].join('\n')

  return { subject, html, text }
}

/**
 * Bloc « les plus choisies » du mail 2 — DEUX œuvres, ou rien.
 *
 * Le gabarit du designer en montrait deux, avec des prix d'exemple en euros. En afficher une
 * seule déséquilibrerait la mise en page ; en afficher zéro ne se remarque pas. Moins de deux
 * œuvres résolues = le bloc entier disparaît, titre compris.
 */
function bestSellersBlock(
  input: RenderInput,
  eyebrow: string,
  priceTemplate: string,
  values: Record<string, string>
): string {
  const items = (input.bestSellers ?? []).slice(0, 2)
  if (items.length < 2) return ''

  const cards = items
    .map((p, i) => {
      const priceLine = productPriceLine(p, input.threshold, priceTemplate, values)
      const detail = [p.subtitle, priceLine].filter(Boolean).join(' — ')
      const detailRow = detail
        ? `
            <tr><td class="sub" style="padding-top:4px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#5c5049;mso-line-height-rule:exactly;">${esc(detail)}</td></tr>`
        : ''
      return `        <tr><td class="px" style="padding:${i === 0 ? 14 : 22}px 30px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td>${productImage(p)}</td></tr>
            <tr><td class="ink" style="padding-top:12px;font-family:Georgia,'Times New Roman',Times,serif;font-size:19px;line-height:26px;font-weight:bold;color:#21150c;mso-line-height-rule:exactly;">${esc(p.title)}</td></tr>${detailRow}
          </table>
        </td></tr>`
    })
    .join('\n\n')

  return `
        <tr><td class="px" style="padding:28px 30px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="hair" style="border-top:1px solid #e4ded7;">
            <tr><td class="eyebrow" style="padding-top:22px;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:16px;letter-spacing:1.5px;font-weight:bold;color:#a65437;text-transform:uppercase;mso-line-height-rule:exactly;">${esc(eyebrow)}</td></tr>
          </table>
        </td></tr>

${cards}
`
}

/**
 * Les étoiles et la note Trustpilot. Le nombre d'étoiles pleines SUIT la note : le gabarit en
 * dessinait quatre en dur, ce qui deviendrait faux le jour où la note bouge.
 */
function trustpilotBlock(
  input: RenderInput,
  template: string,
  values: Record<string, string>,
  store: string,
  prefix: string
): string {
  if (typeof input.trustpilotScore !== 'number' || !input.trustpilotCount) return ''

  const full = Math.max(0, Math.min(5, Math.round(input.trustpilotScore)))
  const stars = '&#9733;'.repeat(full)
  const empty = '&#9733;'.repeat(5 - full)

  return `
        <tr><td class="px fine" align="center" style="padding:24px 30px 26px;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;line-height:20px;color:#5c5049;mso-line-height-rule:exactly;">
          <span class="star" style="color:#a65437;font-size:14px;letter-spacing:1px;">${stars}</span>${empty ? `<span class="starOff" style="color:#c9b8ae;font-size:14px;letter-spacing:1px;">${empty}</span>` : ''}<br />
          <a href="${escUrl(`${store}${prefix}`)}" style="color:#4a3f37;text-decoration:underline;">${esc(fill(template, values))}</a>
        </td></tr>
`
}

// --- Mail 3 : fin de promotion ----------------------------------------------------------------

function mail3(ctx: Ctx): RenderedEmail {
  const { input, values, ctaUrl, store, prefix } = ctx
  const s = pack(input.locale).mail3
  const common = pack(input.locale).common
  const subject = fill(s.subject, values)
  const cta = fill(s.cta, values)

  const html = `${head(3, input.locale, fill(s.docTitle, values))}
${openBody(fill(s.preheader, values), `${store}${prefix}`)}

    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="cardDark" bgcolor="#21150c" style="background-color:#21150c;border-radius:18px;">

        <tr><td class="px" style="padding:32px 30px 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:17px;letter-spacing:2px;font-weight:bold;color:#d79b86;text-transform:uppercase;mso-line-height-rule:exactly;">${esc(s.eyebrow)}</td></tr>

        <tr><td class="px" style="padding:12px 30px 0;">
          <div class="h1" style="font-family:Georgia,'Times New Roman',Times,serif;font-size:36px;line-height:44px;font-weight:bold;color:#f3e1da;mso-line-height-rule:exactly;">${esc(fill(s.h1, values))}</div>
          <div style="padding-top:14px;font-family:Helvetica,Arial,sans-serif;font-size:15.5px;line-height:24px;color:#e6d6cd;mso-line-height-rule:exactly;">${esc(s.intro)}</div>
        </td></tr>

        <tr><td class="px" style="padding:24px 30px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;">
            <tr><td align="center" class="codebox" style="border:2px dashed #d79b86;border-radius:12px;padding:16px;">
              <div class="code" style="font-family:'Courier New',Courier,monospace;font-size:26px;line-height:33px;font-weight:bold;letter-spacing:2px;color:#ffffff;mso-line-height-rule:exactly;">${esc(input.code)}</div>
              <div class="codeexp" style="padding-top:5px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:19px;color:#d79b86;mso-line-height-rule:exactly;">${esc(fill(s.codeValidity, values))}</div>
            </td></tr>
          </table>
        </td></tr>

        <tr><td class="px" style="padding:18px 30px 0;">
          ${ctaButton(ctaUrl, cta, false)}
        </td></tr>

        <tr><td class="px" align="center" style="padding:10px 30px 30px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#c8b2a6;mso-line-height-rule:exactly;">
          ${esc(fill(s.ctaFine, values))}
        </td></tr>

      </table>
    </td></tr>
${mail3ProductCard(input, s.productEyebrow, s.productLink, s.honesty, common.productPrice, values)}${ctx.footerHtml}${CLOSE_BODY}`

  const priceLine = input.product
    ? productPriceLine(input.product, input.threshold, common.productPrice, values)
    : ''

  const text = [
    s.eyebrow,
    fill(s.h1, values),
    '',
    s.intro,
    '',
    `${input.code} — ${fill(s.codeValidity, values)}`,
    '',
    `${cta} : ${ctaUrl}`,
    fill(s.ctaFine, values),
    '',
    ...(input.product
      ? [
          `${s.productEyebrow} : ${input.product.title}`,
          ...(priceLine ? [priceLine] : []),
          input.product.url,
          '',
        ]
      : []),
    ...(values.betterDeal ? [bulletText(s.honesty, values), ''] : []),
    ctx.footerText,
  ].join('\n')

  return { subject, html, text }
}

/**
 * La carte blanche du mail 3 : l'œuvre regardée, puis le point d'honnêteté.
 *
 * Les deux sont indépendants — l'œuvre peut manquer, la promotion peut ne pas exister. Si les
 * DEUX manquent, la carte entière disparaît plutôt que de laisser un rectangle blanc vide.
 */
function mail3ProductCard(
  input: RenderInput,
  eyebrow: string,
  linkLabel: string,
  honesty: Bullet,
  priceTemplate: string,
  values: Record<string, string>
): string {
  const p = input.product
  const showHonesty = !!values.betterDeal
  if (!p && !showHonesty) return ''

  const priceLine = p ? productPriceLine(p, input.threshold, priceTemplate, values) : ''
  const priceRow = priceLine
    ? `
        <tr><td class="px ink" style="padding:6px 30px 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:23px;color:#21150c;mso-line-height-rule:exactly;">
          ${esc(priceLine)}
        </td></tr>`
    : ''

  const artwork = p
    ? `
        <tr><td class="px eyebrow" style="padding:26px 30px 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:17px;letter-spacing:1.5px;font-weight:bold;color:#a65437;text-transform:uppercase;mso-line-height-rule:exactly;">${esc(eyebrow)}</td></tr>
        <tr><td class="px" style="padding:14px 30px 0;">${productImage(p)}</td></tr>
        <tr><td class="px ink" style="padding:14px 30px 0;font-family:Georgia,'Times New Roman',Times,serif;font-size:20px;line-height:27px;font-weight:bold;color:#21150c;mso-line-height-rule:exactly;">${esc(p.title)}</td></tr>${priceRow}
        <tr><td class="px link" style="padding:12px 30px 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:22px;mso-line-height-rule:exactly;">
          <a href="${escUrl(p.url)}" style="color:#a65437;font-weight:bold;text-decoration:underline;">${esc(linkLabel)} &rarr;</a>
        </td></tr>`
    : ''

  const note = showHonesty
    ? `
        <tr><td class="px" style="padding:${p ? 22 : 26}px 30px 26px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td class="note" bgcolor="#f3e1da" style="background-color:#f3e1da;border-radius:10px;padding:14px 16px;font-family:Helvetica,Arial,sans-serif;font-size:13.5px;line-height:22px;color:#3d2f26;mso-line-height-rule:exactly;">
              ${bullet(honesty, values)}
            </td></tr>
          </table>
        </td></tr>`
    : // Sans le point d'honnêteté, c'est le bloc produit qui doit fermer la carte.
      `
        <tr><td style="padding-bottom:26px;"></td></tr>`

  return `
    <tr><td style="padding-top:14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="card" style="background-color:#ffffff;border:1px solid #21150c;border-radius:18px;">${artwork}${note}
      </table>
    </td></tr>
`
}
