import type { NewsletterLocale } from '../config'

/**
 * Les textes des trois e-mails, dans les cinq langues.
 *
 * UN SEUL GABARIT (voir `template.ts`), cinq jeux de chaînes. Jamais quinze gabarits : à la
 * première correction de mise en page, quatorze copies dérivent, et la quinzième part quand
 * même.
 *
 * `{code}`, `{date}`, `{amount}`, `{min}` sont remplacés à l'envoi.
 */

export interface EmailStrings {
  subject: string
  preheader: string
  eyebrow: string
  title: string
  intro: string
  codeLabel: string
  validity: string
  cta: string
  reassure: string[]
  closing: string
}

export interface FooterStrings {
  /** « vous avez demandé votre bon de 15 € sur myselfmonart.com le JJ/MM » */
  context: string
  unsubscribe: string
  unsubscribeAction: string
  contact: string
}

export interface UnsubscribePageStrings {
  title: string
  body: string
  button: string
  done: string
  doneBody: string
}

type Pack = {
  emails: [EmailStrings, EmailStrings, EmailStrings]
  footer: FooterStrings
  unsubscribePage: UnsubscribePageStrings
}

const fr: Pack = {
  emails: [
    {
      subject: 'Votre bon de {amount} vous attend',
      preheader: 'Votre code personnel, valable jusqu’au {date}.',
      eyebrow: 'Merci',
      title: 'Voici votre bon de {amount}',
      intro:
        'Merci d’avoir demandé votre bon. Il est à vous, à votre nom, et il ne fonctionne qu’une fois.',
      codeLabel: 'Votre code personnel',
      validity: 'Valable jusqu’au {date}, dès {min} d’achat.',
      cta: 'Choisir mon œuvre',
      reassure: [
        'Impression sur toile ou papier d’art, tendue et prête à accrocher.',
        'Fabriqué en Europe, expédié sous 3 à 5 jours.',
        'Un doute sur une taille ? Répondez à cet e-mail, on regarde ensemble.',
      ],
      closing: 'À très vite,\nL’atelier MyselfMonArt',
    },
    {
      subject: 'Votre bon de {amount} expire bientôt',
      preheader: 'Votre code {code} est encore actif jusqu’au {date}.',
      eyebrow: 'Rappel',
      title: 'Votre bon est toujours valable',
      intro:
        'Votre code vous attend encore. Si une œuvre vous a plu, c’est le bon moment — il expire le {date}.',
      codeLabel: 'Votre code personnel',
      validity: 'Valable jusqu’au {date}, dès {min} d’achat.',
      cta: 'Revoir les œuvres',
      reassure: [
        'Chaque tirage est produit à la commande, jamais stocké.',
        'Livraison suivie, emballage rigide.',
        'Échange gratuit si la taille ne convient pas.',
      ],
      closing: 'À bientôt,\nL’atelier MyselfMonArt',
    },
    {
      subject: 'Dernier jour pour votre bon de {amount}',
      preheader: 'Après le {date}, le code {code} ne fonctionnera plus.',
      eyebrow: 'Dernier rappel',
      title: 'C’est le moment ou jamais',
      intro:
        'C’est le dernier e-mail que nous vous envoyons à ce sujet. Votre bon expire le {date} — après, il ne fonctionnera plus.',
      codeLabel: 'Votre code personnel',
      validity: 'Valable jusqu’au {date}, dès {min} d’achat.',
      cta: 'Utiliser mon bon',
      reassure: [
        'Plus de 400 œuvres, du petit format au grand mur.',
        'Paiement en 3 fois sans frais dès 100 €.',
        'Une question ? Répondez simplement à cet e-mail.',
      ],
      closing: 'Merci de votre confiance,\nL’atelier MyselfMonArt',
    },
  ],
  footer: {
    context:
      'Vous recevez cet e-mail parce que vous avez demandé votre bon de {amount} sur myselfmonart.com le {signupDate}.',
    unsubscribe: 'Ne plus recevoir ces e-mails',
    unsubscribeAction: 'Se désabonner',
    contact: 'Une question ? Écrivez-nous à {contact}.',
  },
  unsubscribePage: {
    title: 'Ne plus recevoir nos e-mails',
    body: 'Confirmez ci-dessous et nous ne vous écrirons plus au sujet de ce bon.',
    button: 'Confirmer mon désabonnement',
    done: 'C’est fait',
    doneBody: 'Vous ne recevrez plus nos e-mails. Merci d’avoir pris le temps de nous le dire.',
  },
}

const en: Pack = {
  emails: [
    {
      subject: 'Your {amount} voucher is ready',
      preheader: 'Your personal code, valid until {date}.',
      eyebrow: 'Thank you',
      title: 'Here is your {amount} voucher',
      intro:
        'Thanks for requesting your voucher. It is yours, in your name, and it works exactly once.',
      codeLabel: 'Your personal code',
      validity: 'Valid until {date}, on orders from {min}.',
      cta: 'Choose my artwork',
      reassure: [
        'Printed on canvas or fine art paper, stretched and ready to hang.',
        'Made in Europe, shipped within 3 to 5 days.',
        'Unsure about a size? Just reply to this email and we will help.',
      ],
      closing: 'See you soon,\nThe MyselfMonArt studio',
    },
    {
      subject: 'Your {amount} voucher expires soon',
      preheader: 'Your code {code} is still active until {date}.',
      eyebrow: 'Reminder',
      title: 'Your voucher is still valid',
      intro:
        'Your code is still waiting. If a piece caught your eye, now is the moment — it expires on {date}.',
      codeLabel: 'Your personal code',
      validity: 'Valid until {date}, on orders from {min}.',
      cta: 'Browse the artworks',
      reassure: [
        'Every print is made to order, never stocked.',
        'Tracked delivery, rigid packaging.',
        'Free exchange if the size is not right.',
      ],
      closing: 'Talk soon,\nThe MyselfMonArt studio',
    },
    {
      subject: 'Last day for your {amount} voucher',
      preheader: 'After {date}, code {code} will stop working.',
      eyebrow: 'Final reminder',
      title: 'It is now or never',
      intro:
        'This is the last email we will send about this. Your voucher expires on {date} — after that it stops working.',
      codeLabel: 'Your personal code',
      validity: 'Valid until {date}, on orders from {min}.',
      cta: 'Use my voucher',
      reassure: [
        'Over 400 artworks, from small formats to full walls.',
        'Pay in 3 instalments, no fees, from €100.',
        'A question? Simply reply to this email.',
      ],
      closing: 'Thank you for your trust,\nThe MyselfMonArt studio',
    },
  ],
  footer: {
    context:
      'You are receiving this email because you requested your {amount} voucher on myselfmonart.com on {signupDate}.',
    unsubscribe: 'Stop receiving these emails',
    unsubscribeAction: 'Unsubscribe',
    contact: 'A question? Write to us at {contact}.',
  },
  unsubscribePage: {
    title: 'Stop receiving our emails',
    body: 'Confirm below and we will stop writing to you about this voucher.',
    button: 'Confirm my unsubscribe',
    done: 'Done',
    doneBody: 'You will not receive our emails any more. Thank you for telling us.',
  },
}

const de: Pack = {
  emails: [
    {
      subject: 'Ihr {amount}-Gutschein ist da',
      preheader: 'Ihr persönlicher Code, gültig bis {date}.',
      eyebrow: 'Danke',
      title: 'Hier ist Ihr {amount}-Gutschein',
      intro:
        'Danke, dass Sie Ihren Gutschein angefordert haben. Er gehört Ihnen, lautet auf Ihren Namen und ist genau einmal einlösbar.',
      codeLabel: 'Ihr persönlicher Code',
      validity: 'Gültig bis {date}, ab einem Bestellwert von {min}.',
      cta: 'Mein Kunstwerk wählen',
      reassure: [
        'Druck auf Leinwand oder Kunstdruckpapier, aufgespannt und aufhängefertig.',
        'In Europa gefertigt, Versand in 3 bis 5 Tagen.',
        'Unsicher bei der Größe? Antworten Sie einfach auf diese E-Mail.',
      ],
      closing: 'Bis bald,\nDas MyselfMonArt-Atelier',
    },
    {
      subject: 'Ihr {amount}-Gutschein läuft bald ab',
      preheader: 'Ihr Code {code} ist noch bis {date} aktiv.',
      eyebrow: 'Erinnerung',
      title: 'Ihr Gutschein ist noch gültig',
      intro:
        'Ihr Code wartet noch auf Sie. Wenn Ihnen ein Werk gefallen hat, ist jetzt der Moment — er läuft am {date} ab.',
      codeLabel: 'Ihr persönlicher Code',
      validity: 'Gültig bis {date}, ab einem Bestellwert von {min}.',
      cta: 'Werke ansehen',
      reassure: [
        'Jeder Druck entsteht auf Bestellung, nie auf Lager.',
        'Versand mit Sendungsverfolgung, stabile Verpackung.',
        'Kostenloser Umtausch, wenn die Größe nicht passt.',
      ],
      closing: 'Bis bald,\nDas MyselfMonArt-Atelier',
    },
    {
      subject: 'Letzter Tag für Ihren {amount}-Gutschein',
      preheader: 'Nach dem {date} funktioniert der Code {code} nicht mehr.',
      eyebrow: 'Letzte Erinnerung',
      title: 'Jetzt oder nie',
      intro:
        'Dies ist unsere letzte E-Mail dazu. Ihr Gutschein läuft am {date} ab — danach funktioniert er nicht mehr.',
      codeLabel: 'Ihr persönlicher Code',
      validity: 'Gültig bis {date}, ab einem Bestellwert von {min}.',
      cta: 'Gutschein einlösen',
      reassure: [
        'Über 400 Werke, vom kleinen Format bis zur ganzen Wand.',
        'Zahlung in 3 Raten ohne Gebühren ab 100 €.',
        'Eine Frage? Antworten Sie einfach auf diese E-Mail.',
      ],
      closing: 'Danke für Ihr Vertrauen,\nDas MyselfMonArt-Atelier',
    },
  ],
  footer: {
    context:
      'Sie erhalten diese E-Mail, weil Sie am {signupDate} auf myselfmonart.com Ihren {amount}-Gutschein angefordert haben.',
    unsubscribe: 'Diese E-Mails nicht mehr erhalten',
    unsubscribeAction: 'Abmelden',
    contact: 'Eine Frage? Schreiben Sie uns an {contact}.',
  },
  unsubscribePage: {
    title: 'Unsere E-Mails abbestellen',
    body: 'Bestätigen Sie unten, und wir schreiben Ihnen nicht mehr zu diesem Gutschein.',
    button: 'Abmeldung bestätigen',
    done: 'Erledigt',
    doneBody: 'Sie erhalten unsere E-Mails nicht mehr. Danke für Ihre Rückmeldung.',
  },
}

const es: Pack = {
  emails: [
    {
      subject: 'Su vale de {amount} le espera',
      preheader: 'Su código personal, válido hasta el {date}.',
      eyebrow: 'Gracias',
      title: 'Aquí tiene su vale de {amount}',
      intro: 'Gracias por solicitar su vale. Es suyo, a su nombre, y funciona una sola vez.',
      codeLabel: 'Su código personal',
      validity: 'Válido hasta el {date}, a partir de {min} de compra.',
      cta: 'Elegir mi obra',
      reassure: [
        'Impresión sobre lienzo o papel de arte, tensada y lista para colgar.',
        'Fabricado en Europa, enviado en 3 a 5 días.',
        '¿Duda con una talla? Responda a este correo y le ayudamos.',
      ],
      closing: 'Hasta pronto,\nEl taller MyselfMonArt',
    },
    {
      subject: 'Su vale de {amount} caduca pronto',
      preheader: 'Su código {code} sigue activo hasta el {date}.',
      eyebrow: 'Recordatorio',
      title: 'Su vale sigue siendo válido',
      intro:
        'Su código sigue esperándole. Si alguna obra le gustó, este es el momento — caduca el {date}.',
      codeLabel: 'Su código personal',
      validity: 'Válido hasta el {date}, a partir de {min} de compra.',
      cta: 'Ver las obras',
      reassure: [
        'Cada impresión se produce bajo pedido, nunca en stock.',
        'Envío con seguimiento, embalaje rígido.',
        'Cambio gratuito si la talla no encaja.',
      ],
      closing: 'Hasta pronto,\nEl taller MyselfMonArt',
    },
    {
      subject: 'Último día para su vale de {amount}',
      preheader: 'Después del {date}, el código {code} dejará de funcionar.',
      eyebrow: 'Último recordatorio',
      title: 'Ahora o nunca',
      intro:
        'Este es el último correo que le enviamos sobre esto. Su vale caduca el {date} — después dejará de funcionar.',
      codeLabel: 'Su código personal',
      validity: 'Válido hasta el {date}, a partir de {min} de compra.',
      cta: 'Usar mi vale',
      reassure: [
        'Más de 400 obras, del formato pequeño a la pared entera.',
        'Pago en 3 veces sin gastos a partir de 100 €.',
        '¿Una pregunta? Responda simplemente a este correo.',
      ],
      closing: 'Gracias por su confianza,\nEl taller MyselfMonArt',
    },
  ],
  footer: {
    context:
      'Recibe este correo porque solicitó su vale de {amount} en myselfmonart.com el {signupDate}.',
    unsubscribe: 'Dejar de recibir estos correos',
    unsubscribeAction: 'Darse de baja',
    contact: '¿Una pregunta? Escríbanos a {contact}.',
  },
  unsubscribePage: {
    title: 'Dejar de recibir nuestros correos',
    body: 'Confirme abajo y dejaremos de escribirle sobre este vale.',
    button: 'Confirmar mi baja',
    done: 'Hecho',
    doneBody: 'Ya no recibirá nuestros correos. Gracias por decírnoslo.',
  },
}

const nl: Pack = {
  emails: [
    {
      subject: 'Uw waardebon van {amount} staat klaar',
      preheader: 'Uw persoonlijke code, geldig tot {date}.',
      eyebrow: 'Bedankt',
      title: 'Hier is uw waardebon van {amount}',
      intro:
        'Bedankt voor uw aanvraag. De bon is van u, staat op uw naam en werkt precies één keer.',
      codeLabel: 'Uw persoonlijke code',
      validity: 'Geldig tot {date}, vanaf {min} aankoop.',
      cta: 'Mijn kunstwerk kiezen',
      reassure: [
        'Gedrukt op canvas of kunstpapier, opgespannen en klaar om op te hangen.',
        'Gemaakt in Europa, verzonden binnen 3 tot 5 dagen.',
        'Twijfelt u over een maat? Beantwoord deze e-mail, we kijken mee.',
      ],
      closing: 'Tot snel,\nHet MyselfMonArt-atelier',
    },
    {
      subject: 'Uw waardebon van {amount} verloopt binnenkort',
      preheader: 'Uw code {code} is nog actief tot {date}.',
      eyebrow: 'Herinnering',
      title: 'Uw waardebon is nog geldig',
      intro:
        'Uw code wacht nog op u. Als een werk u is bijgebleven, is dit het moment — hij verloopt op {date}.',
      codeLabel: 'Uw persoonlijke code',
      validity: 'Geldig tot {date}, vanaf {min} aankoop.',
      cta: 'De werken bekijken',
      reassure: [
        'Elke druk wordt op bestelling gemaakt, nooit op voorraad.',
        'Verzending met tracking, stevige verpakking.',
        'Gratis ruilen als de maat niet klopt.',
      ],
      closing: 'Tot snel,\nHet MyselfMonArt-atelier',
    },
    {
      subject: 'Laatste dag voor uw waardebon van {amount}',
      preheader: 'Na {date} werkt code {code} niet meer.',
      eyebrow: 'Laatste herinnering',
      title: 'Nu of nooit',
      intro:
        'Dit is de laatste e-mail die we hierover sturen. Uw waardebon verloopt op {date} — daarna werkt hij niet meer.',
      codeLabel: 'Uw persoonlijke code',
      validity: 'Geldig tot {date}, vanaf {min} aankoop.',
      cta: 'Mijn bon gebruiken',
      reassure: [
        'Meer dan 400 werken, van klein formaat tot een hele muur.',
        'Betaal in 3 termijnen zonder kosten vanaf € 100.',
        'Een vraag? Beantwoord gewoon deze e-mail.',
      ],
      closing: 'Bedankt voor uw vertrouwen,\nHet MyselfMonArt-atelier',
    },
  ],
  footer: {
    context:
      'U ontvangt deze e-mail omdat u op {signupDate} uw waardebon van {amount} hebt aangevraagd op myselfmonart.com.',
    unsubscribe: 'Deze e-mails niet meer ontvangen',
    unsubscribeAction: 'Uitschrijven',
    contact: 'Een vraag? Schrijf ons op {contact}.',
  },
  unsubscribePage: {
    title: 'Onze e-mails opzeggen',
    body: 'Bevestig hieronder en we schrijven u niet meer over deze waardebon.',
    button: 'Mijn uitschrijving bevestigen',
    done: 'Gelukt',
    doneBody: 'U ontvangt onze e-mails niet meer. Bedankt dat u het ons hebt laten weten.',
  },
}

const PACKS: Record<NewsletterLocale, Pack> = { fr, en, de, es, nl }

/** Repli sur le français : une langue absente ne doit jamais produire un e-mail vide. */
export function pack(locale: NewsletterLocale): Pack {
  return PACKS[locale] ?? PACKS.fr
}
