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
  assert.strictEqual(config.VOUCHER_VALIDITY_DAYS, 14)
  assert.strictEqual(config.SEQUENCE_LENGTH, 3)
  assert.deepStrictEqual([...config.SEQUENCE_GAP_DAYS], [3, 4], 'E2 à J+3, E3 à J+7')
  assert.ok(config.MIN_HOURS_BETWEEN_EMAILS >= 24, 'plancher absolu entre deux e-mails')
  assert.ok(config.MIN_HOURS_BEFORE_EXPIRY >= 72, 'garde des 72 h avant expiration du bon')
  // Liste BLANCHE : une valeur inconnue de l'énuméré Shopify ne doit jamais autoriser un envoi.
  assert.deepStrictEqual(
    [...config.SUBSCRIBABLE_PRIOR_STATES],
    ['NOT_SUBSCRIBED', 'PENDING', 'SUBSCRIBED']
  )
  assert.ok(!config.SUBSCRIBABLE_PRIOR_STATES.includes('UNSUBSCRIBED'))
})

// --- Traductions --------------------------------------------------------------------
check('les cinq langues ont bien les trois e-mails, tous champs remplis', () => {
  for (const locale of config.LOCALES) {
    const p = strings.pack(locale)
    assert.strictEqual(p.emails.length, 3, `${locale} : il faut 3 e-mails`)
    p.emails.forEach((mail, i) => {
      for (const key of [
        'subject',
        'preheader',
        'title',
        'intro',
        'codeLabel',
        'validity',
        'cta',
        'closing',
      ]) {
        assert.ok(mail[key] && mail[key].trim(), `${locale} e-mail ${i + 1} : ${key} vide`)
      }
      assert.ok(mail.reassure.length >= 2, `${locale} e-mail ${i + 1} : réassurance trop courte`)
    })
    for (const key of ['context', 'unsubscribe', 'contact']) {
      assert.ok(p.footer[key] && p.footer[key].trim(), `${locale} : pied de page ${key} vide`)
    }
    for (const key of ['title', 'body', 'button', 'done', 'doneBody']) {
      assert.ok(
        p.unsubscribePage[key] && p.unsubscribePage[key].trim(),
        `${locale} : page de désabonnement ${key} vide`
      )
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
  expiresTs: 1786000000,
  signupTs: 1784800000,
  amountEur: 15,
  minSubtotalEur: 80,
  storeUrl: 'https://www.myselfmonart.com',
  unsubscribeUrl: 'https://backend.myselfmonart.com/u/JETON',
  contactEmail: 'contact@myselfmonart.com',
  postalAddress: 'SAS KINDOPIA, 1 rue Exemple, 75000 Paris',
}

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

      // Mentions légales obligatoires.
      assert.ok(out.html.includes('KINDOPIA'), `${locale}/${emailNo} : mention postale absente`)
      assert.ok(
        out.html.includes(BASE.contactEmail),
        `${locale}/${emailNo} : adresse de contact absente`
      )

      // Le lien boutique doit porter le préfixe de langue.
      const expected = `https://www.myselfmonart.com${template.localePath(locale)}/collections/all`
      assert.ok(
        out.html.includes(expected),
        `${locale}/${emailNo} : lien non localisé (${expected})`
      )
    }
  }
})

check('le contexte de collecte rappelle la date d’inscription', () => {
  const out = template.renderNewsletterEmail({ ...BASE, emailNo: 1, locale: 'fr' })
  // 1784800000 -> 23/07 en Europe/Paris
  assert.ok(out.html.includes('23/07'), 'la date d’inscription doit figurer au pied de page')
  // Et l'échéance du bon, en toutes lettres, dans le corps.
  assert.ok(out.html.includes('6 août 2026'), 'la date d’expiration doit être lisible')
})

check('les montants et dates sont formatés par langue', () => {
  const fr = template.renderNewsletterEmail({ ...BASE, emailNo: 1, locale: 'fr' })
  const de = template.renderNewsletterEmail({ ...BASE, emailNo: 1, locale: 'de' })
  assert.notStrictEqual(fr.subject, de.subject, 'les objets doivent différer par langue')
  // Format allemand : « 15 € » et non « €15 ».
  assert.ok(/15/.test(de.html))
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

if (failures) {
  console.error(`\nnewsletter-core: ${failures} échec(s)`)
  process.exit(1)
}
console.log('newsletter-core: OK')
