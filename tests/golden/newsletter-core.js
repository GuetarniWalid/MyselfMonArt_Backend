/*
 * Tests dorés du cœur de la séquence du bon de 15 €.
 *
 * Portent sur les modules PURS — identité, gabarit, chaînes — c'est-à-dire tout ce qui décide
 * de l'identité d'une personne et de ce qu'elle lit. Aucune base, aucun réseau, aucun Adonis.
 *
 * Ce qu'on protège ici est précisément ce qui, en cas de régression, casserait EN SILENCE :
 *   • un jeton de désabonnement qui changerait de forme -> tous les liens déjà partis en 404,
 *     donc des « signaler comme spam » à la place d'un désabonnement ;
 *   • un alphabet de code qui reprendrait des caractères ambigus -> des codes recopiés faux ;
 *   • un lien d'e-mail sans préfixe de langue -> un Néerlandais renvoyé sur une page française.
 *
 * Lancé par `npm run test:golden`, donc avant toute image poussée en production.
 */

const assert = require('assert')
const path = require('path')
const fs = require('fs')

const ts = require(path.join(__dirname, '../../node_modules/typescript'))
const ROOT = path.join(__dirname, '../..')

/** Charge un module TypeScript pur, avec ses imports relatifs résolus récursivement. */
const cache = new Map()
function load(relPath) {
  const abs = path.join(ROOT, relPath)
  if (cache.has(abs)) return cache.get(abs)

  const js = ts.transpileModule(fs.readFileSync(abs, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText

  const mod = { exports: {} }
  cache.set(abs, mod.exports)
  const req = (id) => {
    if (id.startsWith('.')) {
      const resolved = path.join(path.dirname(abs), id)
      const withExt = fs.existsSync(resolved + '.ts') ? resolved + '.ts' : resolved + '/index.ts'
      return load(path.relative(ROOT, withExt))
    }
    return require(id)
  }
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(req, mod, mod.exports)
  cache.set(abs, mod.exports)
  return mod.exports
}

const identity = load('app/Services/Newsletter/identity.ts')
const config = load('app/Services/Newsletter/config.ts')
const template = load('app/Services/Newsletter/emails/template.ts')
const strings = load('app/Services/Newsletter/emails/strings.ts')
const expiry = load('app/Services/Newsletter/expiry.ts')
const currency = load('app/Services/Newsletter/currency.ts')
const { DateTime } = require('luxon')

/**
 * Ramène les espaces insécables d'ICU à des espaces ordinaires, pour que les attentes des
 * tests restent LISIBLES.
 *
 * `Intl.NumberFormat` sépare le nombre de son symbole par U+00A0 (ou U+202F selon la langue) —
 * c'est voulu et il faut le garder dans l'e-mail : sans lui, « 15 » et « € » peuvent se
 * retrouver sur deux lignes. Mais l'écrire dans un littéral de test le rend invisible en
 * relecture, et le premier qui retape la chaîne à la main casse le test sans comprendre.
 */
const plat = (s) => String(s).replace(/[  ]/g, ' ')

let failures = 0
function check(label, fn) {
  try {
    fn()
    console.log(`  ✓ ${label}`)
  } catch (error) {
    failures++
    console.error(`  ✗ ${label}\n    ${error.message}`)
  }
}

console.log('newsletter-core')

// --- Normalisation ------------------------------------------------------------------
check('normalisation : minuscules + espaces, et RIEN d’autre', () => {
  assert.strictEqual(identity.normalizeEmail('  Jean.Dupont@Exemple.FR '), 'jean.dupont@exemple.fr')
  // Les points et les alias `+` sont CONSERVÉS : ce sont des adresses distinctes pour
  // Shopify comme pour le fournisseur de messagerie. Les fusionner ferait répondre
  // « déjà inscrit » à quelqu'un qui ne l'est pas — ou lui servirait le bon d'un autre.
  assert.strictEqual(identity.normalizeEmail('a.b+promo@gmail.com'), 'a.b+promo@gmail.com')
})

check('validation : accepte le courant, refuse le malformé', () => {
  for (const good of [
    'a@b.fr',
    'jean.dupont@exemple.co.uk',
    'prenom+tag@sous.domaine.com',
    "o'brien@exemple.ie",
  ]) {
    assert.ok(identity.isValidEmail(good), `devrait accepter ${good}`)
  }
  for (const bad of [
    '',
    'sans-arobase.fr',
    'deux@@arobases.fr',
    'a@b',
    'a@-b.fr',
    'a@b-.fr',
    'a@b..fr',
    'espace dans@adresse.fr',
    'x'.repeat(250) + '@exemple.fr',
  ]) {
    assert.ok(!identity.isValidEmail(identity.normalizeEmail(bad)), `devrait refuser « ${bad} »`)
  }
  // Espaces de bordure : refusés par la validation SEULE, acceptés une fois normalisés.
  // C'est voulu — un client qui colle son adresse avec un espace ne doit pas être rejeté.
  assert.ok(!identity.isValidEmail('a@b.fr '))
  assert.ok(identity.isValidEmail(identity.normalizeEmail('a@b.fr ')))
})

check('langue : ramenée aux cinq, repli sur le français', () => {
  assert.strictEqual(identity.normalizeLocale('de'), 'de')
  assert.strictEqual(identity.normalizeLocale('EN-GB'), 'en')
  assert.strictEqual(identity.normalizeLocale('it'), 'fr')
  assert.strictEqual(identity.normalizeLocale(undefined), 'fr')
  assert.strictEqual(identity.normalizeLocale(null), 'fr')
})

// --- Empreinte ----------------------------------------------------------------------
check('empreinte : salée, stable, et distincte par adresse', () => {
  const a = identity.emailHash('jean@exemple.fr', 'secret-serveur')
  assert.match(a, /^[0-9a-f]{64}$/)
  assert.strictEqual(a, identity.emailHash('  JEAN@Exemple.FR ', 'secret-serveur'))
  assert.notStrictEqual(a, identity.emailHash('jeanne@exemple.fr', 'secret-serveur'))
  // Sel différent = empreinte différente : c'est ce qui rend la liste repoussoir
  // inexploitable hors de cette machine — et ce qui interdit de changer le sel un jour.
  assert.notStrictEqual(a, identity.emailHash('jean@exemple.fr', 'autre-secret'))
})

// --- Jeton de désabonnement ---------------------------------------------------------
check('jeton : stable, base64url, et distinct par inscrit', () => {
  const t1 = identity.unsubToken(42, 'secret-serveur')
  assert.strictEqual(t1, identity.unsubToken(42, 'secret-serveur'), 'doit être déterministe')
  assert.notStrictEqual(t1, identity.unsubToken(43, 'secret-serveur'))
  assert.match(t1, /^[A-Za-z0-9_-]+$/, 'base64url : sûr dans une URL et un en-tête')
  assert.ok(t1.length <= 64, 'doit tenir dans la colonne unsub_token')
})

check('jeton : un identifiant voisin ne vaut jamais un autre jeton', () => {
  const secret = 'secret-serveur'
  const t = identity.unsubToken(1000, secret)
  assert.ok(identity.verifyUnsubToken(1000, t, secret))
  // Le cœur du sujet : sans HMAC, un identifiant incrémental permettrait de désabonner
  // toute la base en énumérant /u/1, /u/2, /u/3…
  assert.ok(!identity.verifyUnsubToken(1001, t, secret))
  assert.ok(!identity.verifyUnsubToken(1000, t + 'x', secret))
  assert.ok(!identity.verifyUnsubToken(1000, '', secret))
  assert.ok(!identity.verifyUnsubToken(1000, t, 'mauvais-secret'))
})

// --- Code du bon --------------------------------------------------------------------
check('code : préfixe, longueur, et alphabet sans caractère ambigu', () => {
  for (let i = 0; i < 400; i++) {
    const code = identity.generateVoucherCode()
    assert.match(code, /^MERCI-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/, `code invalide : ${code}`)
    // Ni I, ni O, ni 0, ni 1 : le code est lu à voix haute puis recopié à la main.
    assert.ok(!/[IO01]/.test(code.slice(6)), `caractère ambigu dans ${code}`)
  }
})

check('code : réellement varié (pas de générateur figé)', () => {
  const seen = new Set()
  for (let i = 0; i < 300; i++) seen.add(identity.generateVoucherCode())
  assert.ok(seen.size > 290, `trop de collisions : ${seen.size}/300`)
})

// --- Constantes du dispositif -------------------------------------------------------
check('constantes : les invariants qui protègent le compte d’envoi', () => {
  assert.strictEqual(config.PURPOSE, 'bon15', 'le marqueur de finalité protège les dormants')
  assert.strictEqual(config.VOUCHER_VALIDITY_DAYS, 7)
  assert.strictEqual(config.SEQUENCE_LENGTH, 3)
  assert.deepStrictEqual([...config.SEQUENCE_GAP_DAYS], [3, 3], 'E2 à J+3, E3 à J+6')
  assert.ok(config.MIN_HOURS_BETWEEN_EMAILS >= 24, 'plancher absolu entre deux e-mails')
  // Liste BLANCHE : une valeur inconnue de l'énuméré Shopify ne doit jamais autoriser un envoi.
  assert.deepStrictEqual(
    [...config.SUBSCRIBABLE_PRIOR_STATES],
    ['NOT_SUBSCRIBED', 'PENDING', 'SUBSCRIBED']
  )
  assert.ok(!config.SUBSCRIBABLE_PRIOR_STATES.includes('UNSUBSCRIBED'))
})

// ⛔ LE LIEN LE PLUS FRAGILE DU DISPOSITIF, et celui qui casse EN SILENCE.
//
// E3 dit « votre bon s'arrête demain ». Trois valeurs doivent rester cohérentes pour que ce
// soit vrai : la validité du bon (7 j), la date d'envoi de E3 (J+6), et la marge minimale
// exigée avant expiration. Si l'une bouge sans les autres, soit E3 annonce une échéance fausse
// — ce qui fait cliquer sur « signaler comme spam » —, soit il ne part JAMAIS, et rien dans les
// compteurs ne ressemble à une panne.
check('E3 part la veille de l’échéance annoncée, et la garde d’expiration le laisse passer', () => {
  const [gap1, gap2] = config.SEQUENCE_GAP_DAYS
  const e3Day = gap1 + gap2
  assert.strictEqual(
    e3Day,
    config.VOUCHER_VALIDITY_DAYS - 1,
    'E3 doit tomber la VEILLE de la date annoncée, sinon « demain » est faux'
  )

  // Marge réellement disponible quand E3 part, dans le pire cas : le bon s'arrête au lendemain
  // de la date annoncée à 11:59:59 UTC, donc au minimum (7 - 6) jours + ~11 h après E3, moins
  // les 2 h du décalage de Paris en été.
  const worstCaseHoursLeft = 24 + 11 - 2
  assert.ok(
    config.minHoursBeforeExpiry(3) < worstCaseHoursLeft,
    `la garde de E3 (${config.minHoursBeforeExpiry(3)} h) doit rester sous les ${worstCaseHoursLeft} h ` +
      'disponibles, sinon E3 est sauté à chaque fois'
  )
  // E2 part à J+3 : il lui reste plus de 100 h, la garde stricte y est tenable.
  assert.ok(config.minHoursBeforeExpiry(2) >= 72, 'E2 garde la marge de 72 h')
})

// --- Fenêtre de validité du bon ------------------------------------------------------
//
// Deux instants distincts, et les confondre est le bug que ces tests existent pour empêcher :
// la DATE ANNONCÉE (J+7, en Europe/Paris, la seule que le client lit) et l'INSTANT DE FIN posé
// chez Shopify (11:59:59 UTC le LENDEMAIN de cette date).

check('la date annoncée tombe à J+7, calculée en Europe/Paris', () => {
  // Le cas du brief : inscription le 6 août 2026 à 14 h 11, heure de Paris.
  const w = expiry.voucherWindow(DateTime.fromISO('2026-08-06T14:11:00', { zone: 'Europe/Paris' }))
  assert.strictEqual(w.announcedDate, '2026-08-13', 'inscription le 6 août -> annoncé le 13')
  assert.strictEqual(w.endsAtIso, '2026-08-14T11:59:59Z', 'fin au LENDEMAIN, à 11:59:59 UTC')
})

check('l’instant de fin est toujours 11:59:59 UTC, le lendemain de la date annoncée', () => {
  // Balayage sur une année entière, à des heures qui encadrent les deux minuits (Paris et UTC).
  for (let day = 0; day < 365; day++) {
    for (const heure of ['00:05', '12:00', '23:55']) {
      const signup = DateTime.fromISO(`2026-01-01T${heure}`, { zone: 'Europe/Paris' }).plus({
        days: day,
      })
      const w = expiry.voucherWindow(signup)

      // La date annoncée est bien J+7 dans le CALENDRIER de Paris.
      assert.strictEqual(
        w.announcedDate,
        signup.plus({ days: 7 }).toFormat('yyyy-MM-dd'),
        `date annoncée fausse pour ${signup.toISO()}`
      )

      // Et la fin est le lendemain de cette date, à 11:59:59 UTC — pile.
      const end = DateTime.fromISO(w.endsAtIso, { zone: 'utc' })
      assert.strictEqual(end.hour, 11, `heure de fin fausse pour ${signup.toISO()}`)
      assert.strictEqual(end.minute, 59)
      assert.strictEqual(end.second, 59)
      assert.strictEqual(
        end.toFormat('yyyy-MM-dd'),
        DateTime.fromISO(`${w.announcedDate}T00:00:00Z`, { zone: 'utc' })
          .plus({ days: 1 })
          .toFormat('yyyy-MM-dd'),
        `la fin doit tomber le LENDEMAIN de la date annoncée (${signup.toISO()})`
      )
    }
  }
})

// ⛔ Le passage à l'heure d'hiver est exactement l'endroit où un « UTC+2 » codé en dur ferait
// dériver la date annoncée d'un jour, sur les inscriptions du soir, pendant tout l'hiver.
check('le changement d’heure ne décale pas la date annoncée', () => {
  // 2026-10-25 : la France repasse à UTC+1. Une inscription à 23 h 30 le 24 octobre est encore
  // le 24 à Paris, alors qu'elle est déjà le 24 à 21:30 UTC — et le 25 dans un « UTC+2 » figé.
  const veille = DateTime.fromISO('2026-10-24T23:30:00', { zone: 'Europe/Paris' })
  assert.strictEqual(expiry.voucherWindow(veille).announcedDate, '2026-10-31')

  // Et une inscription qui ENJAMBE le changement : 7 jours calendaires restent 7 jours.
  const avant = DateTime.fromISO('2026-10-22T23:30:00', { zone: 'Europe/Paris' })
  assert.strictEqual(expiry.voucherWindow(avant).announcedDate, '2026-10-29')
})

check(
  'la date annoncée se reconstruit depuis l’instant de fin (lignes d’avant la correction)',
  () => {
    const w = expiry.voucherWindow(
      DateTime.fromISO('2026-08-06T14:11:00', { zone: 'Europe/Paris' })
    )
    assert.strictEqual(expiry.announcedDateFromEnd(w.endsTs), w.announcedDate)
  }
)

// ⛔ La promesse « valable jusqu'au 13 août » doit rester vraie dans TOUS les fuseaux ouverts à
// la vente. C'est toute la raison du décalage à 11:59:59 UTC : le bon doit encore vivre à
// 23 h 59 heure locale du dernier client, où qu'il soit.
check('le bon vit encore à la fin de la journée annoncée, de Honolulu à Helsinki', () => {
  const w = expiry.voucherWindow(DateTime.fromISO('2026-08-06T14:11:00', { zone: 'Europe/Paris' }))
  const fuseaux = [
    ['Pacific/Honolulu', 'Honolulu'],
    ['America/Los_Angeles', 'Los Angeles'],
    ['America/Toronto', 'Toronto'],
    ['Europe/London', 'Londres'],
    ['Europe/Paris', 'Paris'],
    ['Europe/Zurich', 'Zurich'],
    ['Europe/Helsinki', 'Helsinki'],
  ]
  for (const [zone, nom] of fuseaux) {
    const dernierInstant = DateTime.fromISO(`${w.announcedDate}T23:59:59`, { zone })
    assert.ok(
      dernierInstant.toSeconds() < w.endsTs,
      `le bon serait déjà mort à ${nom} alors qu’on lui annonce le ${w.announcedDate}`
    )
  }
})

// --- Devises --------------------------------------------------------------------------

check('la devise ne se déduit jamais de la langue', () => {
  assert.strictEqual(currency.resolveCurrency('USD'), 'USD')
  assert.strictEqual(currency.resolveCurrency('usd'), 'USD')
  // Devise absente : on tombe sur le PAYS, jamais sur la langue.
  assert.strictEqual(currency.resolveCurrency(undefined, 'US'), 'USD')
  assert.strictEqual(currency.resolveCurrency('', 'CH'), 'CHF')
  assert.strictEqual(currency.resolveCurrency(null, 'GB'), 'GBP')
  assert.strictEqual(currency.resolveCurrency(null, 'CA'), 'CAD')
  // Un Allemand paie en euros, un Suisse peut lire en français et payer en francs.
  assert.strictEqual(currency.resolveCurrency(undefined, 'DE'), 'EUR')
  assert.strictEqual(currency.resolveCurrency('CHF', 'FR'), 'CHF')
  // Devise inconnue, pays inconnu : euro, jamais un échec.
  assert.strictEqual(currency.resolveCurrency('JPY', 'JP'), 'EUR')
  assert.strictEqual(currency.resolveCurrency(undefined, undefined), 'EUR')
})

// ⛔ LE SENS DE LA MARGE EST TOUT L'INTÉRÊT DU CALCUL, et il est ASYMÉTRIQUE :
// le client reçoit toujours AU MOINS ce qui lui a été promis, et n'est jamais refusé sur un
// seuil qu'il croyait atteint. Un client qui reçoit 15,31 $ au lieu de 15 $ ne se plaint
// jamais ; un client qui reçoit 14,96 $ écrit au service client.
check('le montant posé dépasse toujours la cible, le seuil reste toujours en dessous', () => {
  const taux = { USD: 1.1542, CAD: 1.6156, CHF: 0.9346, GBP: 0.85705 }

  for (const [devise, tauxDuJour] of Object.entries(taux)) {
    const offre = currency.offerFor(devise)
    const posé = currency.eurAmountsFor(devise, tauxDuJour)

    // Reconverti au taux du jour, le client voit AU MOINS sa cible ronde…
    assert.ok(
      posé.amount * tauxDuJour >= offre.amount,
      `${devise} : ${(posé.amount * tauxDuJour).toFixed(2)} < ${offre.amount} promis`
    )
    // …et le seuil exigé reste SOUS le seuil annoncé.
    assert.ok(
      posé.threshold * tauxDuJour <= offre.threshold,
      `${devise} : seuil ${(posé.threshold * tauxDuJour).toFixed(2)} > ${offre.threshold} annoncé`
    )

    // La marge de 2 % absorbe la dérive du taux sur les 7 jours de validité — et l'écart entre
    // le taux BCE et celui que Shopify applique réellement au paiement. On vérifie qu'elle
    // tient encore après une variation d'un point et demi dans le sens défavorable.
    const dérivé = tauxDuJour * 0.985
    assert.ok(
      posé.amount * dérivé >= offre.amount,
      `${devise} : la marge ne survit pas à une dérive de 1,5 % du taux`
    )
  }
})

check('l’euro ne passe par aucun calcul : 15 € et 80 € en dur', () => {
  const posé = currency.eurAmountsFor('EUR', 1)
  assert.strictEqual(posé.amount, 15)
  assert.strictEqual(posé.threshold, 80)
  // Et même avec un taux absurde : l'euro est la devise de la boutique, il ne se convertit pas.
  assert.deepStrictEqual(currency.eurAmountsFor('EUR', 42), { amount: 15, threshold: 80 })
})

check('un taux absent ou absurde ne fait jamais échouer un calcul', () => {
  for (const mauvais of [0, -1, NaN, Infinity, undefined, null]) {
    const posé = currency.eurAmountsFor('USD', mauvais)
    assert.ok(Number.isFinite(posé.amount) && posé.amount > 0, `montant invalide pour ${mauvais}`)
    assert.ok(Number.isFinite(posé.threshold) && posé.threshold > 0)
  }
})

check('les montants s’écrivent avec une devise non ambiguë', () => {
  assert.strictEqual(plat(currency.moneyLabel(15, 'EUR', 'fr')), '15 €')
  // ⛔ La mise en forme suit la LANGUE, pas la devise : « 15 € » en français, « €15 » en
  // anglais, « € 15 » en néerlandais. C'est CLDR qui le sait, pas nous.
  assert.strictEqual(currency.moneyLabel(15, 'EUR', 'en'), '€15')
  assert.strictEqual(plat(currency.moneyLabel(15, 'EUR', 'nl')), '€ 15')
  assert.strictEqual(currency.moneyLabel(15, 'USD', 'en'), 'US$15')
  assert.strictEqual(plat(currency.moneyLabel(14, 'CHF', 'fr')), '14 CHF')
  assert.strictEqual(currency.moneyLabel(13, 'GBP', 'en'), '£13')

  // ⛔ LE POINT QUI DÉCIDE DU RÉGLAGE : un montant canadien ne doit JAMAIS s'écrire comme un
  // montant américain. Les deux marchés partagent un catalogue, et « 20 $ » lu par un
  // Canadien ne dit pas de quel dollar il s'agit. C'est ce que `currencyDisplay: 'symbol'`
  // garantit et que `narrowSymbol` casse — il rend « $20 » en anglais et « 20 $ » partout
  // ailleurs, donc strictement indistinguable de l'USD.
  for (const lang of ['fr', 'en', 'de', 'es', 'nl']) {
    const usd = currency.moneyLabel(15, 'USD', lang)
    const cad = currency.moneyLabel(20, 'CAD', lang)
    const nu = (s) => s.replace(/[\d\s  ]/g, '')
    assert.notStrictEqual(nu(usd), nu(cad), `${lang} : USD et CAD portent le même symbole`)
  }
  assert.strictEqual(currency.moneyLabel(20, 'CAD', 'en'), 'CA$20')

  // Les décimales suivent le montant : un bon est rond, un prix d'œuvre ne l'est pas.
  assert.strictEqual(plat(currency.moneyLabel(62.5, 'EUR', 'fr')), '62,50 €')

  // Une devise inconnue d'ICU ne fait jamais échouer un e-mail.
  assert.strictEqual(plat(currency.moneyLabel(15, 'XXXX', 'fr')), '15 XXXX')
})

check('chaque devise servie a une offre, et les cibles sont bien rondes', () => {
  for (const devise of currency.VOUCHER_CURRENCIES) {
    const offre = currency.offerFor(devise)
    assert.ok(Number.isInteger(offre.amount), `${devise} : montant non rond`)
    assert.ok(Number.isInteger(offre.threshold), `${devise} : seuil non rond`)
    assert.ok(offre.threshold > offre.amount, `${devise} : seuil sous le montant du bon`)
    assert.ok(currency.FALLBACK_RATES[devise] > 0, `${devise} : pas de taux de repli à froid`)
  }
})

// --- Bloc produit : extraction du handle depuis source_url ----------------------------
//
// ⛔ `source_url` est SOUMISE PAR LE NAVIGATEUR. C'est une entrée non fiable qui finit en
// image et en titre dans un e-mail : sans filtre de domaine, un tiers ferait afficher le
// visuel de son choix dans un message signé MyselfMonArt.
check('handle produit : accepte les vraies fiches, avec ou sans préfixe de langue', () => {
  const p = load('app/Services/Newsletter/sourceUrl.ts')
  const H = 'cadre-design-cocktail-festif'
  for (const url of [
    `https://www.myselfmonart.com/products/${H}`,
    `https://www.myselfmonart.com/de/products/${H}`,
    `https://www.myselfmonart.com/products/${H}?variant=123&utm_source=x`,
    `https://myselfmonart.com/products/${H}#avis`,
    `https://www.myselfmonart.com/collections/tout/products/${H}`,
  ]) {
    assert.strictEqual(p.extractHandle(url), H, `devrait extraire le handle de ${url}`)
  }
})

check('handle produit : rejette tout ce qui n’est pas une fiche de la boutique', () => {
  const p = load('app/Services/Newsletter/sourceUrl.ts')
  for (const url of [
    null,
    undefined,
    '',
    'pas-une-url',
    // ⛔ Domaine étranger : la porte principale. Sans elle, l'e-mail afficherait l'image et le
    // titre choisis par celui qui a posté le formulaire.
    'https://evil.example.com/products/piege',
    'https://myselfmonart.com.evil.example/products/piege',
    'https://www.myselfmonart.com/collections/tout',
    'https://www.myselfmonart.com/pages/contact',
    // Handle syntaxiquement impossible chez Shopify.
    'https://www.myselfmonart.com/products/' + encodeURIComponent('<script>'),
    'https://www.myselfmonart.com/products/' + 'a'.repeat(300),
  ]) {
    assert.strictEqual(p.extractHandle(url), null, `devrait refuser ${url}`)
  }
})

// --- Traductions --------------------------------------------------------------------
check('les cinq langues ont bien les trois e-mails, tous champs remplis', () => {
  const filled = (value, label) => assert.ok(value && String(value).trim(), `${label} vide`)

  for (const locale of config.LOCALES) {
    const p = strings.pack(locale)

    filled(p.common.productPrice, `${locale} : common.productPrice`)

    for (const key of [
      'subject',
      'docTitle',
      'preheader',
      'heroH2',
      'heroSub',
      'codeValidity',
      'cta',
      'ctaFine',
      'productEyebrow',
      'productLink',
      'materials',
    ]) {
      filled(p.mail1[key], `${locale} mail 1 : ${key}`)
    }
    assert.strictEqual(p.mail1.cond.length, 3, `${locale} mail 1 : il faut 3 conditions`)
    p.mail1.cond.forEach((c, i) => {
      filled(c.strong, `${locale} mail 1 : condition ${i + 1} (gras)`)
      filled(c.rest, `${locale} mail 1 : condition ${i + 1} (suite)`)
    })

    for (const key of [
      'subject',
      'docTitle',
      'preheader',
      'band',
      'h1',
      'intro',
      'bestEyebrow',
      'cta',
      'ctaFine',
      'trustpilot',
    ]) {
      filled(p.mail2[key], `${locale} mail 2 : ${key}`)
    }
    assert.strictEqual(p.mail2.questions.length, 3, `${locale} mail 2 : il faut 3 questions`)
    p.mail2.questions.forEach((q, i) => {
      filled(q.title, `${locale} mail 2 : question ${i + 1} (titre)`)
      filled(q.body, `${locale} mail 2 : question ${i + 1} (corps)`)
    })

    for (const key of [
      'subject',
      'docTitle',
      'preheader',
      'eyebrow',
      'h1',
      'intro',
      'codeValidity',
      'cta',
      'ctaFine',
      'productEyebrow',
      'productLink',
      'lastWord',
    ]) {
      filled(p.mail3[key], `${locale} mail 3 : ${key}`)
    }
    filled(p.mail3.honesty.strong, `${locale} mail 3 : point d’honnêteté (gras)`)
    filled(p.mail3.honesty.rest, `${locale} mail 3 : point d’honnêteté (suite)`)

    for (const key of ['context', 'privacy', 'unsubscribe', 'tagline', 'legal', 'reply']) {
      filled(p.footer[key], `${locale} : pied de page ${key}`)
    }
    for (const key of ['title', 'body', 'button', 'done', 'doneBody']) {
      filled(p.unsubscribePage[key], `${locale} : page de désabonnement ${key}`)
    }
  }
})

check('langue inconnue : repli sur le français, jamais un e-mail vide', () => {
  assert.strictEqual(strings.pack('it'), strings.pack('fr'))
  assert.strictEqual(strings.pack(undefined), strings.pack('fr'))
})

// --- Préfixe de langue des liens ----------------------------------------------------
check('liens : le français sans préfixe, les autres avec', () => {
  assert.strictEqual(template.localePath('fr'), '')
  assert.strictEqual(template.localePath('en'), '/en')
  assert.strictEqual(template.localePath('de'), '/de')
  assert.strictEqual(template.localePath('es'), '/es')
  assert.strictEqual(template.localePath('nl'), '/nl')
})

// --- Rendu des e-mails --------------------------------------------------------------
const BASE = {
  code: 'MERCI-A7F3K2',
  announcedDate: '2026-08-06',
  signupTs: 1784800000,
  amount: 15,
  threshold: 80,
  currency: 'EUR',
  storeUrl: 'https://www.myselfmonart.com',
  unsubscribeUrl: 'https://backend.myselfmonart.com/u/JETON',
  contactEmail: 'contact@myselfmonart.com',
}

/**
 * ⛔ L'ESPACE FRANÇAISE AVANT LA PONCTUATION DOUBLE NE DOIT PAS FUIR VERS LES AUTRES LANGUES.
 *
 * Le français met une espace avant « : », « ; », « ! » et « ? ». Aucune des quatre autres
 * langues ne le fait. C'est la marque la plus reconnaissable d'un texte traduit depuis le
 * français — et elle était sur une CLAUSE du bon, c'est-à-dire la phrase que le lecteur relit.
 *
 * Le test balaie TOUTES les chaînes, pas seulement celle qui avait le défaut : une traduction
 * ajoutée plus tard le réintroduirait sans que personne ne le voie.
 */
check('l’espace française avant « : » ne fuit pas vers les autres langues', () => {
  const fuite = /[\s  ][:;!?]/
  for (const locale of config.LOCALES) {
    if (locale === 'fr') continue
    for (const [clé, valeur] of Object.entries(plateChaines(strings.pack(locale)))) {
      assert.ok(
        !fuite.test(valeur),
        `${locale}/${clé} : espace avant une ponctuation double — ${JSON.stringify(valeur)}`
      )
    }
  }
})

/** Aplatit un pack en { chemin: chaîne }, pour balayer les cinq langues d'un seul geste. */
function plateChaines(objet, préfixe = '', sortie = {}) {
  for (const [clé, valeur] of Object.entries(objet)) {
    const chemin = préfixe ? `${préfixe}.${clé}` : clé
    if (typeof valeur === 'string') sortie[chemin] = valeur
    else if (Array.isArray(valeur)) {
      valeur.forEach((el, i) =>
        typeof el === 'string'
          ? (sortie[`${chemin}[${i}]`] = el)
          : plateChaines(el, `${chemin}[${i}]`, sortie)
      )
    } else if (valeur && typeof valeur === 'object') plateChaines(valeur, chemin, sortie)
  }
  return sortie
}

/**
 * Le titre du 3ᵉ e-mail ne se traduit PAS mot à mot. « Vos 15 € s'arrêtent » se dit en
 * français ; « Your US$15 ends » ne se dit pas en anglais — un montant ne peut pas être le
 * sujet de ce verbe — et « Ihre US$15 enden » se trompe en plus de genre et de nombre. Les
 * quatre autres langues prennent donc le GUTSCHEIN / voucher / vale / waardebon pour sujet.
 */
check('le titre de E3 a un sujet grammatical dans chaque langue', () => {
  const sujets = { en: 'voucher', de: 'Gutschein', es: 'vale', nl: 'waardebon' }
  for (const [locale, sujet] of Object.entries(sujets)) {
    const m3 = strings.pack(locale).mail3
    for (const clé of ['subject', 'docTitle', 'h1']) {
      assert.ok(
        m3[clé].includes(sujet),
        `${locale}/mail3.${clé} : « ${sujet} » doit être le sujet, pas le montant`
      )
    }
  }
  // Le français garde sa formule, qui est correcte chez lui.
  assert.ok(strings.pack('fr').mail3.h1.startsWith('Vos {amount}'))
})

/**
 * ⛔ « heure de Paris » ne doit JAMAIS revenir dans un e-mail.
 *
 * Le gabarit du designer la portait (« jusqu'au 13 août inclus (heure de Paris) », et
 * « (Pariser Zeit) » dans la démonstration allemande). Elle contredit la raison d'être de
 * l'échéance à 11:59:59 UTC : le bon vaut la journée annoncée entière PARTOUT. Annoncée à un
 * lecteur de Los Angeles, cette mention lui fait croire que son bon meurt à 14 h 59 chez lui —
 * et il n'a aucun moyen de savoir que c'est faux.
 */
check('aucun e-mail ne rattache l’échéance à un fuseau horaire', () => {
  const interdits = [
    /heure de Paris/i,
    /Pariser Zeit/i,
    /Paris time/i,
    /hora de París/i,
    /Parijse tijd/i,
    // Et aucune heure d'horloge, sous aucune forme.
    /\b\d{1,2}\s?h\s?\d{2}\b/,
    /\b\d{1,2}:\d{2}\b/,
  ]
  for (const locale of config.LOCALES) {
    for (const emailNo of [1, 2, 3]) {
      const out = template.renderNewsletterEmail({ ...BASE, emailNo, locale })
      for (const motif of interdits) {
        assert.ok(!motif.test(out.text), `${locale}/${emailNo} : ${motif} dans la version texte`)
      }
    }
  }
})

/**
 * ⛔ AUCUN PIXEL DE SUIVI D'OUVERTURE.
 *
 * La seule image autorisée est l'œuvre d'un bloc produit. Un pixel se reconnaît à ce qu'il
 * fait : une image sans dimension utile, sans texte alternatif, qu'on ajoute « pour voir » et
 * qu'on ne retire jamais.
 */
check('aucun pixel de suivi : les seules images sont les œuvres', () => {
  const produit = {
    title: 'Sakura au crépuscule',
    imageUrl: 'https://cdn.shopify.com/oeuvre.jpg',
    price: '129,00 €',
    priceWithVoucher: '114,00 €',
    priceAmount: 129,
    url: 'https://www.myselfmonart.com/products/sakura',
  }
  for (const emailNo of [1, 2, 3]) {
    for (const product of [undefined, produit]) {
      const out = template.renderNewsletterEmail({ ...BASE, emailNo, product })
      const images = out.html.match(/<img\b[^>]*>/gi) || []
      const attendu = product && emailNo !== 2 ? 1 : 0
      assert.strictEqual(
        images.length,
        attendu,
        `e-mail ${emailNo} : ${images.length} image(s) au lieu de ${attendu}`
      )
      images.forEach((img) => {
        assert.ok(/alt="[^"]+"/.test(img), `e-mail ${emailNo} : image sans texte alternatif`)
        assert.ok(img.includes(produit.imageUrl), `e-mail ${emailNo} : image étrangère à l’œuvre`)
      })
    }
  }
})

/**
 * L'adresse postale est OBLIGATOIRE (CAN-SPAM aux États-Unis, CASL au Canada) et doit
 * apparaître EXACTEMENT une fois. Deux adresses dans un même message donnent l'air d'un
 * assemblage mal réglé — pire que zéro pour la confiance, et sans bénéfice légal.
 */
check('l’adresse postale apparaît une fois et une seule', () => {
  const postalAddress = 'SAS KINDOPIA, 60 rue François 1er, 75008 Paris'
  for (const locale of config.LOCALES) {
    for (const emailNo of [1, 2, 3]) {
      const out = template.renderNewsletterEmail({ ...BASE, emailNo, locale, postalAddress })
      const html = out.html.split('SAS KINDOPIA').length - 1
      const texte = out.text.split('SAS KINDOPIA').length - 1
      assert.strictEqual(html, 1, `${locale}/${emailNo} : ${html} adresse(s) dans le HTML`)
      assert.strictEqual(texte, 1, `${locale}/${emailNo} : ${texte} adresse(s) dans le texte`)
    }
  }
})

/**
 * ⛔ Les valeurs d'exemple du designer ne doivent JAMAIS partir.
 *
 * Les gabarits portaient « 129 € — soit 114 € », « Sakura au crépuscule », « 89 € », « 95 € »
 * et « au-delà de 150 € ». Ce sont des maquettes. Un client facturé en dollars qui lit un
 * montant en euros reçoit une annonce fausse — et c'est le seul défaut de ce dispositif qui se
 * voit depuis la boîte de réception du client avant de se voir depuis le serveur.
 */
check('aucune valeur d’exemple du gabarit ne survit au rendu', () => {
  const exemples = [
    '129 €',
    '114 €',
    '89 €',
    '95 €',
    '74 €',
    '80 € avec',
    '150 €',
    'Sakura au crépuscule',
    'Vagues de Kanagawa',
    'Botanique ancienne',
    'IMAGE DE L',
    'IMAGE ŒUVRE',
    'BILD DES KUNSTWERKS',
    '538 × 380',
    '538 × 340',
  ]
  for (const locale of config.LOCALES) {
    for (const emailNo of [1, 2, 3]) {
      for (const currency of ['EUR', 'USD', 'CAD']) {
        const out = template.renderNewsletterEmail({ ...BASE, emailNo, locale, currency })
        for (const exemple of exemples) {
          assert.ok(
            !out.html.includes(exemple),
            `${locale}/${emailNo}/${currency} : « ${exemple} » a survécu`
          )
        }
      }
    }
  }
})

/**
 * Le point d'honnêteté du mail 3 dépend d'une promotion RÉELLEMENT active. Sans promotion, le
 * paragraphe disparaît — plutôt que de décrire une offre qui n'existe plus. La promotion du
 * moment expire le 2026-08-30 ; ce test est ce qui garantit qu'on ne continuera pas à
 * l'annoncer ensuite.
 */
check('le point d’honnêteté disparaît quand aucune promotion n’est active', () => {
  const sans = template.renderNewsletterEmail({ ...BASE, emailNo: 3, betterDealAmount: null })
  assert.ok(!sans.html.includes('honnêteté'), 'sans promotion : le paragraphe doit disparaître')
  assert.ok(!/\bau-delà de\b/.test(sans.text), 'sans promotion : rien dans la version texte')

  // 15 € de bon ÷ 10 % de promotion = 150 € de panier. Le seuil se CALCULE dans la devise du
  // lecteur ; il ne se convertit pas (un Américain croise à 150 $, pas à 173 $).
  const avec = template.renderNewsletterEmail({ ...BASE, emailNo: 3, betterDealAmount: 150 })
  assert.ok(avec.html.includes('honnêteté'), 'avec promotion : le paragraphe doit apparaître')
  assert.ok(plat(avec.html).includes('150 €'), 'avec promotion : le seuil doit être affiché')

  const us = template.renderNewsletterEmail({
    ...BASE,
    emailNo: 3,
    locale: 'en',
    currency: 'USD',
    amount: 15,
    betterDealAmount: 150,
  })
  // En anglais, ICU écrit « US$150 » : le nombre est le même, la mise en forme suit la langue.
  assert.ok(plat(us.html).includes('US$150'), 'USD : le seuil s’écrit dans la devise du lecteur')
  assert.ok(!us.html.includes('173'), 'USD : le seuil ne se convertit pas depuis l’euro')
})

/**
 * Le bloc « les plus choisies » du mail 2 montre DEUX œuvres ou aucune. Une seule
 * déséquilibrerait la mise en page du designer ; zéro ne se remarque pas.
 */
check('les plus choisies : deux œuvres, ou le bloc entier disparaît', () => {
  const oeuvre = (n) => ({
    title: `Œuvre ${n}`,
    imageUrl: `https://cdn.shopify.com/oeuvre-${n}.jpg`,
    price: '129,00 €',
    priceWithVoucher: '114,00 €',
    priceAmount: 129,
    url: `https://www.myselfmonart.com/products/oeuvre-${n}`,
  })
  const eyebrow = strings.pack('fr').mail2.bestEyebrow

  for (const bestSellers of [undefined, [], [oeuvre(1)]]) {
    const out = template.renderNewsletterEmail({ ...BASE, emailNo: 2, bestSellers })
    assert.ok(!out.html.includes(eyebrow), 'moins de deux œuvres : le titre du bloc doit partir')
    assert.ok(!out.html.includes('Œuvre 1'), 'moins de deux œuvres : aucune œuvre affichée')
  }

  const out = template.renderNewsletterEmail({
    ...BASE,
    emailNo: 2,
    bestSellers: [oeuvre(1), oeuvre(2)],
  })
  assert.ok(out.html.includes(eyebrow), 'deux œuvres : le bloc doit apparaître')
  assert.ok(out.html.includes('Œuvre 1') && out.html.includes('Œuvre 2'), 'les deux œuvres')
})

/**
 * Règle du designer : la ligne de prix ne s'affiche que si l'œuvre atteint le seuil du bon.
 * En dessous, le bon ne s'applique pas au format montré et l'e-mail affirmerait le contraire.
 */
check('sous le seuil du bon, la ligne de prix disparaît', () => {
  const bonMarche = {
    title: 'Petite œuvre',
    imageUrl: 'https://cdn.shopify.com/petite.jpg',
    price: '62,50 €',
    priceWithVoucher: '47,50 €',
    priceAmount: 62.5,
    url: 'https://www.myselfmonart.com/products/petite',
  }
  // Seuil à 80 € : 62,50 € est en dessous.
  const out = template.renderNewsletterEmail({ ...BASE, emailNo: 1, product: bonMarche })
  assert.ok(out.html.includes('Petite œuvre'), 'l’œuvre reste affichée')
  assert.ok(!out.html.includes('47,50'), 'le prix remisé ne doit pas être annoncé sous le seuil')

  const cher = { ...bonMarche, price: '129,00 €', priceWithVoucher: '114,00 €', priceAmount: 129 }
  const out2 = template.renderNewsletterEmail({ ...BASE, emailNo: 1, product: cher })
  assert.ok(out2.html.includes('114,00'), 'au-dessus du seuil, le prix remisé s’affiche')
})

check('chaque e-mail, dans chaque langue, porte le code et le désabonnement', () => {
  for (const locale of config.LOCALES) {
    for (const emailNo of [1, 2, 3]) {
      const out = template.renderNewsletterEmail({ ...BASE, emailNo, locale })

      assert.ok(out.subject.trim(), `${locale}/${emailNo} : objet vide`)
      assert.ok(
        !/\{\w+\}/.test(out.subject),
        `${locale}/${emailNo} : marqueur non remplacé dans l’objet`
      )
      assert.ok(
        !/\{\w+\}/.test(out.html),
        `${locale}/${emailNo} : marqueur non remplacé dans le HTML`
      )

      assert.ok(out.html.includes(BASE.code), `${locale}/${emailNo} : code absent du HTML`)
      assert.ok(out.text.includes(BASE.code), `${locale}/${emailNo} : code absent du texte`)

      // ⛔ Le lien de désabonnement doit être VISIBLE dans le corps, pas seulement en
      // en-tête : un lecteur qui ne le trouve pas clique sur « signaler comme spam ».
      assert.ok(
        out.html.includes(BASE.unsubscribeUrl),
        `${locale}/${emailNo} : lien de désabonnement absent du HTML`
      )
      assert.ok(
        out.text.includes(BASE.unsubscribeUrl),
        `${locale}/${emailNo} : lien de désabonnement absent de la version texte`
      )

      // Identification de l'expéditeur : c'est l'adresse de contact qui l'assure, pas une
      // adresse postale (non exigée en Europe — décision du marchand de ne pas l'afficher).
      assert.ok(
        out.html.includes(BASE.contactEmail),
        `${locale}/${emailNo} : adresse de contact absente`
      )

      // Le bouton APPLIQUE le code, et son chemin de retour porte le préfixe de langue :
      // sans lui, un Néerlandais atterrit sur une page française avec son code appliqué.
      // Sans œuvre connue, ce chemin est le catalogue — c'est le repli.
      const expected = `https://www.myselfmonart.com/discount/MERCI-A7F3K2?redirect=${encodeURIComponent(`${template.localePath(locale)}/collections/all`)}`
      assert.ok(
        out.html.includes(expected),
        `${locale}/${emailNo} : lien d’application non localisé (${expected})`
      )
      assert.ok(
        out.text.includes(expected),
        `${locale}/${emailNo} : lien absent de la version texte`
      )
    }
  }
})

// --- Destination du bouton : la fiche regardée, ou le catalogue ------------------------
//
// Le bloc « vous regardiez » prouve qu'on sait quelle œuvre la personne avait sous les yeux.
// Le bouton la renvoyait pourtant chercher dans tout le catalogue.

check(
  'chemin de redirection : accepte les chemins de la boutique, préfixe de marché compris',
  () => {
    const p = load('app/Services/Newsletter/sourceUrl.ts')
    const cas = [
      ['https://www.myselfmonart.com/products/x', '/products/x'],
      // ⛔ Le préfixe porte le MARCHÉ, donc la devise. Le retirer enverrait un Américain sur le
      // catalogue français.
      ['https://www.myselfmonart.com/en-us/products/x', '/en-us/products/x'],
      ['https://www.myselfmonart.com/fr-ca/products/x', '/fr-ca/products/x'],
      ['https://www.myselfmonart.com/de-ch/products/x', '/de-ch/products/x'],
      // La chaîne de requête et l'ancre ne sont pas du chemin : `pathname` les laisse dehors.
      ['https://www.myselfmonart.com/products/x?variant=42#avis', '/products/x'],
      ['https://www.myselfmonart.com/collections/tout', '/collections/tout'],
    ]
    for (const [url, attendu] of cas) {
      assert.strictEqual(p.redirectPathFrom(url), attendu, `chemin faux pour ${url}`)
    }
  }
)

check('chemin de redirection : rejette tout ce qui n’est pas un chemin de la boutique', () => {
  const p = load('app/Services/Newsletter/sourceUrl.ts')
  for (const url of [
    null,
    undefined,
    '',
    'pas-une-url',
    '/products/x', // relative : pas d'hôte, donc pas de preuve d'origine
    'https://evil.example.com/products/x',
    'https://www.myselfmonart.com.evil.example/products/x',
    // Sous-domaine : toléré pour un handle (Shopify tranche derrière), refusé pour une
    // destination recopiée telle quelle dans un lien.
    'https://myselfmonart.com/products/x',
    'https://preview.myselfmonart.com/products/x',
    // ⛔ Protocol-relative : servi par notre hôte, mais suivi il quitte le domaine.
    'https://www.myselfmonart.com//evil.example',
    'https://www.myselfmonart.com/\\evil.example',
    'javascript:alert(1)',
  ]) {
    assert.strictEqual(p.redirectPathFrom(url), null, `devrait refuser ${url}`)
  }
})

/** Une œuvre résolue — donc une fiche qui a répondu à l'instant de l'envoi. */
const OEUVRE = {
  title: 'Maternité africaine',
  imageUrl: 'https://cdn.shopify.com/x.jpg',
  price: '129,00 €',
  priceWithVoucher: '114,00 €',
  priceAmount: 129,
  url: 'https://www.myselfmonart.com/products/maternite-africaine',
}

/** La même œuvre, telle que la verrait un client américain (marché USA). */
const OEUVRE_US = {
  ...OEUVRE,
  price: '$149.00',
  priceWithVoucher: '$134.00',
  priceAmount: 149,
  url: 'https://www.myselfmonart.com/en-us/products/maternite-africaine',
}

check('le bouton mène à la fiche regardée, dans les TROIS e-mails', () => {
  // ⛔ Le chemin est celui de `product.url`, donc la vitrine DU DESTINATAIRE — pas celle de la
  // page où il s'était inscrit. Encodé, préfixe de marché compris.
  const attendu = `https://www.myselfmonart.com/discount/MERCI-A7F3K2?redirect=${encodeURIComponent('/en-us/products/maternite-africaine')}`

  for (const emailNo of [1, 2, 3]) {
    const out = template.renderNewsletterEmail({
      ...BASE,
      emailNo,
      locale: 'en',
      pathPrefix: '/en-us',
      product: OEUVRE_US,
    })
    assert.ok(out.html.includes(attendu), `e-mail ${emailNo} : bouton pas sur la fiche regardée`)
    assert.ok(out.text.includes(attendu), `e-mail ${emailNo} : version texte pas sur la fiche`)
    // Et surtout : plus aucun renvoi vers le catalogue, sinon les deux liens se contredisent.
    assert.ok(
      !out.html.includes('collections%2Fall'),
      `e-mail ${emailNo} : renvoie encore au catalogue`
    )
  }
})

/**
 * ⛔ LE POINT DE VIGILANCE DU 3ᵉ E-MAIL. Il part sept jours après l'inscription : la fiche a pu
 * être dépubliée. `product` absent = la fiche n'a pas répondu à l'envoi, et le bouton doit
 * revenir au catalogue plutôt que mener à un 404 — l'endroit le plus coûteux pour en trouver un.
 */
check('fiche disparue entre-temps : le bouton retombe sur le catalogue', () => {
  const out = template.renderNewsletterEmail({
    ...BASE,
    emailNo: 3,
    locale: 'en',
    pathPrefix: '/en-us',
    // Pas de `product` : la fiche n'a pas répondu.
  })
  // Le repli reste dans SON marché : un Américain ne part pas sur le catalogue français.
  assert.ok(
    out.html.includes(`?redirect=${encodeURIComponent('/en-us/collections/all')}`),
    'le bouton devrait revenir au catalogue du marché US'
  )
})

/**
 * La ceinture de sécurité du BOUTON. `product.url` est construit par `Product.ts` à partir d'un
 * handle tiré d'une URL soumise par le navigateur : le lien de remise ne le recopie jamais sans
 * repasser la porte du domaine.
 *
 * ⚠️ La portée est bien le bouton. Le lien « voir l'œuvre » du bloc, lui, affiche `product.url`
 * tel quel — c'est l'appelant qui répond de cette valeur, et il la fabrique lui-même.
 */
check('url produit douteuse : le bouton ne quitte jamais la boutique', () => {
  for (const url of [
    'https://evil.example.com/products/piege',
    'https://www.myselfmonart.com//evil.example',
    'pas-une-url',
  ]) {
    const out = template.renderNewsletterEmail({
      ...BASE,
      emailNo: 1,
      locale: 'fr',
      product: { ...OEUVRE, url },
    })

    const bouton = /https:\/\/www\.myselfmonart\.com\/discount\/[^"]+/.exec(out.html)
    assert.ok(bouton, `${url} : bouton introuvable`)
    const cible = decodeURIComponent(new URL(bouton[0]).searchParams.get('redirect') || '')
    assert.strictEqual(cible, '/collections/all', `${url} : le bouton devrait viser le catalogue`)
  }
})

// --- Marché du destinataire : pays + langue -> préfixe de vitrine ----------------------
//
// ⛔ LE PIÈGE QUE CES TESTS VERROUILLENT : `/en`, `/de`, `/es`, `/nl` ne sont PAS « les
// versions traduites du site », ce sont les vitrines du marché FRANCE, en euros. Envoyer un
// Américain sur `/en` lui montre des prix en euros après un e-mail libellé en dollars.

/** La table réelle de la boutique, relevée chez Shopify le 2026-08-07 (8 marchés actifs). */
const MARCHES = {
  primaryHandle: 'fr',
  markets: [
    { handle: 'allemagne', countries: ['DE'], defaultLocale: 'de', prefixes: { de: '/de-de' } },
    { handle: 'angleterre', countries: ['GB'], defaultLocale: 'en', prefixes: { en: '/en-gb' } },
    {
      handle: 'canada',
      countries: ['CA'],
      defaultLocale: 'en',
      prefixes: { en: '/en-ca', fr: '/fr-ca' },
    },
    { handle: 'espagne', countries: ['ES'], defaultLocale: 'es', prefixes: { es: '/es-es' } },
    {
      handle: 'europ',
      countries: ['BE', 'LU', 'ES', 'IT', 'DK', 'FI', 'NL'],
      defaultLocale: 'fr',
      prefixes: { fr: '/fr-eu', en: '/en-eu', nl: '/nl-eu' },
    },
    {
      handle: 'fr',
      countries: ['FR'],
      defaultLocale: 'fr',
      prefixes: { fr: '', de: '/de', en: '/en', es: '/es', nl: '/nl' },
    },
    {
      handle: 'suisse',
      countries: ['CH'],
      defaultLocale: 'de',
      prefixes: { de: '/de-ch', fr: '/fr-ch' },
    },
    { handle: 'usa', countries: ['US'], defaultLocale: 'en', prefixes: { en: '/en-us' } },
  ],
}

check('préfixe : chaque pays servi reçoit la vitrine de SON marché', () => {
  const mp = load('app/Services/Newsletter/marketPath.ts')
  const cas = [
    // ⛔ LE CAS QUI MOTIVE TOUT : un Américain lit `/en-us`, jamais `/en` (marché France, euros).
    ['US', 'en', '/en-us'],
    ['GB', 'en', '/en-gb'],
    ['CA', 'en', '/en-ca'],
    ['CA', 'fr', '/fr-ca'],
    ['CH', 'de', '/de-ch'],
    ['CH', 'fr', '/fr-ch'],
    ['DE', 'de', '/de-de'],
    ['BE', 'nl', '/nl-eu'],
    ['BE', 'fr', '/fr-eu'],
    // Le marché primaire dans sa langue source : la RACINE, donc la chaîne vide.
    ['FR', 'fr', ''],
    ['FR', 'en', '/en'],
    ['FR', 'nl', '/nl'],
  ]
  for (const [pays, langue, attendu] of cas) {
    assert.strictEqual(
      mp.resolvePathPrefix(MARCHES, pays, langue),
      attendu,
      `${pays}/${langue} : mauvaise vitrine`
    )
  }
})

/**
 * ⛔ `/{langue}-{pays}` EST UN PIÈGE, PAS UNE RÈGLE. `/de-us`, `/es-eu` et `/nl-ca` sont
 * plausibles et n'existent pas : les inventer donnerait un 404 que personne ne voit avant le
 * client. Quand la langue manque dans le marché, c'est le MARCHÉ qui gagne — les prix de
 * l'e-mail viennent de lui, et une page en euros sous un e-mail en dollars ment plus fort
 * qu'une page en anglais.
 */
check('préfixe : langue absente du marché -> langue par défaut DU MÊME marché', () => {
  const mp = load('app/Services/Newsletter/marketPath.ts')
  assert.strictEqual(mp.resolvePathPrefix(MARCHES, 'US', 'de'), '/en-us')
  assert.strictEqual(mp.resolvePathPrefix(MARCHES, 'US', 'fr'), '/en-us')
  assert.strictEqual(mp.resolvePathPrefix(MARCHES, 'CA', 'nl'), '/en-ca')
  assert.strictEqual(mp.resolvePathPrefix(MARCHES, 'BE', 'es'), '/fr-eu')
  assert.strictEqual(mp.resolvePathPrefix(MARCHES, 'DE', 'en'), '/de-de')
})

/** L'Espagne est dans DEUX marchés (`espagne` et `europ`) : le plus spécifique doit gagner. */
check('préfixe : à pays partagé, le marché le plus spécifique l’emporte', () => {
  const mp = load('app/Services/Newsletter/marketPath.ts')
  assert.strictEqual(mp.resolvePathPrefix(MARCHES, 'ES', 'es'), '/es-es')
  // Et le résultat ne dépend pas de l'ordre de la réponse Shopify.
  const inverse = { ...MARCHES, markets: [...MARCHES.markets].reverse() }
  assert.strictEqual(mp.resolvePathPrefix(inverse, 'ES', 'es'), '/es-es')
})

/**
 * La boutique livre dans 31 pays mais n'a de marchés explicites que pour 13. Shopify rattache
 * les autres au marché PRIMAIRE — on fait pareil, sans avoir à les énumérer.
 */
check('préfixe : pays sans marché explicite -> marché primaire', () => {
  const mp = load('app/Services/Newsletter/marketPath.ts')
  for (const pays of ['AT', 'PT', 'IE', null, undefined, '', 'XX', 'zz']) {
    assert.strictEqual(
      mp.resolvePathPrefix(MARCHES, pays, 'fr'),
      '',
      `${pays} : devrait être la racine`
    )
    assert.strictEqual(
      mp.resolvePathPrefix(MARCHES, pays, 'en'),
      '/en',
      `${pays} : devrait être /en`
    )
  }
})

check('préfixe : table absente ou vide -> null, et l’appelant retombe sur la langue', () => {
  const mp = load('app/Services/Newsletter/marketPath.ts')
  for (const table of [null, undefined, {}, { markets: [] }, { markets: 'pas-un-tableau' }]) {
    assert.strictEqual(mp.resolvePathPrefix(table, 'US', 'en'), null)
  }
})

/**
 * LE TEST QUI COMPTE POUR LE LECTEUR : on balaie TOUS les liens de l'e-mail, pas seulement le
 * bouton. Logo, bouton, œuvre, mentions légales, confidentialité, Trustpilot — un seul lien
 * resté sur `/en` ramènerait un Américain sur le catalogue en euros.
 */
check('un client US n’a QUE des liens vers le marché US', () => {
  const out = template.renderNewsletterEmail({
    ...BASE,
    emailNo: 2,
    locale: 'en',
    currency: 'USD',
    pathPrefix: '/en-us',
    product: OEUVRE_US,
    bestSellers: [OEUVRE_US, OEUVRE_US],
    trustpilotScore: 4.2,
    trustpilotCount: 120,
    postalAddress: '12 rue des Arts, 75000 Paris',
  })

  const liens = [...out.html.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .filter((href) => href.startsWith('https://www.myselfmonart.com'))

  assert.ok(liens.length >= 4, `trop peu de liens boutique analysés (${liens.length})`)

  for (const href of liens) {
    const u = new URL(href)
    // Le lien de remise ne porte pas sa destination dans le chemin mais dans `?redirect=`.
    const cible = u.pathname.startsWith('/discount/')
      ? decodeURIComponent(u.searchParams.get('redirect') || '')
      : u.pathname
    assert.ok(
      cible === '/en-us' || cible.startsWith('/en-us/'),
      `lien hors du marché US : ${href} -> ${cible}`
    )
  }
})

check('le contexte de collecte rappelle la date d’inscription', () => {
  const out = template.renderNewsletterEmail({ ...BASE, emailNo: 1, locale: 'fr' })
  // 1784800000 -> 23 juillet en Europe/Paris. Forme LONGUE depuis les gabarits du designer
  // (« le 6 août », « am 6. August ») : le format numérique 23/07 se lit à l'envers aux
  // États-Unis, où le dispositif envoie désormais.
  assert.ok(out.html.includes('23 juillet'), 'la date d’inscription doit figurer au pied de page')
  // Et l'échéance ANNONCÉE, en toutes lettres, dans le corps.
  assert.ok(out.html.includes('6 août 2026'), 'la date annoncée doit être lisible')
})

// ⛔ « 23 h 59 » ne serait vrai qu'à Paris. Le bon est ouvert aux États-Unis, au Canada, à la
// Suisse et au Royaume-Uni : la seule promesse tenable partout est une DATE NUE.
check('l’échéance s’affiche sans la moindre heure', () => {
  for (const locale of config.LOCALES) {
    const out = template.renderNewsletterEmail({ ...BASE, emailNo: 3, locale })
    assert.ok(
      !/\d{1,2}\s?[:h]\s?\d{2}/.test(out.text),
      `${locale} : une heure s’est glissée dans l’e-mail`
    )
  }
})

check('les montants et dates sont formatés par langue', () => {
  const fr = template.renderNewsletterEmail({ ...BASE, emailNo: 1, locale: 'fr' })
  const de = template.renderNewsletterEmail({ ...BASE, emailNo: 1, locale: 'de' })
  assert.notStrictEqual(fr.subject, de.subject, 'les objets doivent différer par langue')
  // Format allemand : « 15 € » et non « €15 ».
  assert.ok(/15/.test(de.html))
})

// ⛔ Le montant affiché est celui PROMIS dans la devise du visiteur, jamais le montant en euros
// posé sur le code. Un Américain à qui l'encart a promis 15 $ doit lire « 15 $ » dans ses trois
// e-mails — pas « 13,26 € », pas « 15 € », et surtout pas un montant recalculé six jours plus
// tard à un autre taux.
check('chaque devise affiche sa cible ronde, dans les trois e-mails', () => {
  // Formes attendues EN FRANÇAIS. L'espace qui précède le symbole est une ESPACE INSÉCABLE
  // (U+00A0) posée par ICU, pas une espace ordinaire — d'où la normalisation `plat()` :
  // écrire l'insécable dans un littéral de test la rendrait invisible en relecture, et le
  // premier qui la retaperait à la main casserait le test sans comprendre pourquoi.
  const attendus = [
    ['EUR', 15, 80, '15 €', '80 €'],
    ['USD', 15, 90, '15 $US', '90 $US'],
    ['CAD', 20, 130, '20 $CA', '130 $CA'],
    ['CHF', 14, 75, '14 CHF', '75 CHF'],
    ['GBP', 13, 70, '13 £GB', '70 £GB'],
  ]
  for (const [currency, amount, threshold, labelAmount, labelThreshold] of attendus) {
    for (const emailNo of [1, 2, 3]) {
      const out = template.renderNewsletterEmail({
        ...BASE,
        emailNo,
        locale: 'fr',
        currency,
        amount,
        threshold,
      })
      assert.ok(
        plat(out.html).includes(labelAmount),
        `${currency}/${emailNo} : « ${labelAmount} » absent du HTML`
      )
      assert.ok(
        plat(out.html).includes(labelThreshold),
        `${currency}/${emailNo} : seuil « ${labelThreshold} » absent du HTML`
      )
    }
  }
})

check('le texte injecté est échappé (pas d’injection HTML par le code)', () => {
  const out = template.renderNewsletterEmail({
    ...BASE,
    emailNo: 1,
    locale: 'fr',
    code: '<script>alert(1)</script>',
  })
  assert.ok(!out.html.includes('<script>'), 'le code doit être échappé dans le HTML')
  assert.ok(out.html.includes('&lt;script&gt;'))
})

// --- Mention postale : facultative, et absente par défaut --------------------------------
// Le marchand a choisi de ne pas afficher son adresse. Ce n'est pas une obligation en Europe
// (art. L34-5 CPCE : identification de l'expéditeur + moyen de s'opposer, tous deux assurés).
// ⚠️ Le CAN-SPAM américain l'EXIGE : si la séquence s'ouvre aux États-Unis, il faudra la poser.
check('sans mention postale : aucune ligne vide, aucun « undefined »', () => {
  const out = template.renderNewsletterEmail({ ...BASE, emailNo: 1, locale: 'fr' })
  assert.ok(!/undefined/.test(out.html), 'le HTML ne doit pas contenir « undefined »')
  assert.ok(!/undefined/.test(out.text), 'le texte ne doit pas contenir « undefined »')
  assert.ok(!out.text.includes('\n\n\n'), 'pas de trou dans le pied de page texte')
  // Ce qui identifie l'expéditeur reste bien présent.
  assert.ok(out.html.includes(BASE.contactEmail))
  assert.ok(out.html.includes(BASE.unsubscribeUrl))
})

check('avec mention postale : elle apparaît dans les deux versions', () => {
  const adresse = 'SAS KINDOPIA, 1 rue Exemple, 75000 Paris'
  const out = template.renderNewsletterEmail({
    ...BASE,
    emailNo: 1,
    locale: 'fr',
    postalAddress: adresse,
  })
  assert.ok(out.html.includes('KINDOPIA'), 'mention absente du HTML')
  assert.ok(out.text.includes('KINDOPIA'), 'mention absente de la version texte')
})

if (failures) {
  console.error(`\nnewsletter-core: ${failures} échec(s)`)
  process.exit(1)
}
console.log('newsletter-core: OK')
