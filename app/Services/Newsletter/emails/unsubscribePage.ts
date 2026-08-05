import { pack } from './strings'
import type { NewsletterLocale } from '../config'

/**
 * Les deux pages du désabonnement — dans la langue du contact.
 *
 * ⛔ LA PAGE `GET` NE DÉSABONNE PAS. RFC 8058 : « anti-spam software often fetches all
 * resources in mail header fields automatically, without any action by the user ». Un GET
 * actif produirait des désabonnements FANTÔMES, déclenchés par des robots que personne n'a
 * demandés — on perdrait des inscrits sans que quiconque ait cliqué.
 *
 * Le désabonnement réel se fait par POST : soit le formulaire ci-dessous, soit le bouton
 * natif de Gmail/Yahoo via `List-Unsubscribe-Post`.
 */

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SHELL = (locale: string, title: string, body: string) => `<!doctype html>
<html lang="${esc(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>
  body { margin:0; background:#F3E1DA; color:#21150C;
         font:400 16px/1.6 Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif; }
  .box { max-width:520px; margin:12vh auto; background:#FFFFFF; border:2px solid #21150C;
         padding:36px 32px; text-align:center; }
  h1 { margin:0 0 14px 0; font:700 24px/1.3 'Harmonia Sans','Helvetica Neue',Helvetica,Arial,sans-serif; }
  p { margin:0 0 22px 0; }
  button { background:#D79B86; color:#21150C; border:2px solid #21150C; cursor:pointer;
           font:700 16px/1 'Harmonia Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
           padding:15px 30px; }
  .small { font-size:13px; color:#6D3724; }
</style>
</head>
<body><div class="box">${body}</div></body>
</html>`

/** Page de confirmation — un formulaire qui POSTe sur la MÊME URL. */
export function renderUnsubscribeConfirm(locale: NewsletterLocale, actionUrl: string): string {
  const strings = pack(locale).unsubscribePage
  return SHELL(
    locale,
    strings.title,
    `<h1>${esc(strings.title)}</h1>
     <p>${esc(strings.body)}</p>
     <form method="post" action="${esc(actionUrl)}">
       <button type="submit">${esc(strings.button)}</button>
     </form>`
  )
}

/** Page « c'est fait ». Affichée aussi si la personne était déjà désabonnée (idempotence). */
export function renderUnsubscribeDone(locale: NewsletterLocale): string {
  const strings = pack(locale).unsubscribePage
  return SHELL(locale, strings.done, `<h1>${esc(strings.done)}</h1><p>${esc(strings.doneBody)}</p>`)
}
