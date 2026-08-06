/*
 * Test doré — dérivation de la clé de signature AWS Signature V4.
 *
 * Pourquoi ce test existe : la signature SigV4 est écrite à la main (App/Services/Newsletter/
 * mail/sigv4.ts) pour ne pas ajouter le SDK AWS à un dispositif censé tourner des années sans
 * maintenance. Le prix de ce choix est qu'une erreur de dérivation ne se verrait qu'en
 * production, sous la forme d'un « SignatureDoesNotMatch » — c'est-à-dire d'un canal e-mail
 * qui n'envoie plus rien.
 *
 * On vérifie donc la chaîne de dérivation contre le VECTEUR PUBLIÉ PAR AWS
 * (documentation « Signature Version 4 » — exemple de clé de signature), plus la forme
 * complète d'une requête signée. Aucun réseau, aucune clé réelle.
 *
 * Lancé par `npm run test:golden`, donc avant toute image poussée en production.
 */

const assert = require('assert')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

// Transpilation en mémoire du module TypeScript (même approche que les autres tests dorés :
// pas de build, pas d'environnement Adonis à monter).
const ts = require(path.join(__dirname, '../../node_modules/typescript'))
const SRC = path.join(__dirname, '../../app/Services/Newsletter/mail/sigv4.ts')
const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
  // esModuleInterop : le module source fait `import crypto from 'crypto'` (comme le reste du
  // projet, dont le tsconfig l'active). Sans ce drapeau ici, l'import par défaut d'un module
  // CommonJS de Node se transpile en `crypto_1.default`, qui vaut `undefined`.
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText

const module_ = { exports: {} }
new Function('module', 'exports', 'require', js)(module_, module_.exports, require)
const { signingKey, signFormPost } = module_.exports

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

console.log('newsletter-sigv4')

// --- 1. Vecteur officiel AWS -------------------------------------------------------------
// secret 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', 20150830, us-east-1, iam
check('clé de signature conforme au vecteur publié par AWS', () => {
  const key = signingKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20150830', 'us-east-1', 'iam')
  assert.strictEqual(
    key.toString('hex'),
    'c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9'
  )
})

// --- 2. Portée de la clé -----------------------------------------------------------------
check('la clé change avec le jour, la région et le service', () => {
  const base = signingKey('secret', '20260805', 'eu-west-1', 'ses').toString('hex')
  assert.notStrictEqual(base, signingKey('secret', '20260806', 'eu-west-1', 'ses').toString('hex'))
  assert.notStrictEqual(base, signingKey('secret', '20260805', 'us-east-1', 'ses').toString('hex'))
  assert.notStrictEqual(base, signingKey('secret', '20260805', 'eu-west-1', 's3').toString('hex'))
})

// --- 3. Forme de la requête signée -------------------------------------------------------
const signed = signFormPost({
  host: 'email.eu-west-1.amazonaws.com',
  region: 'eu-west-1',
  service: 'ses',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  body: 'Action=SendRawEmail&Version=2010-12-01',
  amzDate: '20260805T193840Z',
})

check('URL et en-têtes attendus', () => {
  assert.strictEqual(signed.url, 'https://email.eu-west-1.amazonaws.com/')
  assert.strictEqual(signed.headers['X-Amz-Date'], '20260805T193840Z')
  assert.match(signed.headers['Content-Type'], /^application\/x-www-form-urlencoded/)
})

check('en-tête Authorization complet et correctement porté', () => {
  const auth = signed.headers.Authorization
  assert.match(auth, /^AWS4-HMAC-SHA256 /)
  assert.ok(
    auth.includes('Credential=AKIAIOSFODNN7EXAMPLE/20260805/eu-west-1/ses/aws4_request'),
    'la portée doit contenir jour/région/service'
  )
  assert.ok(
    auth.includes('SignedHeaders=content-type;host;x-amz-date'),
    'les en-têtes signés doivent être triés et en minuscules'
  )
  assert.match(auth, /Signature=[0-9a-f]{64}$/)
})

check('signature reproductible pour une même entrée', () => {
  const again = signFormPost({
    host: 'email.eu-west-1.amazonaws.com',
    region: 'eu-west-1',
    service: 'ses',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    body: 'Action=SendRawEmail&Version=2010-12-01',
    amzDate: '20260805T193840Z',
  })
  assert.strictEqual(again.headers.Authorization, signed.headers.Authorization)
})

check('le corps entre dans la signature (un octet modifié la change)', () => {
  const other = signFormPost({
    host: 'email.eu-west-1.amazonaws.com',
    region: 'eu-west-1',
    service: 'ses',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    body: 'Action=SendRawEmail&Version=2010-12-02',
    amzDate: '20260805T193840Z',
  })
  assert.notStrictEqual(other.headers.Authorization, signed.headers.Authorization)
})

// --- 3 bis. Chemin de ressource (SQS) ----------------------------------------------------
// SQS adresse chaque file par son CHEMIN. Si `path` cessait d'entrer dans la signature, tous
// les appels SQS échoueraient en « SignatureDoesNotMatch » — c'est-à-dire que les rebonds et
// les plaintes ne remonteraient plus, en silence, jusqu'à la suspension du compte d'envoi.
check('le chemin de ressource entre dans la signature', () => {
  const base = {
    host: 'sqs.eu-west-1.amazonaws.com',
    region: 'eu-west-1',
    service: 'sqs',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    body: 'Action=ReceiveMessage&Version=2012-11-05',
    amzDate: '20260806T101500Z',
  }
  const racine = signFormPost(base)
  const file = signFormPost({ ...base, path: '/691667571330/ma-file' })

  assert.notStrictEqual(
    file.headers.Authorization,
    racine.headers.Authorization,
    'deux chemins différents doivent produire deux signatures différentes'
  )
  assert.strictEqual(file.url, 'https://sqs.eu-west-1.amazonaws.com/691667571330/ma-file')
  // Rétro-compatibilité : sans `path`, le comportement historique (« / ») ne bouge pas.
  assert.strictEqual(racine.url, 'https://sqs.eu-west-1.amazonaws.com/')
  assert.strictEqual(
    signFormPost({ ...base, path: '/' }).headers.Authorization,
    racine.headers.Authorization
  )
})

check('le jeton de session STS est signé quand il est présent', () => {
  const withToken = signFormPost({
    host: 'email.eu-west-1.amazonaws.com',
    region: 'eu-west-1',
    service: 'ses',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
    sessionToken: 'FQoGZXIvYXdzEBYaDEXAMPLETOKEN',
    body: 'Action=SendRawEmail',
    amzDate: '20260805T193840Z',
  })
  assert.strictEqual(withToken.headers['X-Amz-Security-Token'], 'FQoGZXIvYXdzEBYaDEXAMPLETOKEN')
  assert.ok(
    withToken.headers.Authorization.includes(
      'SignedHeaders=content-type;host;x-amz-date;x-amz-security-token'
    ),
    'le jeton doit figurer dans les en-têtes signés, sinon AWS rejette'
  )
})

// --- 4. Rappel : la sortie n'est pas censée dépendre de crypto au-delà de HMAC-SHA256 -----
check('HMAC-SHA256 disponible dans ce Node', () => {
  assert.ok(crypto.getHashes().includes('sha256'))
})

if (failures) {
  console.error(`\nnewsletter-sigv4: ${failures} échec(s)`)
  process.exit(1)
}
console.log('newsletter-sigv4: OK')
