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
  // Modèle Lucid : les décorateurs sont des no-op, on ne teste que la logique du getter.
  '@ioc:Adonis/Lucid/Orm': {
    __esModule: true,
    BaseModel: class BaseModel {},
    column: Object.assign(() => () => {}, { dateTime: () => () => {} }),
    belongsTo: () => () => {},
  },
  'App/Models/CustomArtSession': { __esModule: true, default: class CustomArtSession {} },
  'App/Models/CustomArtTeam': { __esModule: true, default: class CustomArtTeam {} },
}

function loadTsModule(absPath) {
  const js = ts.transpileModule(fs.readFileSync(absPath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      importHelpers: false,
    },
  }).outputText
  // Les imports RELATIFS sont transpilés à la volée eux aussi (mêmes règles), pour charger les
  // modules purs du domaine sans avoir à les stubber un par un.
  const customRequire = (id) => {
    if (Object.prototype.hasOwnProperty.call(STUBS, id)) return STUBS[id]
    if (id.startsWith('.')) return loadTsModule(path.join(path.dirname(absPath), `${id}.ts`))
    return require(id)
  }
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', js)(customRequire, mod, mod.exports)
  return mod.exports
}

const RecipeService = loadTsModule(SRC).default
if (!RecipeService || typeof RecipeService.parseRecipe !== 'function') {
  throw new Error('RecipeService.parseRecipe introuvable')
}
// genericPrompt n'importe RecipeService qu'en `import type` (effacé à la transpilation) :
// aucun stub nécessaire.
const { buildGenericPrompt } = loadTsModule(
  path.join(ROOT, 'app/Services/CustomArt/genericPrompt.ts')
)
const PROMPT_SNAPSHOT = path.join(__dirname, 'family-prompt.snapshot.txt')

/**
 * Recette RÉELLE du produit famille en production (gid 10565374247259), exportée verbatim du
 * metafield `studio.recipe` le 27/07/2026.
 *
 * C'est une fixture, PAS une copie écrite à la main : l'invariant « la famille ne change pas » doit
 * être prouvé contre ce que la boutique sert vraiment. Une copie manuscrite peut dériver du
 * metafield sans que personne ne s'en aperçoive — et l'invariant deviendrait alors une illusion.
 * À ré-exporter si la recette de production est modifiée volontairement.
 */
const FAMILY_RECIPE = fs.readFileSync(
  path.join(__dirname, 'fixtures/family-recipe.production.json'),
  'utf8'
)

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

// `judge.seesReferences` : absent d'une recette qui ne le déclare pas — sinon l'objet persisté
// d'un produit existant changerait, et le juge de la famille se mettrait à voir des images.
ok(!('seesReferences' in actual.judge), 'judge.seesReferences absent si non déclaré')
const seeing = RecipeService.parseRecipe(
  JSON.stringify({ version: 1, judge: { seesReferences: true }, prompt: { base: 'x' } })
)
ok(seeing.judge.seesReferences === true, 'judge.seesReferences repris quand il est déclaré')

// `judge.profile` : un produit peut EMPRUNTER un jugement déjà calibré, cité par son nom.
ok(!('profile' in actual.judge), 'judge.profile absent si non déclaré')
const borrowed = RecipeService.parseRecipe(
  JSON.stringify({ version: 1, judge: { profile: 'foot.v1' }, prompt: { base: 'x' } })
)
ok(borrowed.judge.profile === 'foot.v1', 'profil de jugement connu accepté')
// Un nom inconnu doit être REFUSÉ : un repli silencieux vers le jugement générique
// n'appliquerait pas les règles demandées, sans que personne ne s'en aperçoive.
rejects(
  JSON.stringify({ version: 1, judge: { profile: 'foot.v99' }, prompt: { base: 'x' } }),
  'profil de jugement inconnu refusé',
  'inconnu'
)

// `providers.chain` : filet de secours du foot (3 modèles essayés dans l'ordre). Absente d'une
// recette qui ne la déclare pas — la famille garde son modèle unique.
ok(!('providers' in actual), 'providers absent si non déclaré')
const chained = RecipeService.parseRecipe(
  JSON.stringify({
    version: 1,
    providers: {
      chain: [
        'gemini:gemini-3.1-flash-image',
        'gemini:gemini-3-pro-image',
        'gemini:gemini-2.5-flash-image',
      ],
    },
    prompt: { base: 'x' },
  })
)
ok(chained.providers.chain.length === 3, 'chaîne de 3 modèles acceptée, dans l’ordre')
ok(
  chained.providers.chain[0] === 'gemini:gemini-3.1-flash-image',
  'le premier maillon est préservé'
)
const badChain = (chain) =>
  JSON.stringify({ version: 1, providers: { chain }, prompt: { base: 'x' } })
rejects(badChain([]), 'chaîne vide refusée', 'non vide')
rejects(badChain(['pas-un-modele']), 'maillon mal formé refusé', 'invalide')
// Un doublon ferait retenter le MÊME modèle après son refus : dépense sans aucun espoir.
rejects(badChain(['gemini:a', 'gemini:a']), 'maillon en double refusé', 'double')
rejects(
  badChain(['gemini:a', 'gemini:b', 'gemini:c', 'gemini:d', 'gemini:e', 'gemini:f']),
  'chaîne trop longue refusée',
  'dépasse'
)

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
// 4. PROMPT — non-régression du texte réellement envoyé au modèle, puis parité foot
// ============================================================================================
const familyRecipe = RecipeService.parseRecipe(FAMILY_RECIPE)
const familyPrompt = buildGenericPrompt({
  recipe: familyRecipe,
  tokens: ['Papa', 'Franco', 'Maman', 'Veronica'],
  title: 'La famille Martin',
})

if (process.argv.includes('--update') || !fs.existsSync(PROMPT_SNAPSHOT)) {
  fs.writeFileSync(PROMPT_SNAPSHOT, familyPrompt + '\n', 'utf8')
  console.log(`instantané écrit : ${path.relative(ROOT, PROMPT_SNAPSHOT)}`)
} else {
  const expected = fs.readFileSync(PROMPT_SNAPSHOT, 'utf8').trimEnd()
  ok(
    familyPrompt === expected,
    'prompt FAMILLE : texte identique à l’instantané',
    familyPrompt === expected
      ? ''
      : `dérive détectée. Si elle est VOULUE : npm run test:golden -- --update\n---\n${familyPrompt}\n---`
  )
}

// Parité foot : une phrase PAR IMAGE, avec son rôle et son index d'envoi (l'image 1 = photo client).
const footParsed = RecipeService.parseRecipe(FOOT_RECIPE)
const footPrompt = buildGenericPrompt({
  recipe: footParsed,
  tokens: [],
  title: null,
  references: ['front', 'back', 'scene'],
  label: 'Paris',
  notes: 'Bande centrale verticale ; blason côté cœur.',
  fieldValues: { playerName: 'Walid', playerNumber: '10' },
})
ok(/IMAGE 2 .*FACE de Paris/s.test(footPrompt), 'image 2 annoncée FACE avec le libellé de l’option')
ok(/IMAGE 3 .*DOS de Paris/s.test(footPrompt), 'image 3 annoncée DOS')
ok(/IMAGE 4 .*SCÈNE/s.test(footPrompt), 'image 4 annoncée SCÈNE et POSE')
ok(footPrompt.includes('Bande centrale verticale'), 'la note de fidélité est injectée')
ok(/CONSIGNES DE FIDÉLITÉ/.test(footPrompt), 'le bloc de consignes non négociables est présent')

// Un prompt CALIBRÉ doit pouvoir placer les consignes exactement où il les attend (le prompt foot
// les veut au milieu de sa liste d'exigences, pas rejetées à la fin).
const placedRecipe = RecipeService.parseRecipe(
  JSON.stringify({
    version: 1,
    prompt: { base: 'AVANT\n{notes}\nAPRES', commonNotes: 'Règle commune.' },
  })
)
const placedPrompt = buildGenericPrompt({
  recipe: placedRecipe,
  tokens: [],
  title: null,
  notes: 'Note de l’option.',
})
ok(
  /AVANT\nNote de l’option\.\nRègle commune\.\nAPRES/.test(placedPrompt),
  '{notes} place les consignes à l’endroit voulu, option puis règles communes'
)
ok(
  !/CONSIGNES DE FIDÉLITÉ/.test(placedPrompt),
  'le bloc autonome n’est PAS ajouté quand le prompt les place lui-même (pas de doublon)'
)
// Sans notes, `{notes}` reste verbatim : aucune recette existante n'est affectée.
ok(
  buildGenericPrompt({
    recipe: RecipeService.parseRecipe(
      JSON.stringify({ version: 1, prompt: { base: 'A {notes} B' } })
    ),
    tokens: [],
    title: null,
  }).includes('A {notes} B'),
  'sans consignes, {notes} reste verbatim'
)

// Interpolation des champs déclarés + modificateur de casse (le prénom est peint en capitales).
const upperRecipe = RecipeService.parseRecipe(
  JSON.stringify({
    version: 1,
    prompt: { base: 'Floque « {playerName:upper} » au-dessus du numéro « {playerNumber} ».' },
  })
)
const upperPrompt = buildGenericPrompt({
  recipe: upperRecipe,
  tokens: [],
  title: null,
  fieldValues: { playerName: 'Walid', playerNumber: '10' },
})
ok(upperPrompt.includes('« WALID »'), '{champ:upper} met la valeur en capitales')
ok(upperPrompt.includes('« 10 »'), '{champ} interpole la valeur brute')

// Sécurité d'interpolation : un placeholder sans valeur reste verbatim, et un membre hérité
// d'Object.prototype ne doit JAMAIS résoudre (sinon du code JS finirait dans le prompt).
const safeRecipe = RecipeService.parseRecipe(
  JSON.stringify({ version: 1, prompt: { base: 'A={inconnu} B={toString} C={constructor}' } })
)
const safePrompt = buildGenericPrompt({
  recipe: safeRecipe,
  tokens: [],
  title: null,
  fieldValues: { autre: 'x' },
})
ok(safePrompt.includes('A={inconnu}'), 'placeholder inconnu laissé verbatim')
ok(
  safePrompt.includes('B={toString}') && safePrompt.includes('C={constructor}'),
  'les membres d’Object.prototype ne résolvent PAS'
)

// Sans rôles fournis : le bloc `imageRoles` UNIQUE est conservé (ici la surcharge de la recette
// famille, qui a le sien) et aucune phrase par rôle n'apparaît.
ok(
  familyPrompt.includes('Two images are attached. IMAGE 1 is the CUSTOMER PHOTO:'),
  'sans rôles fournis, le bloc imageRoles de la recette est conservé tel quel'
)
ok(!/L'IMAGE 2 (est|montre)/.test(familyPrompt), 'aucune phrase par rôle sans rôles fournis')
ok(!/CONSIGNES DE FIDÉLITÉ/.test(familyPrompt), 'aucun bloc de notes sur une recette sans notes')

// Et le DÉFAUT (recette qui ne surcharge pas imageRoles) reste bien le texte historique.
const defaultPrompt = buildGenericPrompt({
  recipe: RecipeService.parseRecipe(JSON.stringify({ version: 1, prompt: { base: 'Base.' } })),
  tokens: [],
  title: null,
})
ok(
  defaultPrompt.includes('La première image jointe est la PHOTO DU CLIENT'),
  'le bloc imageRoles par défaut est inchangé'
)

// ============================================================================================
// 5. VALIDATION DU PAYLOAD CLIENT — champs déclarés (choice / number / text)
// ============================================================================================
const validate = (recipe, payload) =>
  RecipeService.validateGenericPayload(recipe, (name) =>
    Object.prototype.hasOwnProperty.call(payload, name) ? payload[name] : undefined
  )

// Non-régression : une recette SANS champs déclarés ne persiste aucune clé `fields`.
const famOut = validate(familyRecipe, { names: 'Papa, Maman', familyName: 'Martin' })
ok(famOut.ok === true, 'payload famille accepté')
ok(famOut.ok && !('fields' in famOut.inputs), 'aucune clé "fields" persistée sans champs déclarés')

// Cas nominal foot : le libellé de l'option est FIGÉ sur la commande.
const footOk = validate(footParsed, { teamId: 'paris', playerName: 'Walid', playerNumber: '10' })
ok(footOk.ok === true, 'payload foot accepté', footOk.ok ? '' : footOk.message)
if (footOk.ok) {
  const f = footOk.inputs.fields
  ok(f.teamId.value === 'paris' && f.teamId.label === 'Paris', 'choix résolu + libellé snapshoté')
  ok(f.playerName.value === 'Walid' && f.playerName.type === 'text', 'texte validé')
  ok(f.playerNumber.value === '10' && f.playerNumber.type === 'number', 'nombre validé')
}

const rejectsPayload = (payload, label, fragment) => {
  const r = validate(footParsed, payload)
  ok(
    r.ok === false && (!fragment || flat(r.message).includes(flat(fragment))),
    label,
    r.ok ? 'payload ACCEPTÉ alors qu’il doit être rejeté' : `message : ${r.message}`
  )
}
const base = { teamId: 'paris', playerName: 'Walid', playerNumber: '10' }
rejectsPayload({ ...base, teamId: 'marseille' }, 'option inexistante refusée', 'invalide')
rejectsPayload({ ...base, teamId: '' }, 'champ requis manquant refusé', 'requis')
rejectsPayload({ ...base, playerNumber: '0' }, 'numéro sous la borne (0 < 1)', 'compris entre')
rejectsPayload({ ...base, playerNumber: '100' }, 'numéro au-dessus de la borne', 'compris entre')
rejectsPayload({ ...base, playerNumber: '10.5' }, 'numéro non entier refusé', 'entier')
rejectsPayload({ ...base, playerNumber: '0x10' }, 'notation hexadécimale refusée', 'nombre')
rejectsPayload({ ...base, playerNumber: '1e2' }, 'notation exponentielle refusée', 'nombre')
rejectsPayload({ ...base, playerName: 'WalidWalidWalid' }, 'texte trop long refusé', '12')
rejectsPayload({ ...base, playerName: 'Walid <b>' }, 'caractères interdits refusés', 'invalide')

// Un champ FACULTATIF absent ne bloque pas et n'est simplement pas persisté.
const optRecipe = RecipeService.parseRecipe(
  JSON.stringify({
    version: 1,
    inputs: { fields: [{ name: 'surnom', type: 'text', required: false, maxLength: 20 }] },
    prompt: { base: 'x' },
  })
)
const optOut = validate(optRecipe, {})
ok(optOut.ok === true, 'champ facultatif absent : payload accepté')
ok(optOut.ok && !('surnom' in optOut.inputs.fields), 'champ facultatif absent : non persisté')

// ============================================================================================
// 6. SÉLECTION DES IMAGES — « ce choix → ces images », par NOM (jamais par position)
// ============================================================================================
const { resolveGenericReferences, referenceFileName } = loadTsModule(
  path.join(ROOT, 'app/Services/CustomArt/referenceResolver.ts')
)

const CDN = 'https://cdn.shopify.com/s/files/1/0623/2388/4287/files/'
const urls = {
  parisFront: `${CDN}paris-front.jpg?v=1783584613`,
  parisBack: `${CDN}paris-back.jpg?v=1783584614`,
  franceBack: `${CDN}france-back.jpg?v=1783584615`,
  pose: `${CDN}scene-pose.jpg?v=1783584616`,
}

ok(
  referenceFileName(urls.parisBack) === 'paris-back.jpg',
  'nom de fichier extrait sans query string'
)
ok(
  referenceFileName(`${CDN}Paris-Back.JPG`) === 'paris-back.jpg',
  'correspondance insensible à la casse'
)

// Mode HISTORIQUE : aucune sélection déclarée -> tout est joint, rôles inconnus.
const histo = resolveGenericReferences({
  recipe: familyRecipe,
  available: [urls.parisFront, urls.parisBack],
})
ok(histo.explicit === false, 'sans sélection déclarée : mode historique')
ok(histo.items.length === 2, 'mode historique : toutes les images sont jointes')
// Le worker consomme cette liste pour télécharger les images : l'ORDRE doit être exactement
// celui de l'admin, sinon le contrat « image 1 = photo client, puis les réfs » se décale.
ok(
  JSON.stringify(histo.items.map((i) => i.url)) ===
    JSON.stringify([urls.parisFront, urls.parisBack]),
  'mode historique : ordre de l’admin strictement préservé'
)

// Le cap de STOCKAGE a été relevé (40) pour que le foot range ses ~31 images dans un seul
// metafield. Ce relèvement est INDISSOCIABLE du plafond du mode historique : sans sélection
// déclarée, tout part au modèle — envoyer 40 images avec un prompt qui n'en annonce qu'une serait
// exactement la bombe à retardement qu'on avait refusé d'armer.
const manyUrls = Array.from({ length: 9 }, (_, i) => `${CDN}img-${i}.jpg`)
try {
  resolveGenericReferences({ recipe: familyRecipe, available: manyUrls })
  ok(false, 'mode historique : au-delà de 8 images sans sélection => échec net')
} catch (e) {
  const why = (e && e.reasons ? e.reasons.join(' ; ') : e.message) || ''
  ok(
    flat(why).includes(flat('sans aucune sélection déclarée')),
    'mode historique : au-delà de 8 images sans sélection => échec net',
    `motif : ${why}`
  )
}
ok(
  resolveGenericReferences({ recipe: familyRecipe, available: manyUrls.slice(0, 8) }).items
    .length === 8,
  'mode historique : 8 images restent acceptées'
)

// Mode EXPLICITE : recette foot avec images partagées (la pose, commune à toutes les équipes).
const footShared = RecipeService.parseRecipe(
  JSON.stringify({
    version: 1,
    references: [{ name: 'scene-pose.jpg', role: 'scene' }],
    inputs: {
      fields: [
        {
          name: 'teamId',
          type: 'choice',
          options: [
            {
              key: 'paris',
              label: 'Paris',
              references: [
                { name: 'paris-front.jpg', role: 'front' },
                { name: 'paris-back.jpg', role: 'back' },
              ],
            },
            { key: 'france', references: [{ name: 'france-back.jpg', role: 'back' }] },
          ],
        },
      ],
    },
    prompt: { base: 'x' },
  })
)
const all = [urls.franceBack, urls.pose, urls.parisFront, urls.parisBack]
const pick = (key, available) =>
  resolveGenericReferences({
    recipe: footShared,
    fields: { teamId: { type: 'choice', value: key, label: null } },
    available,
  })

const paris = pick('paris', all)
ok(paris.explicit === true, 'sélection déclarée : mode explicite')
ok(paris.items.length === 3, 'Paris : 2 maillots + la pose partagée')
ok(
  paris.items[0].url === urls.parisFront && paris.items[0].role === 'front',
  'image 1 = maillot FACE de Paris'
)
ok(paris.items[1].role === 'back', 'image 2 = maillot DOS')
ok(paris.items[2].role === 'scene', 'les images partagées viennent EN DERNIER (contrat foot)')
ok(!paris.items.some((i) => i.url === urls.franceBack), 'le maillot d’une autre équipe est exclu')

const france = pick('france', all)
ok(
  france.items.length === 2 && france.items[0].url === urls.franceBack,
  'France : son seul maillot'
)

// LA propriété qui compte : réordonner les images dans l'admin ne change RIEN.
const shuffled = [urls.pose, urls.parisBack, urls.franceBack, urls.parisFront]
ok(
  JSON.stringify(pick('paris', shuffled)) === JSON.stringify(paris),
  'réordonner studio.references ne change pas le résultat'
)

// Fautes de configuration produit : échec NET, jamais une génération privée de son maillot.
const throwsResolve = (available, label, fragment) => {
  try {
    pick('paris', available)
    ok(false, label, 'résolution ACCEPTÉE alors qu’elle doit échouer')
  } catch (e) {
    const why = (e && e.reasons ? e.reasons.join(' ; ') : e.message) || ''
    ok(!fragment || flat(why).includes(flat(fragment)), label, `motif : ${why}`)
  }
}
throwsResolve([urls.parisFront, urls.pose], 'image désignée absente -> échec net', 'introuvable')
throwsResolve(
  [urls.parisFront, urls.parisBack, urls.pose, `${CDN}paris-back.jpg?v=999`],
  'nom de fichier ambigu -> échec net',
  'ambigu'
)

// ============================================================================================
// 7. LIBELLÉ DE LA CRÉATION — il alimente les e-mails atelier, la revue et le fichier d'impression
// ============================================================================================
const CustomArtJob = loadTsModule(path.join(ROOT, 'app/Models/CustomArtJob.ts')).default
const labelOf = (patch) => {
  const job = new CustomArtJob()
  Object.assign(job, patch)
  return job.displayLabel
}

ok(
  labelOf({ playerName: 'WALID', playerNumber: 10 }) === 'WALID 10',
  'foot legacy : libellé inchangé'
)
ok(
  labelOf({ inputs: { title: 'La famille Martin', tokens: [] } }) === 'La famille Martin',
  'générique avec titre : le titre'
)
ok(
  labelOf({ inputs: { tokens: ['Papa', 'Maman'] } }) === 'Papa, Maman',
  'générique sans titre : les textes joints'
)
// Le repli qui évite un e-mail atelier SANS AUCUNE identification (le « piège 8 » de la revue).
ok(
  labelOf({
    inputs: {
      fields: {
        teamId: { type: 'choice', value: 'paris', label: 'Paris' },
        playerName: { type: 'text', value: 'Walid', label: null },
        playerNumber: { type: 'number', value: '10', label: null },
      },
    },
  }) === 'Paris Walid 10',
  'recette sans titre : repli sur les champs déclarés (libellé du choix en clair)'
)
ok(labelOf({ inputs: { tokens: [] } }) === '', 'aucune donnée : libellé vide (inchangé)')

// ============================================================================================
// 8. LIBELLÉ HUMAIN CENTRALISÉ — il nomme la création sur les bons de production et les e-mails
// ============================================================================================
const { describeJob } = loadTsModule(path.join(ROOT, 'app/Services/CustomArt/jobLabelling.ts'))
const describe = (patch, legacyTeamName = null) => {
  const job = new CustomArtJob()
  Object.assign(job, patch)
  return describeJob(job, legacyTeamName)
}

// Job HISTORIQUE : les colonnes font foi, exactement comme aujourd'hui.
const legacy = describe({ playerName: 'WALID', playerNumber: 10, teamId: 3 }, 'Paris')
ok(
  legacy.displayName === 'WALID' && legacy.number === 10 && legacy.optionName === 'Paris',
  'job historique : prénom, numéro et équipe inchangés'
)
ok(legacy.incomplete === false, 'job historique : jamais signalé incomplet')
// Un job historique SANS équipe (colonne nulle) ne doit pas inventer de nom d'option.
ok(
  describe({ playerName: 'WALID', playerNumber: 7, teamId: null }, 'Paris').optionName === null,
  'job historique sans équipe : aucune option inventée'
)

// Job PILOTÉ PAR RECETTE : le libellé et l'option viennent des entrées validées.
const driven = describe({
  uuid: 'abcdef12-3456',
  inputs: {
    title: 'WALID 10',
    fields: {
      teamId: { type: 'choice', value: 'paris', label: 'Paris' },
      playerNumber: { type: 'number', value: '10', label: null },
    },
  },
})
ok(driven.displayName === 'WALID 10', 'job piloté par recette : libellé issu du titre')
ok(driven.optionName === 'Paris', 'l’option choisie est nommée par son libellé FIGÉ')
ok(driven.number === 10, 'le numéro est repris des champs déclarés')

// Libellé figé : si l'option a été renommée depuis, la commande passée garde son libellé.
ok(
  describe({
    uuid: 'x',
    inputs: { title: 'T', fields: { t: { type: 'choice', value: 'paris', label: null } } },
  }).optionName === 'paris',
  'sans libellé enregistré, on retombe sur la clé plutôt que sur rien'
)

// LE garde-fou : jamais de libellé VIDE sur un bon de production ou un e-mail d'atelier.
const blank = describe({ uuid: 'deadbeef-1111', inputs: { tokens: [] } })
ok(
  blank.displayName.includes('deadbeef'),
  'aucune source : on nomme par l’identifiant, pas un blanc'
)
ok(blank.incomplete === true, 'aucune source : l’anomalie est SIGNALÉE')
ok(
  describe({ uuid: 'x', inputs: { title: 'La famille Martin' } }).incomplete === false,
  'un libellé exploitable n’est jamais signalé incomplet'
)

// ============================================================================================
console.log(`\ngolden recipe-schema : ${pass} OK, ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
