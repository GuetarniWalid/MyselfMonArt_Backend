/**
 * Test « golden » des FORMATS D'IMPRESSION du studio.
 *
 * POURQUOI CE TEST EXISTE
 * Le produit poster vend QUATRE tailles (30x40, 60x80, 75x100, 90x120). Le studio n'en gérait que
 * DEUX : un client qui choisissait 75x100 ou 90x120 recevait « Variante inconnue », sur le format
 * le plus cher du catalogue. La cause profonde était silencieuse — la table de reconnaissance des
 * variantes était un simple tableau, donc oublier une taille ne provoquait AUCUNE erreur de
 * compilation. Ce test rend l'oubli impossible et démontre l'arithmétique plutôt que de la
 * commenter.
 *
 * CE QU'IL VERROUILLE
 *  1. les quatre tailles existent partout (type, gabarits, reconnaissance de variante) ;
 *  2. la densité annoncée à l'imprimeur est EXACTE (px = cm ÷ 2,54 × dpi) — le 60x80 annonçait
 *     200 dpi alors qu'il n'en avait réellement que 152 ;
 *  3. aucun gabarit ne dépasse l'information réellement disponible : au-delà, on fabriquerait des
 *     pixels inventés, en payant de la mémoire (un 90x120 à 200 dpi demandait 776 Mo, plus que le
 *     conteneur entier).
 *
 * POURQUOI PAS JAPA : mêmes raisons que les autres goldens — ce sont des constantes pures, on les
 * charge en transpilant le TypeScript en mémoire, `node` suffit.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const ts = require(path.join(ROOT, 'node_modules/typescript'))

/** Largeur réellement disponible : l'œuvre sort en 896 px de large, l'agrandisseur la multiplie par 4. */
const LARGEUR_REELLE_MAX = 896 * 4

const STUBS = {
  '@ioc:Adonis/Core/Logger': { __esModule: true, default: { info() {}, warn() {}, error() {} } },
  '@ioc:Adonis/Core/Env': { __esModule: true, default: { get: () => undefined } },
  '@ioc:Adonis/Lucid/Orm': {
    __esModule: true,
    BaseModel: class BaseModel {},
    column: Object.assign(() => () => {}, { dateTime: () => () => {} }),
    belongsTo: () => () => {},
  },
  '@ioc:Adonis/Core/Validator': {
    __esModule: true,
    schema: {
      create: (o) => o,
      string: Object.assign(() => 'string', { optional: () => 'string' }),
      number: Object.assign(() => 'number', { optional: () => 'number' }),
      enum: Object.assign((v) => v, { optional: (v) => v }),
      file: Object.assign(() => 'file', { optional: () => 'file' }),
      boolean: Object.assign(() => 'boolean', { optional: () => 'boolean' }),
    },
    rules: new Proxy({}, { get: () => () => ({}) }),
  },
  'App/Models/CustomArtSession': { __esModule: true, default: class CustomArtSession {} },
  'App/Models/CustomArtTeam': { __esModule: true, default: class CustomArtTeam {} },
}

function loadTsModule(absPath, extraStubs = {}) {
  const js = ts.transpileModule(fs.readFileSync(absPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const stubs = { ...STUBS, ...extraStubs }
  const module = { exports: {} }
  const req = (id) => {
    if (stubs[id]) return stubs[id]
    if (id.startsWith('.')) return loadTsModule(resolveTs(path.dirname(absPath), id), extraStubs)
    return require(id)
  }
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(req, module, module.exports)
  return module.exports
}

function resolveTs(dir, id) {
  const base = path.resolve(dir, id)
  for (const candidate of [base + '.ts', path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return base + '.ts'
}

let pass = 0
let fail = 0
function ok(cond, label) {
  if (cond) pass++
  else {
    fail++
    console.log('  FAIL  ' + label)
  }
}

// ── Les tailles vendues, et ce qu'elles mesurent en centimètres ──────────────────────────────
const TAILLES = {
  '30x40': { cm: [30, 40], dpi: 300 },
  '60x80': { cm: [60, 80], dpi: 150 },
  '75x100': { cm: [75, 100], dpi: 120 },
  '90x120': { cm: [90, 120], dpi: 100 },
}

const { PRINT_SPECS } = loadTsModule(
  path.join(ROOT, 'app/Services/CustomArt/PrintFileService.ts'),
  {
    // On ne veut que la constante : tout le reste du service est neutralisé.
    'axios': { __esModule: true, default: {} },
    'sharp': { __esModule: true, default: () => ({}) },
    'crypto': { randomUUID: () => 'x' },
    './Storage': { __esModule: true, default: {} },
    './PrintMailer': { __esModule: true, default: class PrintMailer {} },
    './chosenCandidate': { __esModule: true, chosenCandidate: () => null },
    './jobLabelling': { __esModule: true, describeJob: () => ({}) },
    'App/Models/CustomArtJob': { __esModule: true, default: class CustomArtJob {} },
    'App/Models/CustomArtOrder': { __esModule: true, default: class CustomArtOrder {} },
  }
)

// ── 1. Les quatre tailles vendues ont un gabarit ─────────────────────────────────────────────
for (const taille of Object.keys(TAILLES)) {
  ok(Boolean(PRINT_SPECS[taille]), `la taille ${taille} a un gabarit d'impression`)
}
ok(
  Object.keys(PRINT_SPECS).length === Object.keys(TAILLES).length,
  'aucun gabarit en trop ni en moins'
)

// ── 2. La densité annoncée à l'imprimeur est EXACTE ──────────────────────────────────────────
// C'est le contrôle qui aurait attrapé le mensonge du 60x80 (200 annoncés, 152 réels).
for (const [taille, { cm, dpi }] of Object.entries(TAILLES)) {
  const spec = PRINT_SPECS[taille]
  if (!spec) continue
  const dpiLargeur = spec.width / (cm[0] / 2.54)
  const dpiHauteur = spec.height / (cm[1] / 2.54)
  ok(
    Math.abs(dpiLargeur - spec.dpi) < 1,
    `${taille} : la densité annoncée (${spec.dpi}) correspond à la largeur réelle (${dpiLargeur.toFixed(1)})`
  )
  ok(
    Math.abs(dpiHauteur - spec.dpi) < 1,
    `${taille} : la densité annoncée correspond aussi à la hauteur (${dpiHauteur.toFixed(1)})`
  )
  ok(spec.dpi === dpi, `${taille} : densité attendue ${dpi} dpi`)
}

// ── 3. Aucun gabarit ne réclame plus de pixels qu'il n'en existe ─────────────────────────────
// Au-delà, sharp interpole : des pixels inventés, payés en mémoire. Un 90x120 à 200 dpi
// (7087x9449) demandait 776 Mo — plus que les 768 Mo du conteneur.
for (const [taille, spec] of Object.entries(PRINT_SPECS)) {
  ok(
    spec.width <= LARGEUR_REELLE_MAX,
    `${taille} : le gabarit (${spec.width} px) ne dépasse pas l'information disponible (${LARGEUR_REELLE_MAX} px)`
  )
}

// ── 4. Le studio reconnaît les libellés de variante RÉELS de la fiche Shopify ────────────────
const VariantMapping = loadTsModule(path.join(ROOT, 'app/Services/CustomArt/VariantMapping.ts'), {
  'App/Services/Shopify/Variant': { __esModule: true, default: class Variant {} },
  'App/Models/CustomArtJob': { __esModule: true, default: class CustomArtJob {} },
}).default

const LIBELLES_SHOPIFY = {
  '30x40 cm': '30x40',
  '60x80 cm': '60x80',
  '75x100 cm': '75x100',
  '90x120 cm': '90x120',
}
for (const [libelle, attendu] of Object.entries(LIBELLES_SHOPIFY)) {
  const resolu = VariantMapping.fromOptions({
    selectedOptions: [
      { name: 'Format', value: libelle },
      { name: 'Cadre', value: 'Sans cadre' },
    ],
    product: { id: 'gid://shopify/Product/1' },
  })
  ok(resolu && resolu.format === attendu, `« ${libelle} » est reconnu comme ${attendu}`)
  ok(resolu && resolu.frame === 'none', `« ${libelle} » : « Sans cadre » donne bien 'none'`)
}

// ── 5. Le validateur accepte les quatre tailles ──────────────────────────────────────────────
// Il s'exécute AVANT la résolution de variante : un enum trop étroit refuse la commande en amont,
// quoi qu'on corrige ailleurs. C'est ce qui produisait le refus sur 75x100 et 90x120.
const validateurSource = fs.readFileSync(
  path.join(ROOT, 'app/Validators/CustomArtJobValidator.ts'),
  'utf8'
)
for (const taille of Object.keys(TAILLES)) {
  ok(validateurSource.includes(`'${taille}'`), `le validateur accepte la taille ${taille}`)
}

// ── 6. Les libellés d'e-mail client couvrent les quatre tailles ──────────────────────────────
const mailerSource = fs.readFileSync(
  path.join(ROOT, 'app/Services/CustomArt/OrderMailer.ts'),
  'utf8'
)
for (const taille of Object.keys(TAILLES)) {
  ok(mailerSource.includes(`'${taille}':`), `l'e-mail client sait nommer la taille ${taille}`)
}

console.log(`golden print-formats : ${pass} OK, ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
