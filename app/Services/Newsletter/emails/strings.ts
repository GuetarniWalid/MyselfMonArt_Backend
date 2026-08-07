import type { NewsletterLocale } from '../config'

/**
 * Les textes des trois e-mails, dans les cinq langues.
 *
 * UN SEUL GABARIT PAR E-MAIL (voir `template.ts`), cinq jeux de chaînes. Jamais quinze
 * gabarits : à la première correction de mise en page, quatorze copies dérivent, et la
 * quinzième part quand même.
 *
 * ⚠️ PROVENANCE DES TEXTES, à savoir avant de les relire :
 *   • `fr` est le texte du DESIGNER, recopié verbatim depuis `emails/mail-*.html`.
 *   • `de` du mail 1 vient de sa démonstration `mail-1-demo-de.html`, également verbatim.
 *   • Tout le reste (en, es, nl, et de des mails 2 et 3) est une TRADUCTION, faite ici pour que
 *     les quatre autres langues ne régressent pas vers un e-mail français. Le fond, les
 *     promesses et les mentions légales sont identiques ; la plume mérite une relecture.
 *
 * ⛔ UNE SEULE CORRECTION DE FOND sur le texte du designer : la mention « (heure de Paris) » de
 * la 2ᵉ condition du mail 1 — « (Pariser Zeit) » dans la démonstration allemande — est retirée.
 * Elle contredisait la raison d'être de l'échéance à 11:59:59 UTC : le bon est valable la
 * journée annoncée ENTIÈRE partout dans le monde. Annoncer « heure de Paris » à un lecteur de
 * Los Angeles lui fait croire que son bon meurt à 14 h 59 chez lui.
 *
 * Marques de remplacement : `{code}` `{date}` `{amount}` `{min}` `{signupDate}` `{contact}`
 * `{betterDeal}` `{price}` `{priceWithVoucher}` `{score}` `{count}`.
 */

/** Une condition en puce : la partie en gras, puis la suite. Pas de balisage dans les textes. */
export interface Bullet {
  strong: string
  rest: string
}

export interface Mail1Strings {
  subject: string
  docTitle: string
  preheader: string
  /** Suit immédiatement le montant géant : « 15 € » + « offerts sur votre première œuvre ». */
  heroH2: string
  heroSub: string
  codeValidity: string
  cta: string
  ctaFine: string
  productEyebrow: string
  productLink: string
  cond: [Bullet, Bullet, Bullet]
  materials: string
}

export interface Question {
  title: string
  body: string
  /** Lien de fin de bloc. Absent = pas de lien. */
  link?: string
}

export interface Mail2Strings {
  subject: string
  docTitle: string
  preheader: string
  band: string
  h1: string
  intro: string
  questions: [Question, Question, Question]
  bestEyebrow: string
  cta: string
  ctaFine: string
  trustpilot: string
}

export interface Mail3Strings {
  subject: string
  docTitle: string
  preheader: string
  eyebrow: string
  h1: string
  intro: string
  codeValidity: string
  cta: string
  ctaFine: string
  productEyebrow: string
  productLink: string
  honesty: Bullet
  lastWord: string
}

export interface CommonStrings {
  /** « 129 € — soit 114 € avec votre bon » */
  productPrice: string
}

export interface FooterStrings {
  context: string
  privacy: string
  unsubscribe: string
  tagline: string
  legal: string
  reply: string
}

export interface UnsubscribePageStrings {
  title: string
  body: string
  button: string
  done: string
  doneBody: string
}

type Pack = {
  common: CommonStrings
  mail1: Mail1Strings
  mail2: Mail2Strings
  mail3: Mail3Strings
  footer: FooterStrings
  unsubscribePage: UnsubscribePageStrings
}

// --- Français — texte du designer, verbatim ------------------------------------------------

const fr: Pack = {
  common: { productPrice: '{price} — soit {priceWithVoucher} avec votre bon' },
  mail1: {
    subject: 'Votre bon de {amount} — code {code}',
    docTitle: 'Votre bon de {amount}',
    preheader: 'Votre code {code}, valable jusqu’au {date}, dès {min} d’achat.',
    heroH2: 'offerts sur votre première œuvre',
    heroSub: 'Merci. Votre code est juste en dessous — un clic suffit à l’appliquer.',
    codeValidity: 'Valable jusqu’au {date} inclus',
    cta: 'Utiliser mon bon de {amount}',
    ctaFine:
      'Le code est normalement déjà inscrit à la caisse. S’il n’y est pas, saisissez-le : il est juste au-dessus.',
    productEyebrow: 'Vous regardiez',
    productLink: 'Revoir cette œuvre',
    cond: [
      { strong: 'Dès {min} d’achat', rest: ', hors frais de livraison' },
      // ⛔ « (heure de Paris) » retiré — voir l'en-tête de ce fichier.
      { strong: 'Utilisable une seule fois', rest: ' — jusqu’au {date} inclus' },
      { strong: 'Non cumulable', rest: ' : la remise la plus avantageuse s’applique' },
    ],
    materials: 'Toile 285 g · Encres archival 75 ans · Cadre bois massif',
  },
  mail2: {
    subject: 'Le plus dur, ce n’est pas le prix',
    docTitle: 'Le plus dur, ce n’est pas le prix',
    preheader: 'Poster ou toile, quel cadre, et l’aperçu 3D pour voir avant de commander.',
    band: 'VOTRE BON DE {amount} EST TOUJOURS ACTIF',
    h1: 'Le plus dur, ce n’est pas le prix.',
    intro:
      'C’est de savoir ce qui ira sur ce mur-là. Trois questions reviennent tout le temps — voici nos réponses, en trois minutes.',
    questions: [
      {
        title: 'Poster ou toile ?',
        body: 'Le poster est un tirage photo encadré sous verre : net, graphique, parfait en petit et moyen format. La toile est tendue sur châssis, 285 g, sans reflet — c’est elle qui tient les grands murs.',
        link: 'Comparer les deux',
      },
      {
        title: 'Quel cadre ?',
        body: 'Toile : caisse américaine blanc, noir mat, argent ancien, chêne clair ou noyer — ou sans cadre. Poster : blanc, noir mat, chêne clair ou noyer, sous verre — ou sans cadre. En cas d’hésitation : le chêne clair s’accorde à presque tout. L’option contour blanc ajoute une marge autour de l’image, comme un accrochage de galerie.',
      },
      {
        title: 'Et sur mon mur, ça donne quoi ?',
        body: 'Chaque œuvre a un aperçu 3D : vous la faites pivoter, vous voyez le cadre en perspective et le reflet du verre. C’est le plus proche du réel avant de commander.',
        link: 'Essayer l’aperçu 3D',
      },
    ],
    // « cette semaine » chez le designer. Le tri de Shopify (BEST_SELLING) ne porte pas sur une
    // semaine : annoncer une période qu'on ne mesure pas est le genre de petite fausseté que ce
    // dispositif s'interdit partout ailleurs.
    bestEyebrow: 'Les plus choisies en ce moment',
    cta: 'Choisir mon œuvre',
    ctaFine:
      'Votre bon reste valable jusqu’au {date} inclus. Dès {min} d’achat, utilisable une seule fois.',
    trustpilot: '{score} / 5 — {count} retours vérifiés sur Trustpilot',
  },
  mail3: {
    subject: 'Vos {amount} s’arrêtent le {date}',
    docTitle: 'Vos {amount} s’arrêtent le {date}',
    preheader: 'Le code {code} expire le {date}. Il n’est pas reconduit.',
    eyebrow: 'Dernier rappel',
    h1: 'Vos {amount} s’arrêtent le {date}.',
    intro:
      'Passé cette date-là, le code cesse de fonctionner. C’est un bon nominatif, utilisable une seule fois, et il n’est pas reconduit.',
    codeValidity: 'Dernier jour : {date}',
    cta: 'Utiliser mes {amount} maintenant',
    ctaFine: 'Dès {min} d’achat, hors livraison. Utilisable une seule fois.',
    productEyebrow: 'L’œuvre que vous regardiez',
    productLink: 'Revoir cette œuvre',
    honesty: {
      strong: 'Un point d’honnêteté :',
      rest: ' au-delà de {betterDeal} de panier, la promotion en cours est plus avantageuse que le bon. Dans ce cas, gardez votre argent plutôt que votre code — c’est la meilleure remise qui s’applique.',
    },
    lastWord:
      'C’est le dernier e-mail que nous vous envoyons à ce sujet. Après le {date}, le code cesse simplement de fonctionner — il n’est pas reconduit.',
  },
  footer: {
    context:
      'Vous recevez cet e-mail parce que vous avez demandé un bon de {amount} sur myselfmonart.com le {signupDate}.',
    privacy: 'Politique de confidentialité',
    unsubscribe: 'Se désabonner',
    tagline: 'MyselfMonArt — direction artistique à Paris, service client à Toulouse.',
    legal: 'Mentions légales',
    reply: 'Une question ? Répondez à cet e-mail : il arrive chez {contact}.',
  },
  unsubscribePage: {
    title: 'Ne plus recevoir nos e-mails',
    body: 'Confirmez ci-dessous et nous ne vous écrirons plus au sujet de ce bon.',
    button: 'Confirmer mon désabonnement',
    done: 'C’est fait',
    doneBody: 'Vous ne recevrez plus nos e-mails. Merci d’avoir pris le temps de nous le dire.',
  },
}

// --- Anglais -------------------------------------------------------------------------------

const en: Pack = {
  common: { productPrice: '{price} — {priceWithVoucher} with your voucher' },
  mail1: {
    subject: 'Your {amount} voucher — code {code}',
    docTitle: 'Your {amount} voucher',
    preheader: 'Your code {code}, valid until {date}, on orders from {min}.',
    heroH2: 'off your first artwork',
    heroSub: 'Thank you. Your code is right below — one click applies it.',
    codeValidity: 'Valid until {date} inclusive',
    cta: 'Use my {amount} voucher',
    ctaFine:
      'The code is normally already filled in at checkout. If it is not, enter it — it is just above.',
    productEyebrow: 'You were looking at',
    productLink: 'See this artwork again',
    cond: [
      { strong: 'On orders from {min}', rest: ', excluding shipping' },
      { strong: 'Single use', rest: ' — until {date} inclusive' },
      { strong: 'Not combinable', rest: ' : the better discount always applies' },
    ],
    materials: '285 g canvas · 75-year archival inks · Solid wood frame',
  },
  mail2: {
    subject: 'The hard part is not the price',
    docTitle: 'The hard part is not the price',
    preheader: 'Poster or canvas, which frame, and the 3D preview to see before you order.',
    band: 'YOUR {amount} VOUCHER IS STILL ACTIVE',
    h1: 'The hard part is not the price.',
    intro:
      'It is knowing what belongs on that particular wall. Three questions come up every time — here are our answers, in three minutes.',
    questions: [
      {
        title: 'Poster or canvas?',
        body: 'The poster is a photographic print framed under glass: crisp, graphic, perfect in small and medium formats. The canvas is stretched on a frame, 285 g, glare-free — it is the one that holds large walls.',
        link: 'Compare the two',
      },
      {
        title: 'Which frame?',
        body: 'Canvas: floater frame in white, matte black, antique silver, light oak or walnut — or no frame. Poster: white, matte black, light oak or walnut, under glass — or no frame. If in doubt: light oak goes with almost everything. The white border option adds a margin around the image, like a gallery hang.',
      },
      {
        title: 'And on my wall, how does it look?',
        body: 'Every artwork has a 3D preview: you rotate it, you see the frame in perspective and the reflection on the glass. It is the closest thing to the real piece before ordering.',
        link: 'Try the 3D preview',
      },
    ],
    bestEyebrow: 'Most chosen right now',
    cta: 'Choose my artwork',
    ctaFine: 'Your voucher remains valid until {date} inclusive. On orders from {min}, single use.',
    trustpilot: '{score} / 5 — {count} verified reviews on Trustpilot',
  },
  mail3: {
    subject: 'Your {amount} ends on {date}',
    docTitle: 'Your {amount} ends on {date}',
    preheader: 'Code {code} expires on {date}. It will not be renewed.',
    eyebrow: 'Final reminder',
    h1: 'Your {amount} ends on {date}.',
    intro:
      'After that date, the code stops working. It is a personal voucher, usable once, and it will not be renewed.',
    codeValidity: 'Last day: {date}',
    cta: 'Use my {amount} now',
    ctaFine: 'On orders from {min}, excluding shipping. Single use.',
    productEyebrow: 'The artwork you were looking at',
    productLink: 'See this artwork again',
    honesty: {
      strong: 'One honest note:',
      rest: ' above {betterDeal} in your basket, the current promotion beats the voucher. In that case, keep your money rather than your code — the better discount is the one that applies.',
    },
    lastWord:
      'This is the last email we will send about this. After {date}, the code simply stops working — it will not be renewed.',
  },
  footer: {
    context:
      'You are receiving this email because you requested a {amount} voucher on myselfmonart.com on {signupDate}.',
    privacy: 'Privacy policy',
    unsubscribe: 'Unsubscribe',
    tagline: 'MyselfMonArt — art direction in Paris, customer service in Toulouse.',
    legal: 'Legal notice',
    reply: 'A question? Reply to this email: it reaches {contact}.',
  },
  unsubscribePage: {
    title: 'Stop receiving our emails',
    body: 'Confirm below and we will stop writing to you about this voucher.',
    button: 'Confirm my unsubscribe',
    done: 'Done',
    doneBody: 'You will not receive our emails any more. Thank you for telling us.',
  },
}

// --- Allemand — mail 1 verbatim de la démonstration du designer -----------------------------

const de: Pack = {
  common: { productPrice: '{price} — mit Ihrem Gutschein {priceWithVoucher}' },
  mail1: {
    subject: 'Ihr Gutschein über {amount} — Code {code}',
    docTitle: 'Ihr Gutschein über {amount}',
    preheader: 'Ihr Code {code}, gültig bis zum {date}, ab {min} Einkaufswert.',
    heroH2: 'geschenkt auf Ihr erstes Kunstwerk',
    heroSub: 'Vielen Dank. Ihr Code steht direkt darunter — ein Klick genügt, um ihn anzuwenden.',
    codeValidity: 'Gültig bis einschließlich {date}',
    cta: 'Meinen Gutschein über {amount} einlösen',
    ctaFine:
      'Der Code ist an der Kasse normalerweise schon eingetragen. Falls nicht, geben Sie ihn einfach ein — er steht direkt darüber.',
    productEyebrow: 'Das haben Sie sich angesehen',
    productLink: 'Dieses Kunstwerk ansehen',
    cond: [
      { strong: 'Ab {min} Einkaufswert', rest: ', ohne Versandkosten' },
      // ⛔ « (Pariser Zeit) » retiré — voir l'en-tête de ce fichier.
      { strong: 'Nur einmal verwendbar', rest: ' — bis einschließlich {date}' },
      {
        strong: 'Nicht mit anderen Rabatten kombinierbar',
        rest: ' : es gilt immer der günstigste Preis',
      },
    ],
    materials: 'Leinwand 285 g · Archivtinten 75 Jahre · Rahmen aus Massivholz',
  },
  mail2: {
    subject: 'Das Schwierigste ist nicht der Preis',
    docTitle: 'Das Schwierigste ist nicht der Preis',
    preheader: 'Poster oder Leinwand, welcher Rahmen, und die 3D-Vorschau vor der Bestellung.',
    band: 'IHR GUTSCHEIN ÜBER {amount} IST WEITERHIN AKTIV',
    h1: 'Das Schwierigste ist nicht der Preis.',
    intro:
      'Sondern zu wissen, was an genau diese Wand gehört. Drei Fragen kommen immer wieder — hier sind unsere Antworten, in drei Minuten.',
    questions: [
      {
        title: 'Poster oder Leinwand?',
        body: 'Das Poster ist ein Fotodruck, gerahmt hinter Glas: klar, grafisch, ideal im kleinen und mittleren Format. Die Leinwand ist auf einen Keilrahmen gespannt, 285 g, reflexionsfrei — sie trägt die großen Wände.',
        link: 'Beide vergleichen',
      },
      {
        title: 'Welcher Rahmen?',
        body: 'Leinwand: Schattenfugenrahmen in Weiß, Mattschwarz, Altsilber, heller Eiche oder Nussbaum — oder ohne Rahmen. Poster: Weiß, Mattschwarz, helle Eiche oder Nussbaum, hinter Glas — oder ohne Rahmen. Im Zweifel: helle Eiche passt zu fast allem. Die Option weißer Rand fügt einen Abstand um das Bild hinzu, wie bei einer Galeriehängung.',
      },
      {
        title: 'Und an meiner Wand, wie wirkt das?',
        body: 'Jedes Kunstwerk hat eine 3D-Vorschau: Sie drehen es, Sie sehen den Rahmen perspektivisch und die Spiegelung des Glases. Näher kommt man dem Original vor der Bestellung nicht.',
        link: '3D-Vorschau ausprobieren',
      },
    ],
    bestEyebrow: 'Aktuell am häufigsten gewählt',
    cta: 'Mein Kunstwerk wählen',
    ctaFine:
      'Ihr Gutschein bleibt bis einschließlich {date} gültig. Ab {min} Einkaufswert, nur einmal verwendbar.',
    trustpilot: '{score} / 5 — {count} geprüfte Bewertungen auf Trustpilot',
  },
  mail3: {
    subject: 'Ihre {amount} enden am {date}',
    docTitle: 'Ihre {amount} enden am {date}',
    preheader: 'Der Code {code} läuft am {date} ab. Er wird nicht verlängert.',
    eyebrow: 'Letzte Erinnerung',
    h1: 'Ihre {amount} enden am {date}.',
    intro:
      'Nach diesem Datum funktioniert der Code nicht mehr. Es ist ein persönlicher Gutschein, einmal verwendbar, und er wird nicht verlängert.',
    codeValidity: 'Letzter Tag: {date}',
    cta: 'Meine {amount} jetzt einlösen',
    ctaFine: 'Ab {min} Einkaufswert, ohne Versand. Nur einmal verwendbar.',
    productEyebrow: 'Das Kunstwerk, das Sie sich angesehen haben',
    productLink: 'Dieses Kunstwerk ansehen',
    honesty: {
      strong: 'Ein Wort der Ehrlichkeit:',
      rest: ' ab {betterDeal} Warenkorbwert ist die laufende Aktion günstiger als der Gutschein. Behalten Sie dann lieber Ihr Geld als Ihren Code — es gilt immer der bessere Rabatt.',
    },
    lastWord:
      'Dies ist die letzte E-Mail, die wir Ihnen dazu schicken. Nach dem {date} funktioniert der Code einfach nicht mehr — er wird nicht verlängert.',
  },
  footer: {
    context:
      'Sie erhalten diese E-Mail, weil Sie am {signupDate} auf myselfmonart.com einen Gutschein über {amount} angefordert haben.',
    privacy: 'Datenschutzerklärung',
    unsubscribe: 'Abmelden',
    tagline: 'MyselfMonArt — Art Direction in Paris, Kundenservice in Toulouse.',
    legal: 'Impressum',
    reply: 'Fragen? Antworten Sie einfach auf diese E-Mail: sie erreicht {contact}.',
  },
  unsubscribePage: {
    title: 'Unsere E-Mails abbestellen',
    body: 'Bestätigen Sie unten, und wir schreiben Ihnen nicht mehr zu diesem Gutschein.',
    button: 'Abmeldung bestätigen',
    done: 'Erledigt',
    doneBody: 'Sie erhalten unsere E-Mails nicht mehr. Danke für Ihre Rückmeldung.',
  },
}

// --- Espagnol ------------------------------------------------------------------------------

const es: Pack = {
  common: { productPrice: '{price} — {priceWithVoucher} con su vale' },
  mail1: {
    subject: 'Su vale de {amount} — código {code}',
    docTitle: 'Su vale de {amount}',
    preheader: 'Su código {code}, válido hasta el {date}, a partir de {min} de compra.',
    heroH2: 'de regalo en su primera obra',
    heroSub: 'Gracias. Su código está justo debajo — basta un clic para aplicarlo.',
    codeValidity: 'Válido hasta el {date} incluido',
    cta: 'Usar mi vale de {amount}',
    ctaFine:
      'El código normalmente ya aparece en la caja. Si no está, introdúzcalo: está justo arriba.',
    productEyebrow: 'Estaba viendo',
    productLink: 'Volver a ver esta obra',
    cond: [
      { strong: 'A partir de {min} de compra', rest: ', sin incluir los gastos de envío' },
      { strong: 'Un solo uso', rest: ' — hasta el {date} incluido' },
      { strong: 'No acumulable', rest: ' : se aplica siempre el mejor descuento' },
    ],
    materials: 'Lienzo 285 g · Tintas archival 75 años · Marco de madera maciza',
  },
  mail2: {
    subject: 'Lo difícil no es el precio',
    docTitle: 'Lo difícil no es el precio',
    preheader: 'Póster o lienzo, qué marco, y la vista 3D para verlo antes de pedir.',
    band: 'SU VALE DE {amount} SIGUE ACTIVO',
    h1: 'Lo difícil no es el precio.',
    intro:
      'Es saber qué va en esa pared concreta. Tres preguntas se repiten siempre — aquí están nuestras respuestas, en tres minutos.',
    questions: [
      {
        title: '¿Póster o lienzo?',
        body: 'El póster es una impresión fotográfica enmarcada bajo cristal: nítida, gráfica, perfecta en formato pequeño y mediano. El lienzo va tensado sobre bastidor, 285 g, sin reflejos — es el que aguanta las paredes grandes.',
        link: 'Comparar los dos',
      },
      {
        title: '¿Qué marco?',
        body: 'Lienzo: marco flotante en blanco, negro mate, plata envejecida, roble claro o nogal — o sin marco. Póster: blanco, negro mate, roble claro o nogal, bajo cristal — o sin marco. En caso de duda: el roble claro combina con casi todo. La opción de borde blanco añade un margen alrededor de la imagen, como en una galería.',
      },
      {
        title: 'Y en mi pared, ¿cómo queda?',
        body: 'Cada obra tiene una vista 3D: la gira, ve el marco en perspectiva y el reflejo del cristal. Es lo más parecido a la realidad antes de pedir.',
        link: 'Probar la vista 3D',
      },
    ],
    bestEyebrow: 'Las más elegidas ahora mismo',
    cta: 'Elegir mi obra',
    ctaFine:
      'Su vale sigue siendo válido hasta el {date} incluido. A partir de {min} de compra, un solo uso.',
    trustpilot: '{score} / 5 — {count} opiniones verificadas en Trustpilot',
  },
  mail3: {
    subject: 'Sus {amount} terminan el {date}',
    docTitle: 'Sus {amount} terminan el {date}',
    preheader: 'El código {code} caduca el {date}. No se renueva.',
    eyebrow: 'Último recordatorio',
    h1: 'Sus {amount} terminan el {date}.',
    intro:
      'Pasada esa fecha, el código deja de funcionar. Es un vale nominativo, de un solo uso, y no se renueva.',
    codeValidity: 'Último día: {date}',
    cta: 'Usar mis {amount} ahora',
    ctaFine: 'A partir de {min} de compra, sin incluir el envío. Un solo uso.',
    productEyebrow: 'La obra que estaba viendo',
    productLink: 'Volver a ver esta obra',
    honesty: {
      strong: 'Un apunte de honestidad:',
      rest: ' por encima de {betterDeal} de carrito, la promoción en curso es más ventajosa que el vale. En ese caso, quédese con su dinero antes que con su código — se aplica siempre el mejor descuento.',
    },
    lastWord:
      'Este es el último correo que le enviamos sobre esto. Después del {date}, el código simplemente deja de funcionar — no se renueva.',
  },
  footer: {
    context:
      'Recibe este correo porque solicitó un vale de {amount} en myselfmonart.com el {signupDate}.',
    privacy: 'Política de privacidad',
    unsubscribe: 'Darse de baja',
    tagline: 'MyselfMonArt — dirección artística en París, atención al cliente en Toulouse.',
    legal: 'Aviso legal',
    reply: '¿Una pregunta? Responda a este correo: llega a {contact}.',
  },
  unsubscribePage: {
    title: 'Dejar de recibir nuestros correos',
    body: 'Confirme abajo y dejaremos de escribirle sobre este vale.',
    button: 'Confirmar mi baja',
    done: 'Hecho',
    doneBody: 'Ya no recibirá nuestros correos. Gracias por decírnoslo.',
  },
}

// --- Néerlandais ---------------------------------------------------------------------------

const nl: Pack = {
  common: { productPrice: '{price} — {priceWithVoucher} met uw waardebon' },
  mail1: {
    subject: 'Uw waardebon van {amount} — code {code}',
    docTitle: 'Uw waardebon van {amount}',
    preheader: 'Uw code {code}, geldig tot {date}, vanaf {min} aankoop.',
    heroH2: 'cadeau op uw eerste kunstwerk',
    heroSub: 'Bedankt. Uw code staat er vlak onder — één klik volstaat om hem toe te passen.',
    codeValidity: 'Geldig tot en met {date}',
    cta: 'Mijn waardebon van {amount} gebruiken',
    ctaFine:
      'De code staat bij het afrekenen normaal al ingevuld. Zo niet, voer hem in: hij staat er vlak boven.',
    productEyebrow: 'U keek naar',
    productLink: 'Dit kunstwerk terugzien',
    cond: [
      { strong: 'Vanaf {min} aankoop', rest: ', exclusief verzendkosten' },
      { strong: 'Eenmalig te gebruiken', rest: ' — tot en met {date}' },
      { strong: 'Niet combineerbaar', rest: ' : de voordeligste korting geldt' },
    ],
    materials: 'Canvas 285 g · Archivalinkt 75 jaar · Lijst van massief hout',
  },
  mail2: {
    subject: 'Het moeilijkste is niet de prijs',
    docTitle: 'Het moeilijkste is niet de prijs',
    preheader: 'Poster of canvas, welke lijst, en de 3D-weergave om het vooraf te zien.',
    band: 'UW WAARDEBON VAN {amount} IS NOG ACTIEF',
    h1: 'Het moeilijkste is niet de prijs.',
    intro:
      'Het is weten wat aan díé muur hoort. Drie vragen komen altijd terug — hier zijn onze antwoorden, in drie minuten.',
    questions: [
      {
        title: 'Poster of canvas?',
        body: 'De poster is een fotoafdruk, ingelijst achter glas: scherp, grafisch, perfect in klein en middelgroot formaat. Het canvas is gespannen op een frame, 285 g, zonder reflectie — dat is wat grote muren draagt.',
        link: 'Beide vergelijken',
      },
      {
        title: 'Welke lijst?',
        body: 'Canvas: schaduwlijst in wit, mat zwart, oud zilver, licht eiken of noten — of zonder lijst. Poster: wit, mat zwart, licht eiken of noten, achter glas — of zonder lijst. Bij twijfel: licht eiken past bij bijna alles. De optie witte rand voegt een marge rond het beeld toe, als in een galerie.',
      },
      {
        title: 'En op mijn muur, hoe oogt dat?',
        body: 'Elk kunstwerk heeft een 3D-weergave: u draait het, u ziet de lijst in perspectief en de weerspiegeling van het glas. Dichter bij het echte werk komt u niet vóór het bestellen.',
        link: 'De 3D-weergave proberen',
      },
    ],
    bestEyebrow: 'Op dit moment het vaakst gekozen',
    cta: 'Mijn kunstwerk kiezen',
    ctaFine:
      'Uw waardebon blijft geldig tot en met {date}. Vanaf {min} aankoop, eenmalig te gebruiken.',
    trustpilot: '{score} / 5 — {count} geverifieerde beoordelingen op Trustpilot',
  },
  mail3: {
    subject: 'Uw {amount} stopt op {date}',
    docTitle: 'Uw {amount} stopt op {date}',
    preheader: 'De code {code} verloopt op {date}. Hij wordt niet verlengd.',
    eyebrow: 'Laatste herinnering',
    h1: 'Uw {amount} stopt op {date}.',
    intro:
      'Na die datum werkt de code niet meer. Het is een persoonlijke waardebon, eenmalig te gebruiken, en hij wordt niet verlengd.',
    codeValidity: 'Laatste dag: {date}',
    cta: 'Mijn {amount} nu gebruiken',
    ctaFine: 'Vanaf {min} aankoop, exclusief verzending. Eenmalig te gebruiken.',
    productEyebrow: 'Het kunstwerk waar u naar keek',
    productLink: 'Dit kunstwerk terugzien',
    honesty: {
      strong: 'Even eerlijk:',
      rest: ' boven {betterDeal} winkelwagen is de lopende actie voordeliger dan de waardebon. Houd in dat geval uw geld in plaats van uw code — de beste korting is degene die geldt.',
    },
    lastWord:
      'Dit is de laatste e-mail die we hierover sturen. Na {date} werkt de code eenvoudigweg niet meer — hij wordt niet verlengd.',
  },
  footer: {
    context:
      'U ontvangt deze e-mail omdat u op {signupDate} een waardebon van {amount} hebt aangevraagd op myselfmonart.com.',
    privacy: 'Privacybeleid',
    unsubscribe: 'Uitschrijven',
    tagline: 'MyselfMonArt — artistieke leiding in Parijs, klantenservice in Toulouse.',
    legal: 'Juridische informatie',
    reply: 'Een vraag? Beantwoord deze e-mail: hij komt aan bij {contact}.',
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
