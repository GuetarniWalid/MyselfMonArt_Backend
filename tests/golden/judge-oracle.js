/**
 * ORACLE DU JUGE FOOT — capture du comportement de référence, AVANT toute refonte.
 *
 * POURQUOI CE TEST EXISTE
 * Le chantier d'unification du studio doit rendre le juge configurable par recette
 * (extension-Midjourney/PLAN-UNIFICATION-STUDIO-FOOT.md, lot P3) SANS rien re-régler : les seuils
 * de JudgeService.ts sont calibrés à l'œil sur de vrais rendus, ils se RECOPIENT, ils ne se
 * redécouvrent pas. Ce test fige donc le comportement actuel pendant qu'il est encore intact, pour
 * pouvoir prouver plus tard que le nouveau moteur rend exactement les mêmes décisions.
 *
 * CE QU'IL PROUVE (déterministe, donc vérifiable exactement)
 * 1. L'ASSEMBLAGE : combien d'appels, quelles images, dans quel ordre, quel outil forcé, quel
 *    modèle, quel plafond de jetons. C'est le contrat partagé avec le prompt et le worker.
 * 2. LA DÉCISION : pour un couple de réponses de modèle DONNÉ, le verdict complet (portes dures,
 *    seuils, fusion des deux passes, score pondéré, suspicion, textExact).
 *
 * CE QU'IL NE PROUVE PAS
 * La réponse du modèle elle-même : le juge appelle Claude sans température fixée, deux jugements
 * de la même image diffèrent déjà. C'est précisément pour ISOLER cette variance que le client
 * Anthropic est ici remplacé par un rejoueur — le hasard du modèle est neutralisé, seul le code
 * du juge est mesuré.
 *
 * MÉTHODE : JudgeService reçoit son client Anthropic par injection (constructeur), ce qui offre
 * une couture propre. Le service est exercé EN ENTIER et sans modification : c'est lui l'oracle.
 *
 * USAGE
 *   npm run test:judge              # vérifie
 *   npm run test:judge -- --update  # régénère l'instantané (uniquement si la dérive est VOULUE)
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const SRC = path.join(ROOT, 'app/Services/CustomArt/JudgeService.ts')
const SNAPSHOT = path.join(__dirname, 'judge-foot.snapshot.json')
const ts = require(path.join(ROOT, 'node_modules/typescript'))
const sharp = require(path.join(ROOT, 'node_modules/sharp'))

// Seul le SDK Anthropic est stubbé (il n'est utilisé qu'en position de type, mais on ne dépend pas
// de l'élision). zod, zod-to-json-schema, sharp, ./prompt et ./kits sont chargés pour de vrai :
// ce sont eux qui font le travail que l'on veut mesurer.
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

const JudgeService = loadTsModule(SRC).default
// Le moteur de décision pur (lot L1). Il n'importe JudgeService qu'en `import type`, effacé à la
// transpilation : aucun stub supplémentaire n'est requis.
const { conclude, FOOT_V1 } = loadTsModule(path.join(ROOT, 'app/Services/CustomArt/judgeEngine.ts'))

/** Client Anthropic factice : enregistre ce qu'on lui envoie, rejoue une réponse préparée. */
function fakeAnthropic(byTool) {
  const calls = []
  return {
    calls,
    client: {
      messages: {
        create: async (req) => {
          calls.push(req)
          const toolName = req.tool_choice && req.tool_choice.name
          if (!Object.prototype.hasOwnProperty.call(byTool, toolName)) {
            throw new Error(`aucune réponse préparée pour l'outil "${toolName}"`)
          }
          return { content: [{ type: 'tool_use', name: toolName, input: byTool[toolName] }] }
        },
      },
    },
  }
}

// Réponses de référence, valides au regard des schémas zod du juge. Les cas de test n'en modifient
// que les champs utiles : tout le reste reste constant, pour que chaque écart soit imputable.
const RUBRIC = {
  face_resemblance: 8,
  face_notes: 'Visage fidèle.',
  kit_fidelity: 8,
  crest_legible: true,
  crest_accurate: true,
  sponsor_legible: true,
  sponsor_text_read: 'SPONSOR',
  back_text_read: 'WALID 10',
  name_spelling_exact: true,
  number_exact: true,
  name_above_number: true,
  crest_on_back: false,
  arms_trace: 'Bras gauche continu, bras droit continu.',
  arms_visible: 2,
  hands_visible: 2,
  arms_connected: true,
  anatomy_defect: false,
  anatomy_score: 8,
  artifacts_notes: 'RAS.',
  style_score: 8,
  verdict: 'Bon rendu.',
}

const ANATOMY = {
  skin_zones: [
    {
      position: 'bras gauche',
      membre: 'bras gauche',
      rattachement_epaule: 'rattachee a une epaule par un haut de bras continu',
      terminaison: 'main visible',
      rotation: 'normale pour une vue de dos',
      longueur_avant_bras: 'normale',
      anomalies: 'aucune',
    },
  ],
  arms_visible: 2,
  hands_visible: 2,
  extra_limb: false,
  hands_malformed: false,
  anatomy_notes: 'RAS.',
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
  // Images réelles minuscules : sharp doit pouvoir les redimensionner et les découper vraiment.
  const img = (w, h) =>
    sharp({ create: { width: w, height: h, channels: 3, background: { r: 180, g: 180, b: 180 } } })
      .jpeg()
      .toBuffer()

  const candidate = await img(600, 800)
  const photo = await img(400, 400)
  const kit1 = await img(300, 300)
  const kit2 = await img(300, 300)

  const baseInput = {
    candidateBuffer: candidate,
    photoBuffer: photo,
    kitRefBuffers: [kit1, kit2],
    kitRefFiles: ['paris-front.jpg', 'paris-back.jpg'],
    playerName: 'WALID',
    playerNumber: 10,
    fidelityNotes: 'Bande centrale verticale.',
    model: 'claude-opus-4-8',
  }

  const run = async (rubricPatch, anatomyPatch, inputPatch) => {
    const fake = fakeAnthropic({
      judge_candidate: { ...RUBRIC, ...(rubricPatch || {}) },
      anatomy_inspection: { ...ANATOMY, ...(anatomyPatch || {}) },
    })
    const service = new JudgeService(fake.client)
    const result = await service.judge({ ...baseInput, ...(inputPatch || {}) })
    return { result, calls: fake.calls }
  }

  // ==========================================================================================
  // 1. ASSEMBLAGE — le contrat d'envoi (images, ordre, outil forcé, réglages)
  // ==========================================================================================
  const nominal = await run()
  const [rubricCall, anatomyCall] = nominal.calls
  const imagesOf = (call) => call.messages[0].content.filter((c) => c.type === 'image')

  ok(nominal.calls.length === 2, 'exactement 2 appels au modèle (rubrique + anatomie)')
  ok(
    rubricCall.tool_choice.type === 'tool' && rubricCall.tool_choice.name === 'judge_candidate',
    'passe 1 : sortie structurée FORCÉE sur judge_candidate'
  )
  ok(
    anatomyCall.tool_choice.name === 'anatomy_inspection',
    'passe 2 : sortie structurée forcée sur anatomy_inspection'
  )
  ok(
    rubricCall.model === 'claude-opus-4-8' && rubricCall.max_tokens === 2000,
    'modèle transmis et plafond de jetons à 2000'
  )
  ok(imagesOf(rubricCall).length === 4, 'passe 1 : 4 images (photo + 2 réfs + candidat)')
  ok(
    imagesOf(anatomyCall).length === 4,
    'passe 2 : 4 quadrants du candidat SEULEMENT (ni photo, ni réfs)'
  )
  ok(
    rubricCall.messages[0].content[0].type === 'text',
    'passe 1 : le texte du prompt précède les images'
  )
  // Le candidat EN DERNIER est un choix de calibration du bench : il doit le rester.
  const rubricContent = rubricCall.messages[0].content
  ok(
    rubricContent[rubricContent.length - 1].type === 'image',
    'passe 1 : le candidat est la DERNIÈRE image'
  )
  // Le prompt est fonction des images réellement envoyées (annonce FACE/DOS par référence).
  const rubricText = rubricContent[0].text
  ok(/2 image/.test(rubricText), 'le prompt annonce le NOMBRE de références envoyées')
  ok(
    /image 2/.test(rubricText) && /image 3/.test(rubricText),
    'le prompt annonce chaque référence par son index'
  )
  ok(
    rubricText.includes('Bande centrale verticale.'),
    'les notes de fidélité de l’équipe sont dans le prompt du juge'
  )

  // Une seule référence maillot : le prompt doit s'adapter (cas réel, une équipe sans vue de face).
  const oneRef = await run(null, null, {
    kitRefBuffers: [kit1],
    kitRefFiles: ['france-back.jpg'],
  })
  ok(imagesOf(oneRef.calls[0]).length === 3, 'avec 1 seule référence : 3 images en passe 1')
  ok(/1 image/.test(oneRef.calls[0].messages[0].content[0].text), 'le compte annoncé suit')

  // ==========================================================================================
  // 2. DÉCISION — portes dures, seuils, fusion des deux passes
  // ==========================================================================================
  // Chaque cas = un couple de réponses de modèle. L'ORDRE compte : il détermine celui des clés
  // de l'instantané.
  const CASE_DEFS = [
    ['nominal', null, null],
    ['visage_sous_seuil', { face_resemblance: 6 }, null],
    ['maillot_sous_seuil', { kit_fidelity: 6 }, null],
    ['seuils_exactement_7', { face_resemblance: 7, kit_fidelity: 7 }, null],
    ['porte_bras', { arms_visible: 3 }, null],
    ['porte_mains', { hands_visible: 3 }, null],
    ['porte_defaut_anatomique', { anatomy_defect: true }, null],
    // Fusion : le défaut vu par UNE SEULE passe doit suffire (max des compteurs).
    ['fusion_anatomie_voit_3_bras', { arms_visible: 1 }, { arms_visible: 3 }],
    ['fusion_rubrique_voit_3_bras', { arms_visible: 3 }, { arms_visible: 1 }],
    // Orthographe fausse : NON éliminatoire côté foot (contraste avec le juge générique).
    ['orthographe_fausse', { name_spelling_exact: false }, null],
    ['numero_faux', { number_exact: false }, null],
    // Signaux faibles : suspicion uniquement, jamais un échec.
    ['membre_surnumeraire_passe2', null, { extra_limb: true }],
    ['mains_deformees_passe2', null, { hands_malformed: true }],
    ['bras_deconnecte', { arms_connected: false }, null],
  ]

  const cases = {}
  const engineCases = {}
  for (const [name, rubricPatch, anatomyPatch] of CASE_DEFS) {
    cases[name] = (await run(rubricPatch, anatomyPatch)).result
    // Le MOTEUR PUR reçoit exactement les mêmes réponses de modèle que le juge legacy.
    engineCases[name] = conclude(FOOT_V1, {
      rubric: { ...RUBRIC, ...(rubricPatch || {}) },
      anatomy: { ...ANATOMY, ...(anatomyPatch || {}) },
    })
  }

  ok(cases.nominal.pass === true, 'cas nominal : réussite')
  ok(cases.visage_sous_seuil.pass === false, 'visage 6/10 : échec (seuil 7)')
  ok(cases.maillot_sous_seuil.pass === false, 'maillot 6/10 : échec (seuil 7)')
  ok(cases.seuils_exactement_7.pass === true, 'visage et maillot à 7 pile : réussite (>=)')
  ok(cases.porte_bras.pass === false, 'plus de 2 bras : porte dure')
  ok(cases.porte_mains.pass === false, 'plus de 2 mains : porte dure')
  ok(cases.porte_defaut_anatomique.pass === false, 'défaut anatomique déclaré : porte dure')
  ok(
    cases.fusion_anatomie_voit_3_bras.pass === false &&
      cases.fusion_anatomie_voit_3_bras.verdicts.armsVisible === 3,
    'fusion : 3 bras vus par la SEULE passe anatomie suffisent'
  )
  ok(
    cases.fusion_rubrique_voit_3_bras.pass === false &&
      cases.fusion_rubrique_voit_3_bras.verdicts.armsVisible === 3,
    'fusion : 3 bras vus par la SEULE rubrique suffisent'
  )
  ok(
    cases.orthographe_fausse.pass === true && cases.orthographe_fausse.verdicts.textExact === false,
    'orthographe fausse : NON éliminatoire, mais textExact devient faux'
  )
  ok(cases.numero_faux.verdicts.textExact === false, 'numéro faux : textExact devient faux')
  ok(
    cases.membre_surnumeraire_passe2.pass === true,
    'membre surnuméraire vu en passe 2 : suspicion, PAS une porte'
  )
  ok(
    cases.mains_deformees_passe2.pass === true,
    'mains déformées vues en passe 2 : suspicion, PAS une porte'
  )
  ok(
    cases.bras_deconnecte.pass === true && cases.bras_deconnecte.suspicion > 0,
    'bras décrit comme déconnecté : suspicion, PAS une porte'
  )

  // ==========================================================================================
  // 3. INSTANTANÉ — le verdict COMPLET de chaque cas, figé à l'octet près
  // ==========================================================================================
  // JSON.stringify (et non un deep-equal) : c'est la forme réellement persistée en base, et elle
  // dépend de l'ORDRE des clés — un deep-equal ne le verrait pas.
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
        : 'dérive détectée. Si elle est VOULUE : npm run test:judge -- --update'
    )
  }

  // ==========================================================================================
  // 4. PARITÉ DU MOTEUR PUR — la preuve qui autorise la refonte
  // ==========================================================================================
  // Pour un même couple de réponses de modèle, conclude(FOOT_V1) doit rendre EXACTEMENT le verdict
  // du juge legacy. La comparaison se fait sur JSON.stringify : c'est la forme réellement persistée
  // en base, et elle dépend de l'ORDRE des clés — un deep-equal ne le verrait pas.
  for (const [name] of CASE_DEFS) {
    const legacy = JSON.stringify(cases[name])
    const engine = JSON.stringify(engineCases[name])
    ok(
      legacy === engine,
      `moteur pur identique au legacy — cas « ${name} »`,
      legacy === engine ? '' : `legacy=${legacy}\n        engine=${engine}`
    )
  }

  console.log(`\ngolden judge-oracle : ${pass} OK, ${fail} FAIL`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('ERREUR :', e && e.stack ? e.stack : e)
  process.exit(1)
})
