import { pack } from './strings'
import { formatAnnouncedDate, intlTag } from '../expiry'
import { moneyLabel } from '../currency'
import type { VoucherCurrency } from '../currency'
import type { NewsletterLocale } from '../config'

/**
 * Gabarit HTML des trois e-mails de la séquence — UN SEUL, alimenté par cinq jeux de chaînes.
 *
 * Design calé sur les tokens RÉELS du thème live, comme les e-mails du studio
 * (App/Services/CustomArt/emailTemplate.ts) : même encre, même crème, et surtout le même
 * BOUTON D'ACHAT (#D79B86) pour le CTA — « cliquer ici, c'est acheter là-bas ».
 *
 * Module PUR : aucune dépendance Adonis, testable hors ligne.
 */

const INK = '#21150C'
const CREAM = '#F3E1DA'
const BLUSH_LT = '#E9C7BC'
const BLUSH = '#DFAE9D'
const BUY = '#D79B86'
const TERRA = '#A65437'
const TERRA_DEEP = '#6D3724'
const WHITE = '#FFFFFF'

const HEADING = "'Harmonia Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
const BODY = "Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif"
const DISPLAY = "'Limelight','Helvetica Neue',Arial,sans-serif"

const CONTENT_W = 680

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
   */
  product?: {
    title: string
    imageUrl: string
    /** Déjà mis en forme dans la devise de l'acheteur — le prix RÉEL de son marché. */
    price: string
    url: string
  }
  /** Mention postale complète de l'expéditeur (obligation légale). */
  /**
   * Mention postale de l'expéditeur, en pied d'e-mail. VIDE = la ligne n'apparaît pas.
   *
   * Contrairement à ce que laissait entendre le brief, ce n'est PAS une obligation légale en
   * Europe : l'art. L34-5 du CPCE et la directive e-commerce exigent que l'expéditeur soit
   * clairement identifiable et qu'une adresse de contact permette de s'opposer — c'est déjà
   * assuré par le nom d'expéditeur, l'adresse de contact et le lien de désabonnement.
   *
   * ⚠️ La règle change hors d'Europe : le CAN-SPAM Act américain, lui, exige une adresse
   * postale physique dès qu'un destinataire est aux États-Unis. À renseigner si la séquence
   * s'ouvre un jour à ce marché.
   */
  postalAddress?: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

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

/**
 * Lien du bouton d'action : le code est APPLIQUÉ au panier par Shopify avant l'atterrissage.
 *
 * `/discount/<CODE>?redirect=<chemin>` est la route native de Shopify — elle pose le code dans
 * la session puis renvoie sur le chemin demandé. Sans elle, le lecteur doit recopier son code
 * à la main au paiement, six jours après l'avoir reçu : c'est là que le bon se perd.
 *
 * ⛔ Le CHEMIN DE RETOUR porte le préfixe de langue. Sans lui, un Néerlandais qui clique sur
 * « Mijn kunstwerk kiezen » atterrit sur une page en français, avec son code bien appliqué.
 */
export function applyUrl(storeUrl: string, code: string, locale: NewsletterLocale): string {
  const base = String(storeUrl ?? '').replace(/\/+$/, '')
  return `${base}/discount/${encodeURIComponent(code)}?redirect=${localePath(locale)}/collections/all`
}

function shortDate(ts: number, locale: NewsletterLocale): string {
  try {
    return new Intl.DateTimeFormat(intlTag(locale), {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Europe/Paris',
    }).format(new Date(ts * 1000))
  } catch {
    return new Date(ts * 1000).toISOString().slice(5, 10)
  }
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : whole
  )
}

function col(inner: string, align: 'left' | 'center' = 'left'): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="width:100%; max-width:${CONTENT_W}px; margin:0 auto;">
      <tr><td align="${align}" style="padding-left:28px; padding-right:28px;">${inner}</td></tr>
    </table>`
}

export function renderNewsletterEmail(input: RenderInput): RenderedEmail {
  const strings = pack(input.locale)
  const copy = strings.emails[input.emailNo - 1]

  const values = {
    code: input.code,
    // La date ANNONCÉE, en toutes lettres et SANS HEURE.
    date: formatAnnouncedDate(input.announcedDate, input.locale),
    // Le montant PROMIS, dans la devise du client — pas le montant posé sur le code.
    amount: moneyLabel(input.amount, input.currency, input.locale),
    min: moneyLabel(input.threshold, input.currency, input.locale),
    signupDate: shortDate(input.signupTs, input.locale),
    contact: input.contactEmail,
  }

  const subject = fill(copy.subject, values)
  const preheader = fill(copy.preheader, values)
  const title = fill(copy.title, values)
  const intro = fill(copy.intro, values)
  const validity = fill(copy.validity, values)
  const context = fill(strings.footer.context, values)
  const contact = fill(strings.footer.contact, values)

  // Le bouton APPLIQUE le code puis renvoie sur la boutique, dans la bonne langue.
  const shopUrl = applyUrl(input.storeUrl, input.code, input.locale)

  const reassure = copy.reassure
    .map(
      (line) =>
        `<tr><td style="padding:0 0 10px 0; font:400 15px/1.55 ${BODY}; color:${INK};">
           <span style="color:${TERRA}; font-weight:700;">&#8226;</span>&nbsp;${esc(line)}
         </td></tr>`
    )
    .join('')

  const html = `<!--[if mso]><style>body,table,td{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${esc(preheader)}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:${CREAM}; margin:0; padding:0;">
  <tr><td align="center" style="padding:0;">

    <!-- Bandeau d'ouverture -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:${CREAM};">
      <tr><td align="center" style="padding:36px 0 8px 0;">
        ${col(
          `<div style="font:400 13px/1.2 ${DISPLAY}; letter-spacing:.18em; text-transform:uppercase; color:${TERRA};">${esc(copy.eyebrow)}</div>
           <h1 style="margin:14px 0 0 0; font:700 30px/1.25 ${HEADING}; color:${INK};">${esc(title)}</h1>`,
          'center'
        )}
      </td></tr>
    </table>

    <!-- Corps -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:${WHITE};">
      <tr><td align="center" style="padding:32px 0 8px 0;">
        ${col(
          `<p style="margin:0 0 24px 0; font:400 16px/1.6 ${BODY}; color:${INK};">${esc(intro)}</p>`
        )}
      </td></tr>

      <!-- Le code -->
      <tr><td align="center" style="padding:0 0 8px 0;">
        ${col(
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:${BLUSH_LT}; border:2px solid ${INK};">
             <tr><td align="center" style="padding:22px 16px 20px 16px;">
               <div style="font:400 12px/1.2 ${BODY}; letter-spacing:.14em; text-transform:uppercase; color:${TERRA_DEEP};">${esc(copy.codeLabel)}</div>
               <div style="margin:10px 0 8px 0; font:700 32px/1.1 ${HEADING}; letter-spacing:.08em; color:${INK};">${esc(input.code)}</div>
               <div style="font:400 14px/1.5 ${BODY}; color:${TERRA_DEEP};">${esc(validity)}</div>
             </td></tr>
           </table>`,
          'center'
        )}
      </td></tr>

      <!-- CTA : le bouton d'achat du site -->
      <tr><td align="center" style="padding:26px 0 6px 0;">
        ${col(
          `<a href="${escUrl(shopUrl)}" style="display:inline-block; background-color:${BUY}; color:${INK}; border:2px solid ${INK}; text-decoration:none; font:700 17px/1 ${HEADING}; padding:16px 34px;">${esc(copy.cta)}</a>`,
          'center'
        )}
      </td></tr>

      <!-- Réassurance -->
      <tr><td align="center" style="padding:26px 0 34px 0;">
        ${col(
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-top:1px solid ${BLUSH}; padding-top:18px;">
             ${reassure}
           </table>
           <p style="margin:20px 0 0 0; font:400 15px/1.6 ${BODY}; color:${INK}; white-space:pre-line;">${esc(copy.closing)}</p>`
        )}
      </td></tr>
    </table>

    <!-- Pied de page : mentions obligatoires ET désabonnement VISIBLE -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; background-color:${CREAM};">
      <tr><td align="center" style="padding:26px 0 34px 0;">
        ${col(
          `<p style="margin:0 0 12px 0; font:400 12px/1.6 ${BODY}; color:${TERRA_DEEP};">${esc(context)}</p>
           <p style="margin:0 0 12px 0; font:400 12px/1.6 ${BODY}; color:${TERRA_DEEP};">${esc(contact)}</p>
           ${
             input.postalAddress
               ? `<p style="margin:0 0 14px 0; font:400 12px/1.6 ${BODY}; color:${TERRA_DEEP};">${esc(input.postalAddress)}</p>`
               : ''
           }
           <p style="margin:0; font:400 13px/1.6 ${BODY};">
             <a href="${escUrl(input.unsubscribeUrl)}" style="color:${TERRA_DEEP}; text-decoration:underline;">${esc(strings.footer.unsubscribe)}</a>
           </p>`,
          'center'
        )}
      </td></tr>
    </table>

  </td></tr>
</table>`

  // Version texte : ce n'est pas une politesse. Un e-mail HTML sans équivalent texte est un
  // signal négatif chez plusieurs filtres antispam, et le lien de désabonnement doit y être
  // aussi — certains lecteurs n'affichent que celle-ci.
  const text = [
    title,
    '',
    intro,
    '',
    `${copy.codeLabel} : ${input.code}`,
    validity,
    '',
    `${copy.cta} : ${shopUrl}`,
    '',
    ...copy.reassure.map((line) => `- ${line}`),
    '',
    copy.closing,
    '',
    '---',
    context,
    contact,
    // Ligne omise quand la mention postale n'est pas renseignée — pas de ligne vide en pied.
    ...(input.postalAddress ? [input.postalAddress] : []),
    `${strings.footer.unsubscribe} : ${input.unsubscribeUrl}`,
  ].join('\n')

  return { subject, html, text }
}
