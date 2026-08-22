/**
 * Test « golden » du choix de modèle d'image — resolveRecipeProviders().
 *
 * POURQUOI CE TEST EXISTE
 * Le Publisher peut désormais imposer un modèle par produit (« ChatGPT plutôt que Gemini pour ce
 * style »). La contrainte du propriétaire est explicite : les tableaux DÉJÀ PUBLIÉS ne doivent
 * rien changer. Une recette SANS clé `providers` doit donc continuer de résoudre exactement son
 * modèle unique historique — et surtout ne PAS se mettre à consulter la chaîne globale.
 * Ce test gèle cette règle ; il échoue à la moindre dérive.
 *
 * POURQUOI PAS JAPA — même raison que recipe-schema.js : la fonction est pure, on transpile le
 * TypeScript en mémoire en stubbant les quelques imports Adonis. Tourne avec un simple `node`.
 *
 * USAGE  node tests/golden/recipe-providers.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const SRC = path.join(ROOT, 'app/Services/CustomArt/providers/index.ts')
const ts = require(path.join(ROOT, 'node_modules/typescript'))

// Variables d'environnement vues par le code testé. Les deux clés sont présentes (c'est le cas en
// production : OPENAI_API_KEY est requise au démarrage), aucune chaîne globale n'est définie.
let ENV = {}
const STUBS = {
  '@ioc:Adonis/Core/Logger': { __esModule: true, default: { info() {}, warn() {}, error() {} } },
  '@ioc:Adonis/Core/Env': { __esModule: true, default: { get: (k) => ENV[k] } },
}

function loadTsModule(absPath, cache = {}) {
  if (cache[absPath]) return cache[absPath]
  const js = ts.transpileModule(fs.readFileSync(absPath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      importHelpers: false,
    },
  }).outputText
  const customRequire = (id) => {
    if (Object.prototype.hasOwnProperty.call(STUBS, id)) return STUBS[id]
    // Tout autre service Adonis atteint par la grappe des providers (Drive via Storage, ...) :
    // stub inerte. Aucun d'eux n'intervient dans le CHOIX du modèle, seulement à la génération.
    if (id.startsWith('@ioc:')) return { __esModule: true, default: {} }
    if (id.startsWith('.')) return loadTsModule(path.join(path.dirname(absPath), `${id}.ts`), cache)
    return require(id)
  }
  const mod = { exports: {} }
  cache[absPath] = mod.exports
  new Function('require', 'module', 'exports', js)(customRequire, mod, mod.exports)
  cache[absPath] = mod.exports
  return mod.exports
}

const { resolveRecipeProviders } = loadTsModule(SRC)
if (typeof resolveRecipeProviders !== 'function')
  throw new Error('resolveRecipeProviders introuvable')

let ok = 0
let ko = 0
const keys = (r, forced) =>
  resolveRecipeProviders({ recipe: r, forcedProvider: forced }).map((p) => p.key)
const check = (label, got, want) => {
  const a = JSON.stringify(got)
  const b = JSON.stringify(want)
  if (a === b) {
    ok++
    console.log('  ✓', label)
  } else {
    ko++
    console.log('  ✗', label, '\n      obtenu :', a, '\n      attendu:', b)
  }
}

process.env.GEMINI_API_KEY = 'test-gemini'
process.env.OPENAI_API_KEY = 'test-openai'
ENV = { OPENAI_API_KEY: 'test-openai' }

console.log('\n▸ Choix du modèle d’image par recette\n')

console.log('1. Recette SANS `providers` — comportement historique intact')
check('un seul modèle, celui de la recette', keys({ model: 'gemini-3-pro-image' }), [
  'gemini:gemini-3-pro-image',
])
check('un autre modèle est suivi tel quel', keys({ model: 'gemini-3.1-flash-image' }), [
  'gemini:gemini-3.1-flash-image',
])

console.log('\n2. Une chaîne globale définie ne DÉTOURNE PAS un ancien produit')
ENV = { OPENAI_API_KEY: 'test-openai', CUSTOM_ART_PROVIDER_CHAIN: 'openai:gpt-image-2' }
check(
  'la recette garde son modèle malgré la chaîne globale',
  keys({ model: 'gemini-3-pro-image' }),
  ['gemini:gemini-3-pro-image']
)
ENV = { OPENAI_API_KEY: 'test-openai' }

console.log('\n3. Recette AVEC `providers` — le modèle choisi passe devant')
check(
  'choisi d’abord, modèle historique en secours',
  keys({
    model: 'gemini-3-pro-image',
    providers: { chain: ['openai:gpt-image-2', 'gemini:gemini-3-pro-image'] },
  }),
  ['openai:gpt-image-2', 'gemini:gemini-3-pro-image']
)
check(
  'l’ordre déclaré est respecté à l’envers aussi',
  keys({
    model: 'gemini-3-pro-image',
    providers: { chain: ['gemini:gemini-3-pro-image', 'openai:gpt-image-2'] },
  }),
  ['gemini:gemini-3-pro-image', 'openai:gpt-image-2']
)

console.log('\n4. Un maillon non configuré est écarté, il ne fait pas tout échouer')
delete process.env.OPENAI_API_KEY
ENV = {}
check(
  'sans clé OpenAI, il reste le secours Gemini',
  keys({
    model: 'gemini-3-pro-image',
    providers: { chain: ['openai:gpt-image-2', 'gemini:gemini-3-pro-image'] },
  }),
  ['gemini:gemini-3-pro-image']
)
check(
  'sans clé et sans secours : liste vide (l’appelant lève)',
  keys({ model: 'gemini-3-pro-image', providers: { chain: ['openai:gpt-image-2'] } }),
  []
)
process.env.OPENAI_API_KEY = 'test-openai'
ENV = { OPENAI_API_KEY: 'test-openai' }

console.log('\n5. Le maillon imposé par l’admin garde la priorité absolue')
check(
  'il prime sur la chaîne de la recette',
  keys(
    { model: 'gemini-3-pro-image', providers: { chain: ['openai:gpt-image-2'] } },
    'gemini:gemini-2.5-flash-image'
  ),
  ['gemini:gemini-2.5-flash-image']
)
check('il prime aussi sans chaîne', keys({ model: 'gemini-3-pro-image' }, 'openai:gpt-image-2'), [
  'openai:gpt-image-2',
])

console.log('\n6. Un modèle inconnu ne fabrique rien (pas d’appel à l’aveugle)')
check(
  'fournisseur inexistant ignoré',
  keys({
    model: 'gemini-3-pro-image',
    providers: { chain: ['midjourney:v7', 'gemini:gemini-3-pro-image'] },
  }),
  ['gemini:gemini-3-pro-image']
)

console.log('')
console.log('7. Les ratios que le Publisher produit sont tous couverts par gpt-image')
// Le Publisher deduit le ratio de l'orientation du design : 3:4, 4:3 ou 1:1 (recipeAspectFromImage).
// Si l'un d'eux n'etait pas couvert, choisir « ChatGPT » sur ce format leverait, le maillon serait
// ecarte, et — le choix etant desormais SANS secours — la commande partirait en revue manuelle.
const { SIZE_BY_ASPECT } = loadTsModule(
  path.join(ROOT, 'app/Services/CustomArt/providers/OpenAIProvider.ts')
)
check('ratios couverts', Object.keys(SIZE_BY_ASPECT).sort(), ['1:1', '3:4', '4:3'])
check(
  'chaque taille garde le ratio exact et reste divisible par 16',
  Object.entries(SIZE_BY_ASPECT).map(([a, size]) => {
    const [w, h] = size.split('x').map(Number)
    const [rw, rh] = a.split(':').map(Number)
    return w * rh === h * rw && w % 16 === 0 && h % 16 === 0
  }),
  [true, true, true]
)

console.log(`\n${ok} assertions OK, ${ko} en échec\n`)
process.exit(ko ? 1 : 0)
