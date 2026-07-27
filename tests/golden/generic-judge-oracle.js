/**
 * ORACLE DU JUGE GÉNÉRIQUE — le juge qui contrôle le produit FAMILLE en production.
 *
 * POURQUOI CE TEST EXISTE
 * Le lot P3 doit unifier les deux juges derrière un moteur commun. Le juge foot a déjà son oracle
 * (judge-oracle.js) ; celui-ci fige le comportement du juge GÉNÉRIQUE, c'est-à-dire celui qui
 * décide, aujourd'hui, si le poster d'un vrai client part à l'impression ou repart en génération.
 * C'est donc le comportement à ne surtout pas altérer par inadvertance.
 *
 * MÊME MÉTHODE que pour le foot : le service reçoit son client Anthropic par injection, on le
 * remplace par un rejoueur de réponses préparées. Le hasard du modèle est neutralisé ; seul le
 * CODE de décision est mesuré — et lui est parfaitement déterministe.
 *
 * PARTICULARITÉ DE CE JUGE (à préserver) : le modèle ne fait que DÉCRIRE ce qu'il lit ; c'est le
 * code qui conclut, en accumulant des codes d'échec. Et contrairement au foot, ici la moindre
 * faute de texte est ÉLIMINATOIRE.
 *
 * USAGE
 *   npm run test:judge:generic              # vérifie
 *   npm run test:judge:generic -- --update  # régénère l'instantané (si la dérive est VOULUE)
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const SRC = path.join(ROOT, 'app/Services/CustomArt/GenericJudgeService.ts')
const SNAPSHOT = path.join(__dirname, 'judge-generic.snapshot.json')
const ts = require(path.join(ROOT, 'node_modules/typescript'))
const sharp = require(path.join(ROOT, 'node_modules/sharp'))

const STUBS = {
  '@anthropic-ai/sdk': { __esModule: true, default: class Anthropic {} },
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
  const customRequire = (id) => {
    if (Object.prototype.hasOwnProperty.call(STUBS, id)) return STUBS[id]
    if (id.startsWith('.')) return loadTsModule(path.join(path.dirname(absPath), `${id}.ts`))
    return require(path.join(ROOT, 'node_modules', id))
  }
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', js)(customRequire, mod, mod.exports)
  return mod.exports
}

const GenericJudgeService = loadTsModule(SRC).default

function fakeAnthropic(reading) {
  const calls = []
  return {
    calls,
    client: {
      messages: {
        create: async (req) => {
          calls.push(req)
          return {
            content: [{ type: 'tool_use', name: 'read_generic_candidate', input: reading }],
          }
        },
      },
    },
  }
}

/** Lecture de référence : tout est conforme. Les cas n'en modifient que ce qui les concerne. */
const READING = {
  figure_count: 2,
  figures_trace: 'deux silhouettes de dos, main dans la main',
  texts_read: ['La famille Martin', 'Papa', 'Maman'],
  token_reads: [
    { expected: 'Papa', found: true, read_as: 'Papa', exact: true, position: 1 },
    { expected: 'Maman', found: true, read_as: 'Maman', exact: true, position: 2 },
  ],
  title_found: true,
  title_read_as: 'La famille Martin',
  title_exact: true,
  extra_texts: [],
  quality_score: 8,
  quality_notes: 'RAS',
  verdict: 'Bon rendu.',
}

let pass = 0
let fail = 0
const ok = (cond, label, detail) => {
  if (cond) pass++
  else {
    fail++
    console.log(`  FAIL  ${label}${detail ? `\n        -> ${detail}` : ''}`)
  }
}

async function main() {
  const candidate = await sharp({
    create: { width: 600, height: 800, channels: 3, background: { r: 250, g: 250, b: 250 } },
  })
    .jpeg()
    .toBuffer()

  const baseInput = {
    candidateBuffer: candidate,
    tokens: ['Papa', 'Maman'],
    title: 'La famille Martin',
    n: 2,
    referenceTexts: { title: 'The Smith Family', slots: ['DADDY', 'MOMMY'] },
    checks: { text: true, figureCount: true },
    model: 'claude-opus-4-8',
  }

  const run = async (readingPatch, inputPatch) => {
    const fake = fakeAnthropic({ ...READING, ...(readingPatch || {}) })
    const service = new GenericJudgeService(fake.client)
    const result = await service.judge({ ...baseInput, ...(inputPatch || {}) })
    return { result, calls: fake.calls }
  }

  // ==========================================================================================
  // 1. ASSEMBLAGE — ce juge ne voit QUE le candidat (jamais la photo ni les références)
  // ==========================================================================================
  const nominal = await run()
  const call = nominal.calls[0]
  const images = call.messages[0].content.filter((c) => c.type === 'image')

  ok(nominal.calls.length === 1, 'une seule passe (pas de passe anatomie ici)')
  ok(images.length === 1, 'une SEULE image : le candidat')
  ok(
    call.tool_choice.type === 'tool' && call.tool_choice.name === 'read_generic_candidate',
    'sortie structurée forcée'
  )
  ok(call.messages[0].content[0].type === 'text', 'le prompt précède l’image')

  // ==========================================================================================
  // 2. DÉCISION — ici, TOUTE faute de texte est éliminatoire (contraste net avec le foot)
  // ==========================================================================================
  const CASE_DEFS = [
    ['nominal', null, null],
    // Textes par personne
    [
      'prenom_absent',
      {
        token_reads: [
          { expected: 'Papa', found: false, read_as: '', exact: false, position: 0 },
          { expected: 'Maman', found: true, read_as: 'Maman', exact: true, position: 2 },
        ],
      },
      null,
    ],
    [
      'prenom_mal_orthographie',
      {
        token_reads: [
          { expected: 'Papa', found: true, read_as: 'Pappa', exact: false, position: 1 },
          { expected: 'Maman', found: true, read_as: 'Maman', exact: true, position: 2 },
        ],
      },
      null,
    ],
    [
      'ordre_inverse',
      {
        token_reads: [
          { expected: 'Papa', found: true, read_as: 'Papa', exact: true, position: 2 },
          { expected: 'Maman', found: true, read_as: 'Maman', exact: true, position: 1 },
        ],
      },
      null,
    ],
    // Titre
    ['titre_absent', { title_found: false, title_read_as: '' }, null],
    [
      'titre_mal_orthographie',
      { title_found: true, title_read_as: 'La famille Martn', title_exact: false },
      null,
    ],
    // Textes non demandés : résidu de la référence de style, ou parasite
    ['residu_de_la_reference', { extra_texts: ['DADDY'] }, null],
    ['texte_parasite', { extra_texts: ['Lorem ipsum'] }, null],
    // Comptage de figures
    ['nombre_de_figures_faux', { figure_count: 3 }, null],
    // Qualité
    ['qualite_sous_seuil', { quality_score: 5 }, null],
    ['qualite_exactement_6', { quality_score: 6 }, null],
    // Contrôles désactivés par la recette
    [
      'controle_texte_desactive',
      {
        token_reads: [
          { expected: 'Papa', found: false, read_as: '', exact: false, position: 0 },
          { expected: 'Maman', found: true, read_as: 'Maman', exact: true, position: 2 },
        ],
      },
      { checks: { text: false, figureCount: true } },
    ],
    [
      'controle_comptage_desactive',
      { figure_count: 3 },
      { checks: { text: true, figureCount: false } },
    ],
  ]

  const cases = {}
  for (const [name, readingPatch, inputPatch] of CASE_DEFS) {
    cases[name] = (await run(readingPatch, inputPatch)).result
  }

  const codesOf = (c) => (c.verdicts && c.verdicts.textCodes) || []
  ok(cases.nominal.pass === true, 'cas nominal : réussite')
  ok(cases.prenom_absent.pass === false, 'prénom absent : échec')
  ok(codesOf(cases.prenom_absent).includes('text_missing'), 'prénom absent : code text_missing')
  ok(cases.prenom_mal_orthographie.pass === false, 'prénom mal orthographié : échec')
  ok(
    codesOf(cases.prenom_mal_orthographie).includes('text_misspelled'),
    'prénom mal orthographié : code text_misspelled'
  )
  ok(cases.ordre_inverse.pass === false, 'ordre gauche-droite non respecté : échec')
  ok(codesOf(cases.ordre_inverse).includes('text_order'), 'ordre inversé : code text_order')
  ok(cases.titre_absent.pass === false, 'titre absent : échec')
  ok(cases.titre_mal_orthographie.pass === false, 'titre mal orthographié : échec')
  ok(cases.residu_de_la_reference.pass === false, 'texte de la référence qui a fuité : échec')
  ok(
    codesOf(cases.residu_de_la_reference).includes('text_residual'),
    'résidu de référence : code text_residual'
  )
  ok(cases.texte_parasite.pass === false, 'texte parasite : échec')
  ok(cases.nombre_de_figures_faux.pass === false, 'nombre de figures faux : échec')
  ok(
    codesOf(cases.nombre_de_figures_faux).includes('figure_count'),
    'comptage faux : code figure_count'
  )
  ok(cases.qualite_sous_seuil.pass === false, 'qualité 5/10 : échec (seuil 6)')
  ok(cases.qualite_exactement_6.pass === true, 'qualité 6 pile : réussite (>=)')
  ok(
    cases.controle_texte_desactive.pass === true,
    'contrôle texte désactivé : la faute est ignorée'
  )
  ok(
    cases.controle_comptage_desactive.pass === true,
    'contrôle comptage désactivé : l’écart est ignoré'
  )

  // ==========================================================================================
  // 3. INSTANTANÉ — le verdict COMPLET de chaque cas, figé à l'octet près
  // ==========================================================================================
  const actual = JSON.stringify(cases, null, 2)

  if (process.argv.includes('--update') || !fs.existsSync(SNAPSHOT)) {
    fs.writeFileSync(SNAPSHOT, actual + '\n', 'utf8')
    console.log(`instantané écrit : ${path.relative(ROOT, SNAPSHOT)}`)
  } else {
    const expected = fs.readFileSync(SNAPSHOT, 'utf8').trim()
    ok(
      actual === expected,
      'verdicts complets identiques à l’instantané (valeurs ET ordre des clés)',
      actual === expected
        ? ''
        : 'dérive détectée. Si elle est VOULUE : npm run test:judge:generic -- --update'
    )
  }

  // ==========================================================================================
  // 4. PARITÉ FOOT — ce juge sait désormais recevoir la photo et les références par rôle
  // ==========================================================================================
  // Sans elles, il notait la fidélité d'un maillot qu'il n'avait jamais vu. Tout est OPT-IN :
  // les cas ci-dessus (produit famille) prouvent que sans photo ni références, rien ne bouge.
  const ref = (r, g, b) =>
    sharp({ create: { width: 300, height: 300, channels: 3, background: { r, g, b } } })
      .jpeg()
      .toBuffer()

  const withRefs = await run(null, {
    photoBuffer: await ref(10, 10, 10),
    references: [
      { buffer: await ref(20, 20, 200), role: 'front' },
      { buffer: await ref(30, 200, 30), role: 'back' },
      { buffer: await ref(200, 30, 30), role: 'scene' },
    ],
    label: 'Paris',
  })
  const richCall = withRefs.calls[0]
  const richContent = richCall.messages[0].content
  const richImages = richContent.filter((c) => c.type === 'image')
  const richText = richContent[0].text

  ok(richImages.length === 5, 'photo + 3 références + candidat = 5 images')
  ok(
    richContent[richContent.length - 1].type === 'image',
    'le candidat reste la DERNIÈRE image (contrat partagé avec le foot)'
  )
  ok(/Tu reçois 5 images/.test(richText), 'le prompt annonce le NOMBRE d’images')
  ok(/image 1 : la PHOTO DU CLIENT/.test(richText), 'image 1 annoncée = photo du client')
  ok(/image 2 : la vue de FACE de Paris/.test(richText), 'image 2 annoncée FACE, avec le libellé')
  ok(/image 3 : la vue de DOS de Paris/.test(richText), 'image 3 annoncée DOS')
  ok(/image 4 : une référence de SCÈNE/.test(richText), 'image 4 annoncée SCÈNE et POSE')
  ok(/image 5 : le CANDIDAT à évaluer/.test(richText), 'image 5 annoncée = le candidat')

  // LE garde-fou : le nombre annoncé doit égaler le nombre réellement envoyé. Si l'assemblage et
  // le prompt divergeaient, le juge noterait des images qu'on ne lui a pas montrées.
  const announced = (richText.match(/^ {2}- image \d+ :/gm) || []).length
  ok(
    announced === richImages.length,
    'autant d’images annoncées que d’images envoyées',
    `annoncées=${announced} envoyées=${richImages.length}`
  )

  // Sans photo ni références : la phrase historique est conservée AU MOT PRÈS.
  ok(
    nominal.calls[0].messages[0].content[0].text.includes(
      'Tu reçois UNE image : le CANDIDAT à évaluer.'
    ),
    'sans extras : la formulation historique est intacte'
  )

  console.log(`\ngolden generic-judge : ${pass} OK, ${fail} FAIL`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('ERREUR :', e && e.stack ? e.stack : e)
  process.exit(1)
})
