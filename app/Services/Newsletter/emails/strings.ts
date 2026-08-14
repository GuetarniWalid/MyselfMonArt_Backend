import type { NewsletterLocale } from '../config'

/**
 * Les textes des trois e-mails, dans les cinq langues.
 *
 * UN SEUL GABARIT PAR E-MAIL (voir `template.ts`), cinq jeux de chaînes. Jamais quinze
 * gabarits : à la première correction de mise en page, quatorze copies dérivent, et la
 * quinzième part quand même.
 *
 * ⚠️ PROVENANCE DES TEXTES, à savoir avant de les relire :
 *   • `fr` est la LANGUE SOURCE. Le texte du designer (recopié verbatim de `emails/mail-*.html`)
 *     a été entièrement réécrit : le propriétaire ne s'y reconnaissait pas, et la remise y
 *     tenait la place de l'argument alors qu'elle pèse ~10 % d'un panier moyen à 154 €.
 *   • Les quatre autres langues sont LOCALISÉES depuis `fr`, pas traduites mot à mot : le fond,
 *     les promesses et les mentions légales sont identiques, la plume est refaite dans la langue.
 *
 * ⛔ CE QUE LA RÉÉCRITURE NE DOIT JAMAIS REPERDRE — chaque point a coûté une correction :
 *   • La mention « (heure de Paris) » du designer est retirée pour de bon. Elle contredisait la
 *     raison d'être de l'échéance à 11:59:59 UTC : le bon vaut la journée annoncée ENTIÈRE
 *     partout. Annoncée à un lecteur de Los Angeles, elle lui fait croire qu'il meurt à 14 h 59.
 *   • `{date}` rend l'ANNÉE (« 12 septembre 2026 », 17 signes). Les champs courts — `codeValidity`
 *     à 32 signes, le titre 36 px du mail 3 — se comptent sur ce rendu-là, pas sur « 12 sept. ».
 *   • Les montants se comptent au PIRE CAS de devise : « 20 $CA » et « 130 $CA » sont plus larges
 *     que « 15 € » et « 80 € ». Un libellé de bouton juste en euros peut passer à deux lignes en
 *     dollars canadiens.
 *   • Le mot « prix » n'apparaît plus nulle part, et « remise » non plus. Nier le prix, c'est
 *     l'installer : l'ancien titre du mail 2 était « Le plus dur, ce n'est pas le prix. »
 *
 * ⛔ Le pire cas de longueur n'est PAS le français. L'allemand compose (« Einkaufswert »,
 * « Gutschein ») et déborde là où le français passait : c'est la langue à recompter en premier
 * quand un champ bouge.
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

// --- Français — langue source -----------------------------------------------------------

const fr: Pack = {
  common: { productPrice: '{price} · {priceWithVoucher} avec votre code' },
  mail1: {
    subject: 'Votre code {code} et vos {amount} offerts',
    docTitle: 'Vos {amount} offerts',
    preheader: 'Code {code}, jusqu’au {date}, dès {min}. Votre œuvre sera faite pour vous.',
    heroH2: 'offerts sur l’œuvre que vous choisirez',
    heroSub:
      'Merci. Votre code est juste en dessous. Il ne sert qu’une fois : réservez-le à l’œuvre qui vous plaît.',
    codeValidity: 'Jusqu’au {date} inclus',
    cta: 'Voir les œuvres avec mes {amount}',
    ctaFine:
      'Le code s’applique tout seul en passant par ce bouton. Vous le retrouvez juste au-dessus si vous préférez le saisir à la main.',
    productEyebrow: 'Vous la regardiez',
    productLink: 'La revoir de plus près',
    cond: [
      { strong: 'À partir de {min}', rest: ' d’achat, livraison non comprise' },
      // ⛔ « (heure de Paris) » retiré — voir l'en-tête de ce fichier.
      { strong: 'Utilisable une seule fois', rest: ', jusqu’au {date} inclus' },
      { strong: 'Non cumulable', rest: ' : vous gardez toujours le meilleur des deux' },
    ],
    materials: 'Fabriquée à la commande · Toile 285 g · Cadre bois massif',
  },
  mail2: {
    subject: 'Poster ou toile, quel cadre, et ce que ça donne',
    docTitle: 'Poster ou toile, quel cadre, et ce que ça donne',
    preheader:
      'Nos réponses aux trois questions qui reviennent, et l’aperçu 3D pour voir avant de commander.',
    band: 'VOTRE CODE DE {amount} EST TOUJOURS LÀ',
    h1: 'Un mur vide, ça se regarde longtemps.',
    intro:
      'On n’accroche pas la première chose venue au-dessus d’un canapé. Trois questions reviennent avant de commander. Voici nos réponses.',
    questions: [
      {
        title: 'Poster ou toile ?',
        body: 'Le poster est un tirage sous verre. Net et léger, très à l’aise en petit et moyen format. La toile, elle, est tendue sur châssis, 285 g. Pas de verre, donc pas de reflet : une matière un peu vivante, qui prend la lumière du soir. C’est elle qui tient les grands murs. Dans les deux cas, les encres tiennent 75 ans.',
        link: 'Voir les matières',
      },
      {
        title: 'Et le cadre ?',
        body: 'Personne ne choisit un cadre de tête. Cinq finitions sur la toile, quatre sur le poster, et l’option sans cadre. Dans le doute, prenez le chêne clair : il s’accorde à presque tout. Le bois est massif, pas du placage. Et le contour blanc pose une marge autour de l’image, comme un accrochage de galerie.',
      },
      {
        title: 'Sur mon mur, ça donne quoi ?',
        body: 'Chaque œuvre a un aperçu 3D. Vous la faites pivoter, vous voyez le cadre en perspective et le reflet du verre. C’est ce qui se rapproche le plus du vrai avant de commander. Au-dessus du canapé ou dans l’entrée, on sait tout de suite si la taille est juste. Prenez le temps, rien ne se déclenche.',
        link: 'Ouvrir l’aperçu 3D',
      },
    ],
    // « cette semaine » chez le designer. Le tri de Shopify (BEST_SELLING) ne porte pas sur une
    // semaine : annoncer une période qu'on ne mesure pas est le genre de petite fausseté que ce
    // dispositif s'interdit partout ailleurs.
    bestEyebrow: 'Les plus choisies en ce moment',
    cta: 'Choisir mon œuvre',
    ctaFine: 'Votre code reste valable jusqu’au {date} inclus, dès {min} d’achat, une seule fois.',
    trustpilot: '{score} / 5 sur Trustpilot, {count} retours vérifiés',
  },
  mail3: {
    subject: 'Votre code de {amount} s’arrête le {date}',
    docTitle: 'Votre code de {amount} s’arrête le {date}',
    preheader: 'Le code {code} fonctionne jusqu’au {date}. Après, l’œuvre reste, le code non.',
    eyebrow: 'Dernier message',
    h1: 'Le {date}, ce code de {amount} s’éteint.',
    intro:
      'L’œuvre, elle, ne va nulle part. Elle sera fabriquée le jour où vous la choisirez, pour ce mur-là. Le code ne se prolonge pas : nominatif, une seule fois.',
    codeValidity: 'Jusqu’au {date}',
    cta: 'La choisir avec mes {amount}',
    ctaFine: 'Dès {min} d’achat, hors livraison, et une seule fois.',
    productEyebrow: 'Celle que vous regardiez',
    productLink: 'Aller la revoir',
    honesty: {
      strong: 'Ici, vous ne perdez jamais :',
      rest: ' au-delà de {betterDeal} de panier, l’offre du moment fait mieux que votre code. Elle s’applique alors à sa place, sans que vous ayez rien à faire. On préfère vous le dire plutôt que vous laisser calculer.',
    },
    lastWord:
      'C’est le dernier e-mail que nous vous envoyons à ce sujet. Après le {date}, le code s’arrête et vous n’entendrez plus parler de lui. Nous, on reste là si vous avez une question.',
  },
  footer: {
    context:
      'Vous recevez cet e-mail parce que vous avez demandé un code de {amount} sur myselfmonart.com le {signupDate}.',
    privacy: 'Politique de confidentialité',
    unsubscribe: 'Se désabonner',
    tagline: 'MyselfMonArt — direction artistique à Paris, service client à Toulouse.',
    legal: 'Mentions légales',
    reply: 'Une question ? Répondez à cet e-mail : il arrive chez {contact}, et on vous répond.',
  },
  unsubscribePage: {
    title: 'Ne plus recevoir nos e-mails',
    body: 'Confirmez ci-dessous, et nous ne vous écrirons plus au sujet de ce code.',
    button: 'Oui, me désabonner',
    done: 'C’est fait',
    doneBody:
      'Vous ne recevrez plus rien de notre part. Merci de nous l’avoir dit plutôt que de nous laisser insister.',
  },
}

// --- Anglais --------------------------------------------------------------------------------

const en: Pack = {
  common: { productPrice: '{price} · {priceWithVoucher} with your code' },
  mail1: {
    subject: 'Your {amount} voucher is here — code {code}',
    docTitle: 'Your {amount} voucher',
    preheader: 'Code {code}, good until {date}, from {min}. Your artwork will be made for you.',
    heroH2: 'towards the artwork you choose',
    heroSub:
      'Thank you. Your code is just below. It only works once, so save it for the one you really want.',
    codeValidity: 'Until {date}, inclusive',
    cta: 'See the artworks with my {amount}',
    ctaFine:
      'This button applies the code for you. You will also find it just above, if you would rather type it in yourself.',
    productEyebrow: 'You were looking at',
    productLink: 'Take a closer look',
    cond: [
      { strong: 'On orders from {min}', rest: ', shipping not included' },
      // ⛔ La mention d'heure du gabarit est retirée ici aussi — voir l'en-tête de ce fichier.
      { strong: 'One use only', rest: ', until {date}, inclusive' },
      { strong: 'Not combinable', rest: ': you always keep the better of the two' },
    ],
    materials: 'Made to order · 285 g canvas · Solid wood frame',
  },
  mail2: {
    subject: 'Poster or canvas, which frame, and how it looks',
    docTitle: 'Poster or canvas, which frame, and how it looks',
    preheader:
      'Our answers to the three questions that keep coming up, and the 3D preview before you order.',
    band: 'YOUR {amount} CODE IS STILL HERE',
    h1: 'A bare wall is something you live with.',
    intro:
      'You don’t hang just anything above a sofa. Three questions come up again and again before ordering. Here are our answers.',
    questions: [
      {
        title: 'Poster or canvas?',
        body: 'The poster is a print under glass. Crisp and light, very much at home in small and medium sizes. The canvas is stretched on a wooden frame, 285 g. No glass, so no reflection — a surface with some life in it, one that catches the evening light. That is the one for a large wall. Either way, the inks last 75 years.',
        link: 'See the materials',
      },
      {
        title: 'And the frame?',
        body: 'Nobody has a frame in mind to begin with. Five finishes on the canvas, four on the poster, plus the option of no frame. When in doubt, take the light oak — it sits well with almost anything. The wood is solid, not veneer. And the optional white border leaves a margin around the image, the way a gallery would hang it.',
      },
      {
        title: 'What will it look like on my wall?',
        body: 'Every artwork has a 3D preview. Turn it and you see the frame in perspective and the reflection on the glass. It is as close to the real thing as you can get before ordering. Above the sofa or in the hallway, you know immediately whether the size is right. Take your time — nothing happens until you say so.',
        link: 'Open the 3D preview',
      },
    ],
    bestEyebrow: 'Chosen most often right now',
    cta: 'Choose my artwork',
    ctaFine:
      'Your code is good until {date} inclusive, on orders from {min}, and can be used once.',
    trustpilot: '{score} / 5 on Trustpilot, {count} verified reviews',
  },
  mail3: {
    subject: 'Your {amount} voucher ends on {date}',
    docTitle: 'Your {amount} voucher ends on {date}',
    preheader: 'Code {code} works until {date}. The artwork stays; the code does not.',
    eyebrow: 'Last message',
    h1: 'On {date}, this {amount} voucher ends.',
    intro:
      'The artwork is not going anywhere. It will be made on the day you choose it, for that wall. The code is another matter: it is in your name, it works once, and it will not be extended.',
    codeValidity: 'Until {date}',
    cta: 'Choose it with my {amount}',
    ctaFine: 'On orders from {min}, shipping not included, and once only.',
    productEyebrow: 'The one you looked at',
    productLink: 'Have another look',
    honesty: {
      strong: 'You never lose out here:',
      rest: ' on an order above {betterDeal}, the offer running at the time does better than your code. It applies instead, on its own, with nothing for you to do. We would rather tell you than leave you to work it out.',
    },
    lastWord:
      'This is the last email we will send about this. After {date}, the code stops and you will hear nothing more about it. We are still here if you have a question.',
  },
  footer: {
    context:
      'You are receiving this email because you asked for a {amount} code on myselfmonart.com on {signupDate}.',
    privacy: 'Privacy policy',
    unsubscribe: 'Unsubscribe',
    tagline: 'MyselfMonArt — art direction in Paris, customer service in Toulouse.',
    legal: 'Legal notice',
    reply: 'A question? Reply to this email — it reaches {contact}, and you will get an answer.',
  },
  unsubscribePage: {
    title: 'Stop receiving our emails',
    body: 'Confirm below and we will stop writing to you about this code.',
    button: 'Yes, unsubscribe me',
    done: 'That’s done',
    doneBody:
      'You will not hear from us again. Thank you for saying so, rather than letting us keep writing.',
  },
}

// --- Allemand -------------------------------------------------------------------------------

const de: Pack = {
  common: { productPrice: '{price} · {priceWithVoucher} mit Ihrem Code' },
  mail1: {
    subject: 'Ihr Code {code} – {amount} geschenkt',
    docTitle: '{amount} geschenkt für das Werk Ihrer Wahl',
    preheader: 'Code {code}, bis zum {date}, ab {min}. Ihr Werk wird für Sie gefertigt.',
    heroH2: 'geschenkt für das Werk, das Sie wählen',
    heroSub:
      'Vielen Dank. Ihr Code steht direkt darunter. Er gilt nur einmal: Heben Sie ihn für das richtige Werk auf.',
    codeValidity: 'Bis einschließlich {date}',
    cta: 'Werke mit meinen {amount} ansehen',
    ctaFine:
      'Wenn Sie über diesen Button gehen, ist der Code schon eingetragen. Er steht auch oben, falls Sie ihn lieber selbst eintippen.',
    productEyebrow: 'Zuletzt angesehen',
    productLink: 'Aus der Nähe ansehen',
    cond: [
      { strong: 'Ab {min} Einkaufswert', rest: ', ohne Versandkosten' },
      // ⛔ La mention d'heure du gabarit est retirée ici aussi — voir l'en-tête de ce fichier.
      { strong: 'Nur einmal einlösbar', rest: ', bis einschließlich {date}' },
      { strong: 'Nicht kombinierbar', rest: ': Sie behalten immer das Bessere von beiden' },
    ],
    materials: 'Auf Bestellung gefertigt · Leinwand 285 g · Massivholzrahmen',
  },
  mail2: {
    subject: 'Poster oder Leinwand, welcher Rahmen, wie es wirkt',
    docTitle: 'Poster oder Leinwand, welcher Rahmen, wie es wirkt',
    preheader: 'Antworten auf die drei häufigsten Fragen – und die 3D-Vorschau vor der Bestellung.',
    band: 'IHR CODE ÜBER {amount} IST NOCH DA',
    h1: 'Eine leere Wand sieht man lange an.',
    intro:
      'Über das Sofa hängt man nicht das Erstbeste. Vor der Bestellung kommen immer dieselben drei Fragen. Hier sind unsere Antworten.',
    questions: [
      {
        title: 'Poster oder Leinwand?',
        body: 'Das Poster ist ein Druck hinter Glas: klar, leicht, im kleinen und mittleren Format zu Hause. Die Leinwand ist auf einen Keilrahmen gespannt, 285 g. Kein Glas, keine Spiegelung – eine Oberfläche, die lebt und das Abendlicht aufnimmt. Für große Wände ist sie gemacht. Die Tinten halten in beiden Fällen 75 Jahre.',
        link: 'Zu den Materialien',
      },
      {
        title: 'Und der Rahmen?',
        body: 'Welcher Rahmen passt, weiß vorher niemand genau. Auf der Leinwand gibt es fünf Ausführungen, beim Poster vier, dazu die Variante ohne Rahmen. Im Zweifel helle Eiche – sie passt zu fast allem. Das Holz ist massiv, kein Furnier. Und der weiße Rand, wenn Sie ihn wählen, lässt dem Bild Luft wie in einer Galerie.',
      },
      {
        title: 'Und an meiner Wand?',
        body: 'Jedes Werk hat eine 3D-Vorschau. Sie drehen es und sehen den Rahmen perspektivisch, dazu die Spiegelung im Glas. Näher kommt man dem Original vor der Bestellung nicht. Über dem Sofa oder im Flur merken Sie sofort, ob das Format stimmt. Lassen Sie sich Zeit, es passiert nichts.',
        link: '3D-Vorschau öffnen',
      },
    ],
    bestEyebrow: 'Zurzeit am häufigsten gewählt',
    cta: 'Mein Werk wählen',
    ctaFine: 'Ihr Code gilt bis einschließlich {date}, ab {min} Einkaufswert, nur einmal.',
    trustpilot: '{score} / 5 auf Trustpilot, {count} geprüfte Bewertungen',
  },
  mail3: {
    subject: 'Ihr Gutschein über {amount} endet am {date}',
    docTitle: 'Ihr Gutschein über {amount} endet am {date}',
    preheader: 'Der Code {code} gilt bis zum {date}. Danach bleibt das Werk, der Code nicht.',
    eyebrow: 'Letzte Nachricht',
    h1: '{date}: Ihr Gutschein über {amount} endet.',
    intro:
      'Das Werk bleibt, wo es ist. Gefertigt wird es erst, wenn Sie es wählen – für genau diese Wand. Der Code wird nicht verlängert: persönlich, nur einmal.',
    codeValidity: 'Gültig bis {date}',
    cta: 'Mein Werk mit {amount} wählen',
    ctaFine: 'Ab {min} Einkaufswert, ohne Versandkosten, nur einmal.',
    productEyebrow: 'Sie hatten es im Blick',
    productLink: 'Noch einmal ansehen',
    honesty: {
      strong: 'Bei uns verlieren Sie nie:',
      rest: ' Ab {betterDeal} im Warenkorb bringt Ihnen das aktuelle Angebot mehr als Ihr Code. Dann tritt es automatisch an seine Stelle, ohne dass Sie etwas tun müssen. Wir sagen es Ihnen lieber, als Sie rechnen zu lassen.',
    },
    lastWord:
      'Das ist die letzte E-Mail dazu. Nach dem {date} endet der Code, und Sie hören nichts mehr davon. Wir sind weiter da, wenn Sie eine Frage haben.',
  },
  footer: {
    context:
      'Sie erhalten diese E-Mail, weil Sie am {signupDate} auf myselfmonart.com einen Code über {amount} angefordert haben.',
    privacy: 'Datenschutzerklärung',
    unsubscribe: 'Abmelden',
    tagline: 'MyselfMonArt — künstlerische Leitung in Paris, Kundenservice in Toulouse.',
    legal: 'Impressum',
    reply:
      'Eine Frage? Antworten Sie einfach auf diese E-Mail – sie landet bei {contact}, und wir antworten.',
  },
  unsubscribePage: {
    title: 'Keine E-Mails mehr erhalten',
    body: 'Bestätigen Sie unten, und wir schreiben Ihnen nicht mehr zu diesem Code.',
    button: 'Ja, bitte abmelden',
    done: 'Erledigt',
    doneBody:
      'Sie hören nichts mehr von uns. Danke, dass Sie es uns gesagt haben, statt uns weiter schreiben zu lassen.',
  },
}

// --- Espagnol -------------------------------------------------------------------------------

const es: Pack = {
  common: { productPrice: '{price} · {priceWithVoucher} con su código' },
  mail1: {
    subject: 'Su código {code} y sus {amount} de regalo',
    docTitle: 'Sus {amount} de regalo',
    preheader: 'Código {code}, hasta el {date}, desde {min}. Su obra se hará para usted.',
    heroH2: 'de regalo en la obra que usted elija',
    heroSub:
      'Gracias. Su código está justo debajo. Solo sirve una vez: guárdelo para la obra que de verdad le guste.',
    codeValidity: 'Hasta el {date}',
    cta: 'Ver las obras con mis {amount}',
    ctaFine:
      'Si entra por este botón, el código se aplica solo. Y si prefiere escribirlo a mano, lo tiene justo aquí arriba.',
    productEyebrow: 'La estaba mirando',
    productLink: 'Verla más de cerca',
    cond: [
      { strong: 'A partir de {min}', rest: ' de compra, envío aparte' },
      // ⛔ La mention d'heure du gabarit est retirée ici aussi — voir l'en-tête de ce fichier.
      { strong: 'De un solo uso', rest: ', hasta el {date} incluido' },
      { strong: 'No acumulable', rest: ': siempre se queda con la mejor de las dos' },
    ],
    materials: 'Hecha por encargo · Lienzo 285 g · Marco de madera maciza',
  },
  mail2: {
    subject: 'Póster o lienzo, qué marco y cómo queda en la pared',
    docTitle: 'Póster o lienzo, qué marco y cómo queda en la pared',
    preheader:
      'Las tres preguntas de siempre, contestadas, y la vista 3D para verlo antes de pedir.',
    band: 'SU CÓDIGO DE {amount} SIGUE AQUÍ',
    h1: 'Una pared vacía se mira mucho tiempo.',
    intro:
      'Encima del sofá no se cuelga cualquier cosa. Antes de pedir vuelven siempre las mismas tres preguntas. Estas son nuestras respuestas.',
    questions: [
      {
        title: '¿Póster o lienzo?',
        body: 'El póster es una impresión bajo cristal. Nítido y ligero, se mueve bien en formatos pequeños y medianos. El lienzo va tensado sobre bastidor, 285 g. Sin cristal, así que sin reflejos: una textura algo viva, que recoge la luz de la tarde. Es el que aguanta paredes grandes. En los dos casos, las tintas duran 75 años.',
        link: 'Ver los materiales',
      },
      {
        title: '¿Y el marco?',
        body: 'El marco casi nunca se decide a la primera. Hay cinco acabados en el lienzo, cuatro en el póster y la opción sin marco. Ante la duda, quédese con el roble claro: se lleva bien con casi todo. La madera es maciza, no un chapado. Y el borde blanco deja un margen alrededor de la imagen, como en una galería.',
      },
      {
        title: 'En mi pared, ¿cómo queda?',
        body: 'Cada obra lleva una vista 3D. Puede girarla, ver el marco en perspectiva y el reflejo del cristal. Es lo más parecido a tenerla delante antes de pedirla. Encima del sofá o en la entrada, se ve enseguida si el tamaño encaja. Tómese su tiempo: mirar no compromete a nada.',
        link: 'Abrir la vista 3D',
      },
    ],
    bestEyebrow: 'Las más elegidas ahora mismo',
    cta: 'Elegir mi obra',
    ctaFine:
      'Su código sigue válido hasta el {date} incluido, a partir de {min} de compra y una sola vez.',
    trustpilot: '{score} / 5 en Trustpilot, {count} opiniones verificadas',
  },
  mail3: {
    subject: 'Su vale de {amount} termina el {date}',
    docTitle: 'Su vale de {amount} termina el {date}',
    preheader: 'El código {code} sirve hasta el {date}. Luego queda la obra, el código no.',
    eyebrow: 'Último mensaje',
    h1: 'El {date} vence su vale de {amount}.',
    intro:
      'La obra no se va a ninguna parte. Se fabricará el día en que usted la elija, para esa pared. El vale no se prorroga: está a su nombre y sirve una sola vez.',
    codeValidity: 'Caduca: {date}',
    cta: 'Elegirla con mis {amount}',
    ctaFine: 'A partir de {min} de compra, sin contar el envío y una sola vez.',
    productEyebrow: 'La obra que miraba',
    productLink: 'Volver a verla',
    honesty: {
      strong: 'Aquí usted nunca pierde:',
      rest: ' a partir de {betterDeal} en el carrito, la oferta del momento le sale mejor que su código. En ese caso se aplica ella sola, sin que usted tenga que hacer nada. Preferimos decírselo antes que dejarle echando cuentas.',
    },
    lastWord:
      'Este es el último correo que le escribimos sobre el vale. Después del {date} el código deja de funcionar y no volverá a saber de él. Nosotros seguimos aquí si tiene alguna duda.',
  },
  footer: {
    context:
      'Le enviamos este correo porque pidió un vale de {amount} en myselfmonart.com el {signupDate}.',
    privacy: 'Política de privacidad',
    unsubscribe: 'Darse de baja',
    tagline: 'MyselfMonArt — dirección artística en París, atención al cliente en Toulouse.',
    legal: 'Aviso legal',
    reply: '¿Alguna duda? Responda a este correo: llega a {contact} y le contestamos.',
  },
  unsubscribePage: {
    title: 'Dejar de recibir nuestros correos',
    body: 'Confírmelo aquí abajo y no volveremos a escribirle sobre este código.',
    button: 'Sí, darme de baja',
    done: 'Hecho',
    doneBody:
      'No volverá a recibir nada de nuestra parte. Gracias por decírnoslo en vez de dejarnos insistir.',
  },
}

// --- Néerlandais ----------------------------------------------------------------------------

const nl: Pack = {
  common: { productPrice: '{price} · {priceWithVoucher} met uw code' },
  mail1: {
    subject: 'Uw waardebon van {amount} staat klaar · {code}',
    docTitle: 'Uw waardebon van {amount}',
    preheader: 'Code {code}, tot en met {date}, vanaf {min}. Uw werk wordt voor u gemaakt.',
    heroH2: 'van ons, voor het werk dat u uitkiest',
    heroSub:
      'Dank u wel. Uw code staat hieronder. Hij werkt één keer, dus bewaar hem voor het werk dat u echt raakt.',
    codeValidity: 'Geldig tot en met {date}',
    cta: 'Kunst bekijken met mijn {amount}',
    ctaFine:
      'Via deze knop staat de code er meteen in. Liever zelf invullen? Hij staat hier vlak boven.',
    productEyebrow: 'Hier keek u naar',
    productLink: 'Van dichtbij bekijken',
    cond: [
      { strong: 'Vanaf {min}', rest: ' aan bestelwaarde, exclusief verzending' },
      // ⛔ La mention d'heure du gabarit est retirée ici aussi — voir l'en-tête de ce fichier.
      { strong: 'Eenmalig te gebruiken', rest: ', tot en met {date}' },
      { strong: 'Niet te combineren', rest: ': u houdt altijd het voordeligste van de twee' },
    ],
    materials: 'Op bestelling gemaakt · Canvas 285 g · Massief houten lijst',
  },
  mail2: {
    subject: 'Poster of canvas, welke lijst, en hoe het staat',
    docTitle: 'Poster of canvas, welke lijst, en hoe het staat',
    preheader:
      'Onze antwoorden op de drie vragen die steeds terugkomen, en de 3D-weergave om het vooraf te zien.',
    band: 'UW CODE VAN {amount} STAAT NOG KLAAR',
    h1: 'Naar een lege muur kijkt u lang.',
    intro:
      'Boven de bank hangt u niet zomaar het eerste het beste. Voordat u bestelt, spelen er altijd drie vragen. Hier zijn onze antwoorden.',
    questions: [
      {
        title: 'Poster of canvas?',
        body: 'De poster is een afdruk achter glas. Scherp en licht, sterk in klein en middelgroot formaat. Het canvas is gespannen op een houten spieraam, 285 g. Geen glas, dus geen weerspiegeling: een levendige structuur die het avondlicht opvangt. Grote muren vragen om canvas. In beide gevallen gaan de inkten 75 jaar mee.',
        link: 'De materialen bekijken',
      },
      {
        title: 'En de lijst?',
        body: 'Een lijst kiest niemand blindelings. Op canvas zijn er vijf afwerkingen, op de poster vier, plus de optie zonder lijst. Twijfelt u? Neem licht eiken: dat past bij bijna alles. Het hout is massief, geen fineer. En de witte rand houdt een marge rond het beeld, zoals in een galerie.',
      },
      {
        title: 'Hoe staat dat op mijn muur?',
        body: 'Elk werk heeft een 3D-weergave. U draait het rond, u ziet de lijst in perspectief en de weerspiegeling van het glas. Dichter bij het echte werk komt u niet zonder te bestellen. In de woonkamer of in de hal ziet u meteen of het formaat klopt. Neem er de tijd voor, u zit nergens aan vast.',
        link: 'De 3D-weergave openen',
      },
    ],
    bestEyebrow: 'Nu het vaakst gekozen',
    cta: 'Mijn kunstwerk kiezen',
    ctaFine:
      'Uw code blijft geldig tot en met {date}, vanaf {min} aan bestelwaarde, en werkt één keer.',
    trustpilot: '{score} / 5 op Trustpilot, {count} geverifieerde beoordelingen',
  },
  mail3: {
    subject: 'Uw waardebon van {amount} vervalt op {date}',
    docTitle: 'Uw waardebon van {amount} vervalt op {date}',
    preheader: 'Code {code} werkt tot en met {date}. Daarna blijft het werk, de code niet.',
    eyebrow: 'Laatste bericht',
    h1: 'Op {date} stopt uw waardebon van {amount}.',
    intro:
      'Het werk gaat nergens heen. Het wordt gemaakt op de dag dat u het kiest, voor die ene muur. De code wordt niet verlengd: hij staat op uw naam en werkt één keer.',
    codeValidity: 'Tot en met {date}',
    cta: 'Mijn kunstwerk kiezen met {amount}',
    ctaFine: 'Vanaf {min} aan bestelwaarde, exclusief verzending, en eenmalig te gebruiken.',
    productEyebrow: 'Waar u naar keek',
    productLink: 'Nog eens gaan kijken',
    honesty: {
      strong: 'Hier verliest u nooit:',
      rest: ' boven {betterDeal} aan bestelwaarde doet de lopende actie meer voor u dan uw code. Die komt er dan vanzelf voor in de plaats, zonder dat u iets hoeft te doen. Wij zeggen het liever zelf dan u te laten rekenen.',
    },
    lastWord:
      'Dit is de laatste e-mail die we hierover sturen. Na {date} stopt de code en hoort u er niets meer over. Wij zijn er nog, mocht u een vraag hebben.',
  },
  footer: {
    context:
      'U ontvangt deze e-mail omdat u op {signupDate} via myselfmonart.com een code van {amount} hebt aangevraagd.',
    privacy: 'Privacybeleid',
    unsubscribe: 'Uitschrijven',
    tagline: 'MyselfMonArt — artistieke leiding in Parijs, klantenservice in Toulouse.',
    legal: 'Juridische informatie',
    reply: 'Een vraag? Beantwoord deze e-mail: hij komt binnen bij {contact}, en wij antwoorden u.',
  },
  unsubscribePage: {
    title: 'Geen e-mails meer ontvangen',
    body: 'Bevestig hieronder, dan schrijven wij u niet meer over deze code.',
    button: 'Ja, schrijf mij uit',
    done: 'Gelukt',
    doneBody:
      'U hoort niets meer van ons. Fijn dat u het hebt laten weten, in plaats van ons te laten aandringen.',
  },
}

const PACKS: Record<NewsletterLocale, Pack> = { fr, en, de, es, nl }

/** Repli sur le français : une langue absente ne doit jamais produire un e-mail vide. */
export function pack(locale: NewsletterLocale): Pack {
  return PACKS[locale] ?? PACKS.fr
}
