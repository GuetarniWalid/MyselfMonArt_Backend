/**
 * Test « golden » du schéma de recette studio — RecipeService.parseRecipe().
 *
 * POURQUOI CE TEST EXISTE
 * Le produit famille (gid 10565374247259) tourne EN PRODUCTION sur le chemin générique. Toute
 * évolution du schéma de recette (chantier d'unification du studio, cf.
 * extension-Midjourney/PLAN-UNIFICATION-STUDIO-FOOT.md) doit être ADDITIVE : une recette existante
 * doit continuer de produire EXACTEMENT le même objet. Ce test gèle cette sortie dans un instantané
 * (`family-recipe.snapshot.json`) et échoue à la moindre dérive.
 *
 * POURQUOI PAS JAPA
 * `node ace test` démarre l'application entière (env validé, base, clés d'API). parseRecipe est une
 * fonction PURE : ni IoC, ni réseau, ni base. Ce test la charge en transpilant le TypeScript en
 * mémoire et en stubbant les quelques imports Adonis — il tourne avec un simple `node`, sans aucune
 * variable d'environnement, donc aussi bien en local qu'en CI.
 *
 * USAGE
 *   npm run test:golden              # vérifie
 *   npm run test:golden -- --update  # régénère l'instantané (uniquement si la dérive est VOULUE)
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const SRC = path.join(ROOT, 'app/Services/CustomArt/RecipeService.ts')
const SNAPSHOT = path.join(__dirname, 'family-recipe.snapshot.json')
const ts = require(path.join(ROOT, 'node_modules/typescript'))

// `__esModule: true` est indispensable : sans lui l'interop TypeScript (__importDefault) ré-emballe
// le stub dans { default: ... } et `class X extends Authentication` casse.
const STUBS = {
  '@ioc:Adonis/Core/Logger': { __esModule: true, default: { info() {}, warn() {}, error() {} } },
  '@ioc:Adonis/Core/Env': { __esModule: true, default: { get: () => undefined } },
  'App/Services/Shopify/Authentication': { __esModule: true, default: class Authentication {} },
  './blocklist': { __esModule: true, isBlockedFirstName: () => false },
}

function loadRecipeService() {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      importHelpers: false,
    },
  }).outputText
  const customRequire = (id) =>
    Object.prototype.hasOwnProperty.call(STUBS, id) ? STUBS[id] : require(id)
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', js)(customRequire, mod, mod.exports)
  if (!mod.exports.default || typeof mod.exports.default.parseRecipe !== 'function') {
    throw new Error('RecipeService.parseRecipe introuvable')
  }
  return mod.exports.default
}

const RecipeService = loadRecipeService()

/**
 * Recette de RÉFÉRENCE — même STRUCTURE que celle du produit famille en production (mêmes clés,
 * mêmes formes, mêmes types). Les fragments de prompt sont abrégés : le parseur ne juge que la
 * présence, le type et la longueur, jamais le contenu rédactionnel.
 */
const FAMILY_RECIPE = JSON.stringify({
  version: 1,
  engine: 'gemini',
  model: 'gemini-3-pro-image',
  aspect: '3:4',
  candidates: 3,
  maxAttempts: 2,
  inputs: {
    tokens: { from: 'names', split: true, max: 6 },
    title: { template: 'La famille {familyName}', required: true },
  },
  reference: {
    texts: { title: 'The Smith Family', slots: ['DADDY', 'FRANCO', 'MOMMY', 'VERONICA'] },
  },
  prompt: {
    base: 'Create a minimalist single continuous-line illustration on pure white background.',
    imageRoles: 'IMAGE 1 is the CUSTOMER PHOTO. IMAGE 2 is the STYLE REFERENCE.',
    countLine: 'The final illustration shows EXACTLY {n} person(s): {tokens}.',
    replaceTitle: 'Replace « {from} » with « {to} » in the reference script font.',
    perPerson: 'Under person #{index}, replace « {from} » with « {to} ».',
    addExtra: 'Add one more person consistent with the photo, captioned « {to} ».',
    removeExtra: 'Remove the person captioned « {from} » and that caption.',
    footer: '',
  },
  judge: { text: true, figureCount: true },
})

let pass = 0
let fail = 0
const ok = (cond, label, detail) => {
  if (cond) {
    pass++
  } else {
    fail++
    console.log(`  FAIL  ${label}${detail ? `\n        -> ${detail}` : ''}`)
  }
}
// Les motifs de rejet sont en français accentué : on compare sans accents ni casse, pour tester le
// FOND (le bon motif) et non l'orthographe exacte du message.
const flat = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const rejects = (src, label, fragment) => {
  try {
    RecipeService.parseRecipe(src)
    ok(false, label, 'recette ACCEPTÉE alors qu’elle doit être rejetée')
  } catch (e) {
    const why = (e && e.reasons ? e.reasons.join(' ; ') : e.message) || ''
    ok(!fragment || flat(why).includes(flat(fragment)), label, `motif obtenu : ${why}`)
  }
}

// ============================================================================================
// 1. NON-RÉGRESSION — la recette famille doit produire EXACTEMENT l'objet figé
// ============================================================================================
const actual = RecipeService.parseRecipe(FAMILY_RECIPE)
const actualJson = JSON.stringify(actual, null, 2)

if (process.argv.includes('--update') || !fs.existsSync(SNAPSHOT)) {
  fs.writeFileSync(SNAPSHOT, actualJson + '\n', 'utf8')
  console.log(`instantané écrit : ${path.relative(ROOT, SNAPSHOT)}`)
} else {
  const expected = fs.readFileSync(SNAPSHOT, 'utf8').trim()
  ok(
    actualJson === expected,
    'recette FAMILLE : sortie identique à l’instantané (valeurs ET ordre des clés)',
    actualJson === expected
      ? ''
      : `dérive détectée. Si elle est VOULUE : npm run test:golden -- --update\n${actualJson}`
  )
}
ok(!('fields' in actual), 'aucune clé "fields" ajoutée à une recette qui n’en déclare pas')

// Un tableau vide doit être traité comme absent (sinon l'invariant ci-dessus tombe).
const emptyFields = RecipeService.parseRecipe(
  JSON.stringify({ version: 1, inputs: { fields: [] }, prompt: { base: 'x' } })
)
ok(!('fields' in emptyFields), 'inputs.fields: [] ne produit AUCUNE clé fields')

// ============================================================================================
// 2. CAPACITÉ — une recette déclarant des champs (cible : le poster foot)
// ============================================================================================
const FOOT_RECIPE = JSON.stringify({
  version: 1,
  model: 'gemini-3-pro-image',
  inputs: {
    fields: [
      {
        name: 'teamId',
        type: 'choice',
        options: [
          {
            key: 'paris',
            label: 'Paris',
            notes: 'Bande centrale verticale ; blason côté cœur.',
            references: [
              { name: 'paris-front.jpg', role: 'front' },
              { name: 'paris-back.jpg', role: 'back' },
            ],
          },
          {
            key: 'france',
            label: 'Équipe de France',
            references: [{ name: 'france-back.jpg', role: 'back' }],
          },
        ],
      },
      { name: 'playerName', type: 'text', maxLength: 12, printOnArtwork: 'back-name' },
      { name: 'playerNumber', type: 'number', min: 1, max: 99, printOnArtwork: 'back-number' },
    ],
  },
  prompt: { base: 'Paint the person from IMAGE 1 as a professional football player.' },
})

let foot = null
try {
  foot = RecipeService.parseRecipe(FOOT_RECIPE)
  ok(true, 'recette foot acceptée')
} catch (e) {
  ok(false, 'recette foot acceptée', (e.reasons || [e.message]).join(' ; '))
}
if (foot) {
  const team = foot.fields.find((f) => f.name === 'teamId')
  const num = foot.fields.find((f) => f.name === 'playerNumber')
  const pname = foot.fields.find((f) => f.name === 'playerName')
  ok(foot.fields.length === 3, '3 champs déclarés')
  ok(team && team.options.length === 2, 'teamId = choix à 2 options')
  ok(team && team.options[0].references.length === 2, 'Paris joint 2 images nommées')
  ok(team && team.options[0].references[1].role === 'back', 'le rôle DOS est conservé')
  ok(team && /bande centrale/i.test(team.options[0].notes || ''), 'la note de fidélité est portée')
  ok(team && team.options[1].notes === null, 'une option sans note porte null')
  ok(num && num.min === 1 && num.max === 99 && num.integer === true, 'numéro borné 1-99, entier')
  ok(num && num.printOnArtwork === 'back-number', 'le numéro est marqué peint sur l’œuvre')
  ok(pname && pname.maxLength === 12, 'prénom limité à 12 caractères')
}

// ============================================================================================
// 3. FAIL-FAST — toute recette malformée est rejetée, jamais appliquée à moitié
// ============================================================================================
const bad = (fields) => JSON.stringify({ version: 1, inputs: { fields }, prompt: { base: 'x' } })
const choice = (options) => bad([{ name: 'teamId', type: 'choice', options }])

rejects(
  choice([{ key: 'a', references: [{ name: 'x.jpg', role: 'dos' }] }]),
  'rôle d’image inconnu',
  'role'
)
rejects(choice([]), 'choix sans aucune option', 'options')
rejects(choice([{ key: 'a', references: [] }]), 'option sans image nommée', 'references')
rejects(
  choice([
    { key: 'dup', references: [{ name: 'a.jpg', role: 'back' }] },
    { key: 'dup', references: [{ name: 'b.jpg', role: 'back' }] },
  ]),
  'clé d’option en double',
  'double'
)
rejects(bad([{ name: 'n', type: 'number', min: 99, max: 1 }]), 'min supérieur à max', 'supérieur')
rejects(bad([{ name: 'n', type: 'number' }]), 'number sans bornes', 'min et max')
rejects(bad([{ name: 'photo', type: 'text' }]), 'nom de champ réservé (photo)', 'réservé')
rejects(
  bad([
    { name: 'a', type: 'text' },
    { name: 'a', type: 'text' },
  ]),
  'nom de champ en double',
  'double'
)
rejects(bad([{ name: 'a', type: 'couleur' }]), 'type de champ non supporté', 'non supporté')
rejects(
  bad([{ name: 'a', type: 'text', printOnArtwork: 'Back Name!' }]),
  'slot de placement invalide',
  'printonartwork'
)
rejects(
  JSON.stringify({
    version: 1,
    inputs: { tokens: { from: 'names' }, fields: [{ name: 'names', type: 'text' }] },
    prompt: { base: 'x' },
  }),
  'collision champ ↔ source des tokens',
  'tokens'
)

// Coercion silencieuse : Number(null) valait 0 -> borne fantôme née d'une faute de frappe admin.
rejects(
  bad([{ name: 'n', type: 'number', min: null, max: 99 }]),
  'min: null refusé (pas lu comme 0)',
  'nombres'
)
rejects(bad([{ name: 'n', type: 'number', min: '', max: 99 }]), 'min: "" refusé', 'nombres')
rejects(bad([{ name: 'n', type: 'number', min: [], max: 99 }]), 'min: [] refusé', 'nombres')
rejects(
  bad([{ name: 'n', type: 'number', min: '1', max: '99' }]),
  'bornes en chaîne refusées',
  'nombres'
)
rejects(
  bad([{ name: 't', type: 'text', maxLength: '50' }]),
  'maxLength en chaîne refusée',
  'nombre'
)
// Domaine vide : un champ requis que le client ne pourrait jamais satisfaire.
rejects(
  bad([{ name: 'n', type: 'number', min: 1.2, max: 1.8 }]),
  'bornes fractionnaires si integer',
  'entiers'
)
// Membres d'Object.prototype : ces noms finissent en clés d'un Record<string, string>.
rejects(
  bad([{ name: 'constructor', type: 'text' }]),
  'nom de champ "constructor" refusé',
  'réservé'
)
rejects(bad([{ name: 'hasOwnProperty', type: 'text' }]), 'nom "hasOwnProperty" refusé', 'réservé')

let frac = null
try {
  frac = RecipeService.parseRecipe(
    bad([{ name: 'n', type: 'number', min: 1.5, max: 9.5, integer: false }])
  )
} catch (e) {
  /* échec capturé par l'assertion suivante */
}
ok(frac && frac.fields[0].integer === false, 'bornes fractionnaires ACCEPTÉES si integer:false')

// ============================================================================================
console.log(`\ngolden recipe-schema : ${pass} OK, ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
