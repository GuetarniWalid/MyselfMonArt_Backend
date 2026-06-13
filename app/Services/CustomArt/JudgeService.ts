import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import sharp from 'sharp'
import Authentication from 'App/Services/Claude/Authentication'
import { COMMON_FIDELITY_NOTES } from './prompt'
import { kitViewLabelFr } from './kits'

/**
 * Juge vision CustomArt — port de la CALIBRATION VALIDÉE du bench M1
 * (scripts/bench/judge.mjs, audit visuel des recalages du 2026-06-11) :
 *
 * 1. GATE DUR (décision grill §0.14) appliqué EN CODE, uniquement sur :
 *    arms_visible > 2 OU hands_visible > 2 OU anatomy_defect=true.
 *    Validé sur le vrai défaut (femme à 3 bras du run fiabilite-g31 : bras=3 ET
 *    defect=true) avec ZÉRO faux positif.
 * 2. Les signaux de zone (rotation impossible / « s'arrête sans main dans le cadre » /
 *    « sans rattachement épaule » / bras déconnecté / avant-bras démesuré) deviennent
 *    un SCORE DE SUSPICION (0-N) stocké par candidat — JAMAIS un échec dur (97 % de
 *    faux coupables constatés à l'audit). Il sert à départager les candidats.
 * 3. Passe anatomie DÉDIÉE sur 4 quadrants zoomés (recouvrement) de la zone sous la
 *    tête : le juge généraliste ratait les avant-bras déconnectés à taille pleine.
 *    Le modèle DÉCRIT chaque zone de peau, le code conclut.
 * 4. Calibration dos : ne JAMAIS pénaliser kit_fidelity pour des éléments de FACE
 *    invisibles de dos (blason, sponsor poitrine, bande centrale type Hechter PSG).
 * 5. pass = visage>=7 ET maillot>=7 ET pas de gate dur.
 */

// Seuils de pass (calibration bench)
const PASS_MIN_FACE = 7
const PASS_MIN_KIT = 7

// Estimation indicative €/jugement — couvre les 2 passes (rubrique + anatomie)
export const JUDGE_EST_COST_EUR = 0.09

// Modèle du juge : celui de la calibration bench (qualité maximale du gate anatomie /
// fidélité maillot), surchargeable par CUSTOM_ART_JUDGE_MODEL. Choix assumé de Walid.
// NB incident 13/06 : l'explosion de coûts ne venait PAS du modèle mais d'une boucle de
// re-jugement (job crashé re-relancé sans fin) — corrigée par le plafond de relances,
// l'instance unique, le disjoncteur de coût et le kill-switch du Worker, pas en baissant
// le modèle. Opus reste donc le défaut.
const DEFAULT_JUDGE_MODEL = 'claude-opus-4-8'

// Tailles d'image (bench config.judge) : candidat/réfs réduits, quadrants zoomés
const JUDGE_IMAGE_MAX_PX = 896
const JUDGE_CROP_MAX_PX = 1120

// ---------------------------------------------------------------------------
// Passe 1 — rubrique générale (photo source + réfs maillot + candidat plein cadre)
// ---------------------------------------------------------------------------
const rubricSchema = z.object({
  face_resemblance: z
    .number()
    .min(0)
    .max(10)
    .describe(
      'Ressemblance du visage avec la photo source, 0-10 (10 = la personne est immédiatement reconnaissable, âge et traits préservés)'
    ),
  face_notes: z
    .string()
    .max(400)
    .describe('Ce qui colle / ne colle pas dans le visage (1-2 phrases, en français)'),
  kit_fidelity: z
    .number()
    .min(0)
    .max(10)
    .describe(
      'Fidélité du maillot aux images de référence ET aux notes de fidélité fournies (couleurs, motif, col, emplacement des éléments), 0-10'
    ),
  crest_legible: z.boolean().describe('Le blason du club est-il présent et lisible ?'),
  crest_accurate: z.boolean().describe('Le blason correspond-il au vrai blason des références ?'),
  sponsor_legible: z.boolean().describe('Le sponsor maillot est-il présent et lisible ?'),
  sponsor_text_read: z
    .string()
    .max(60)
    .describe('Texte du sponsor tel que lu sur le candidat (chaîne vide si absent/illisible)'),
  back_text_read: z
    .string()
    .max(40)
    .describe('Nom et numéro tels que lus dans le dos, ex "NOAH 10" (chaîne vide si absent)'),
  name_spelling_exact: z
    .boolean()
    .describe(
      'Le nom dans le dos est-il EXACTEMENT identique, lettre par lettre, accents et tirets compris ? ' +
        'Un point au-dessus d’un I majuscule (« İ ») ou tout diacritique non demandé = false'
    ),
  number_exact: z.boolean().describe('Le numéro est-il exactement celui demandé ?'),
  name_above_number: z
    .boolean()
    .describe(
      'Le nom est-il placé AU-DESSUS du numéro dans le dos (règle officielle) ? false si dessous, absent ou illisible'
    ),
  crest_on_back: z
    .boolean()
    .describe(
      'true si un blason de club apparaît dans le DOS du maillot (défaut : le blason ne se porte que côté cœur, de face)'
    ),
  arms_trace: z
    .string()
    .max(900)
    .describe(
      "AVANT de remplir les champs suivants, trace chaque bras du candidat un par un, en français : pour CHAQUE bras — la manche est-elle PLEINE ou VIDE (fond/foule visible entre la manche et la chair ?) ; où se trouvent le coude, le poignet, la main ; le segment est-il relié en continu à l'épaule ou surgit-il du flanc/de la taille ; longueur de l'avant-bras vs torse. 2-5 phrases factuelles."
    ),
  arms_visible: z
    .number()
    .int()
    .min(0)
    .max(10)
    .describe(
      'Nombre de bras visibles sur le candidat — COMPTE-les un par un, épaules et avant-bras compris (une personne normale : 2 maximum)'
    ),
  hands_visible: z
    .number()
    .int()
    .min(0)
    .max(10)
    .describe(
      'Nombre de mains visibles sur le candidat — COMPTE-les une par une (une personne normale : 2 maximum)'
    ),
  arms_connected: z
    .boolean()
    .describe(
      "true UNIQUEMENT si chaque bras visible est connecté en continu de l'épaule au coude puis au poignet. false si une manche est VIDE (fond/foule visible entre la manche et l'avant-bras), si un avant-bras surgit du flanc ou de la taille SANS haut de bras le reliant à l'épaule, ou si un segment de membre flotte sans attache"
    ),
  anatomy_defect: z
    .boolean()
    .describe(
      'true au MOINDRE défaut anatomique grave : membre surnuméraire ou déconnecté, main difforme ou en moignon, doigts fusionnés/doublés/manquants, articulation ou rotation impossible, proportions aberrantes (avant-bras long comme le torse, main au niveau des genoux, coude à la taille)'
    ),
  anatomy_score: z
    .number()
    .min(0)
    .max(10)
    .describe(
      'Anatomie et artefacts, 0-10 (10 = aucun défaut ; pénaliser mains/doigts/membres anormaux, textures cassées)'
    ),
  artifacts_notes: z
    .string()
    .max(400)
    .describe('Défauts/artefacts relevés (1-2 phrases, en français)'),
  style_score: z
    .number()
    .min(0)
    .max(10)
    .describe("Respect du style peinture épique + pose regard par-dessus l'épaule + stade, 0-10"),
  verdict: z.string().max(300).describe('Verdict global en 1 phrase, en français'),
})

// ---------------------------------------------------------------------------
// Passe 2 — inspection anatomique dédiée (4 quadrants zoomés, le modèle DÉCRIT,
// le code conclut — cf. anatomyFailures/suspicion)
// ---------------------------------------------------------------------------
const skinZoneSchema = z.object({
  position: z
    .string()
    .max(200)
    .describe("Emplacement de la zone dans l'image, 1 phrase courte en français"),
  membre: z
    .string()
    .max(120)
    .describe('À quel membre cette peau appartient (ex : bras droit de la personne)'),
  rattachement_epaule: z
    .enum([
      'rattachee a une epaule par un haut de bras continu',
      'rattachement masque de facon credible',
      'sans rattachement visible a une epaule',
      'incertain',
    ])
    .describe(
      'Peux-tu SUIVRE cette zone de peau jusqu\'à une épaule (directement ou via une manche PLEINE) sans interruption ? "sans rattachement visible" si la zone débute au flanc/à la taille sans haut de bras au-dessus, ou si la manche au-dessus est vide (fond/foule entre la manche et la chair)'
    ),
  terminaison: z
    .enum([
      'main visible',
      'sort du cadre',
      'cachee derriere le corps de facon credible',
      's arrete sans main dans le cadre',
    ])
    .describe(
      'Où se termine la zone vers le bas ? Une chair qui se fond dans la hanche/le maillot/le décor sans main visible = "s arrete sans main dans le cadre"'
    ),
  rotation: z
    .enum([
      'normale pour une vue de dos',
      'pli interne du coude ou paume face au spectateur',
      'indeterminee',
    ])
    .describe(
      'Bras pendant vu de DOS : on doit voir la POINTE du coude et le DOS de la main ; un pli interne de coude (creux de flexion) ou une paume face au spectateur est impossible'
    ),
  longueur_avant_bras: z
    .enum(['normale', 'demesuree', 'non evaluable'])
    .describe(
      'Longueur du segment coude->poignet comparée au torse ; "demesuree" si comparable au torse ou si la main arrive aux genoux'
    ),
  anomalies: z
    .string()
    .max(300)
    .describe(
      'Toute incohérence relevée sur cette zone (modelé articulaire absent, terminaison abrupte/floue, plis anormaux), ou "aucune". En français'
    ),
})

const anatomySchema = z.object({
  skin_zones: z
    .array(skinZoneSchema)
    .max(6)
    .describe(
      'Un élément par ZONE DE PEAU NUE visible hors tête/cou (bras, avant-bras, mains). Fusionne les zones qui apparaissent sur plusieurs agrandissements.'
    ),
  arms_visible: z
    .number()
    .int()
    .min(0)
    .max(10)
    .describe(
      'Nombre total de bras (ou segments de bras) visibles, comptés un par un (une personne normale : 2 maximum)'
    ),
  hands_visible: z
    .number()
    .int()
    .min(0)
    .max(10)
    .describe('Nombre de mains visibles, comptées une par une (une personne normale : 2 maximum)'),
  extra_limb: z
    .boolean()
    .describe(
      'true si un membre surnuméraire ou un segment de membre flottant sans attache est visible'
    ),
  hands_malformed: z
    .boolean()
    .describe(
      'true si une main visible est difforme : moignon, doigts fusionnés/doublés/manquants, taille aberrante'
    ),
  anatomy_notes: z
    .string()
    .max(300)
    .describe(
      'Synthèse factuelle de l\'élément le plus suspect relevé (ou "RAS"), 1 phrase en français'
    ),
})

type RubricVerdict = z.infer<typeof rubricSchema>
type AnatomyInspection = z.infer<typeof anatomySchema>

export interface JudgeVerdicts {
  faceLikeness: number
  kitFidelity: number
  textExact: boolean
  textRead: string
  anatomy: number
  armsVisible: number
  handsVisible: number
  anatomyDefect: boolean
  framingStyle: number
  /** Signaux de suspicion relevés (zone/rotation/connexion) — informatif, jamais un gate */
  suspicionSignals: string[]
  /** Inspection anatomique brute de la passe 2 (zones de peau décrites) */
  anatomyInspection?: AnatomyInspection
  [key: string]: any
}

export interface JudgeResult {
  scores: Record<string, number>
  verdicts: JudgeVerdicts
  pass: boolean
  /** Score global pondéré 0-10 (classement des candidats) */
  score: number
  /** Score de suspicion 0-N (départage : on révèle le moins suspect) — jamais un échec */
  suspicion: number
  reason: string
}

export default class JudgeService extends Authentication {
  public async judge(input: {
    candidateBuffer: Buffer
    photoBuffer: Buffer
    kitRefBuffers: Buffer[]
    /** Noms/URLs des réfs maillot (mêmes index que kitRefBuffers) : annonce FACE/DOS */
    kitRefFiles?: string[]
    playerName: string
    playerNumber: number
    /** Notes de fidélité maillot de l'équipe (calibrent kit_fidelity), null si absentes */
    fidelityNotes?: string | null
  }): Promise<JudgeResult> {
    const model = Env.get('CUSTOM_ART_JUDGE_MODEL') || DEFAULT_JUDGE_MODEL

    // Passe 1 — rubrique générale : photo source, réfs maillot annoncées FACE/DOS,
    // candidat en DERNIER (ordre du bench).
    const rubricContent: any[] = [
      { type: 'text', text: this.rubricPrompt(input) },
      await this.imageBlock(input.photoBuffer, JUDGE_IMAGE_MAX_PX),
    ]
    for (const kit of input.kitRefBuffers.slice(0, 2)) {
      rubricContent.push(await this.imageBlock(kit, JUDGE_IMAGE_MAX_PX))
    }
    rubricContent.push(await this.imageBlock(input.candidateBuffer, JUDGE_IMAGE_MAX_PX))

    const rubric = await this.structuredCall<RubricVerdict>(
      model,
      rubricContent,
      'judge_candidate',
      'Évalue un candidat de poster personnalisé selon la rubrique qualité',
      rubricSchema
    )

    // Passe 2 — inspection anatomique dédiée sur 4 quadrants zoomés. L'image complète
    // est volontairement ABSENTE : elle servait au modèle à rationaliser une silhouette
    // « naturelle » (faux négatifs du run fiabilite-g31).
    const crops = await this.armCropBlocks(input.candidateBuffer, JUDGE_CROP_MAX_PX)
    const anatomy = await this.structuredCall<AnatomyInspection>(
      model,
      [{ type: 'text', text: this.anatomyPrompt() }, ...crops],
      'anatomy_inspection',
      'Décrit chaque zone de peau visible des agrandissements (le verdict est calculé par programme)',
      anatomySchema
    )

    // Fusion par union des défauts : on retient le PIRE des deux passes pour les compteurs.
    const armsVisible = Math.max(rubric.arms_visible ?? 0, anatomy.arms_visible ?? 0)
    const handsVisible = Math.max(rubric.hands_visible ?? 0, anatomy.hands_visible ?? 0)

    // GATE DUR (décision grill §0.14, calibration validée 2026-06-11) — compteurs et
    // défaut explicite UNIQUEMENT. Tout le reste est de la suspicion, pas un échec.
    const gateFailures: string[] = []
    if (armsVisible > 2) {
      gateFailures.push(`${armsVisible} bras visibles (membre surnuméraire)`)
    }
    if (handsVisible > 2) {
      gateFailures.push(`${handsVisible} mains visibles (membre surnuméraire)`)
    }
    if (rubric.anatomy_defect === true) {
      gateFailures.push('défaut anatomique grave signalé (membre surnuméraire / main difforme)')
    }

    // SCORE DE SUSPICION : signaux de zone de la passe anatomie + signaux faibles de la
    // rubrique. Sert au classement (le moins suspect est révélé), JAMAIS au pass.
    const suspicionSignals = this.suspicionSignals(rubric, anatomy)
    const suspicion = suspicionSignals.length

    const verdicts: JudgeVerdicts = {
      faceLikeness: rubric.face_resemblance,
      kitFidelity: rubric.kit_fidelity,
      textExact: rubric.name_spelling_exact && rubric.number_exact,
      textRead: rubric.back_text_read,
      anatomy: rubric.anatomy_score,
      armsVisible,
      handsVisible,
      anatomyDefect: rubric.anatomy_defect,
      framingStyle: rubric.style_score,
      suspicionSignals,
      anatomyInspection: anatomy,
      faceNotes: rubric.face_notes,
      crestLegible: rubric.crest_legible,
      crestAccurate: rubric.crest_accurate,
      sponsorLegible: rubric.sponsor_legible,
      sponsorTextRead: rubric.sponsor_text_read,
      nameAboveNumber: rubric.name_above_number,
      crestOnBack: rubric.crest_on_back,
      armsConnected: rubric.arms_connected,
      armsTrace: rubric.arms_trace,
      artifactsNotes: rubric.artifacts_notes,
    }

    // PASS calibré (§0.14 validé) : visage>=7 ET maillot>=7 ET pas de gate dur.
    const pass =
      gateFailures.length === 0 &&
      verdicts.faceLikeness >= PASS_MIN_FACE &&
      verdicts.kitFidelity >= PASS_MIN_KIT

    const reason =
      gateFailures.length > 0
        ? `ÉCHEC GATE ANATOMIQUE (${gateFailures.join(' ; ')}) — ${rubric.verdict}`
        : rubric.verdict

    // Score global pondéré : le visage et le maillot pèsent le plus (cœur de la promesse)
    const score =
      Math.round(
        (verdicts.faceLikeness * 0.35 +
          verdicts.kitFidelity * 0.3 +
          verdicts.anatomy * 0.2 +
          verdicts.framingStyle * 0.15) *
          100
      ) / 100

    Logger.info(
      'custom-art judge pass=%s score=%s suspicion=%s bras=%s mains=%s text="%s" (%s)',
      pass,
      score,
      suspicion,
      armsVisible,
      handsVisible,
      verdicts.textRead,
      reason.slice(0, 120)
    )

    return {
      scores: {
        faceLikeness: verdicts.faceLikeness,
        kitFidelity: verdicts.kitFidelity,
        anatomy: verdicts.anatomy,
        framingStyle: verdicts.framingStyle,
      },
      verdicts,
      pass,
      score,
      suspicion,
      reason,
    }
  }

  // --------------------------------------------------------------------------
  // Prompts (port du bench judge.mjs)
  // --------------------------------------------------------------------------

  private rubricPrompt(input: {
    kitRefBuffers: Buffer[]
    kitRefFiles?: string[]
    playerName: string
    playerNumber: number
    fidelityNotes?: string | null
  }): string {
    const expectedName = input.playerName.toUpperCase()
    const expectedNumber = String(input.playerNumber)

    const sentRefs = input.kitRefBuffers.slice(0, 2)
    const refLines = sentRefs
      .map((_, i) => {
        const file = input.kitRefFiles?.[i] || ''
        return `   - image ${2 + i} : ${kitViewLabelFr(file)}`
      })
      .join('\n')

    // Notes de fidélité équipe + règles dos communes : calibrent la note kit_fidelity
    const noteLines: string[] = []
    if (input.fidelityNotes) noteLines.push(`Notes équipe : ${input.fidelityNotes}`)
    noteLines.push(COMMON_FIDELITY_NOTES)
    const notesBlock = `\nNOTES DE FIDÉLITÉ DU MAILLOT (barème de kit_fidelity — tout écart aux éléments décrits ici est une faute) :\n${noteLines.map((l) => `- ${l}`).join('\n')}\n`

    return `Tu es le juge qualité d'un produit "poster personnalisé football" (peinture épique d'une personne en joueur de foot, dans un stade, vue de dos avec le regard par-dessus l'épaule).

Tu reçois dans l'ordre :
1. La PHOTO SOURCE de la personne (le client).
2. ${sentRefs.length} image(s) de RÉFÉRENCE OFFICIELLE du maillot domicile.
${refLines}
3. Le CANDIDAT généré à évaluer (la dernière image).

Texte attendu dans le dos du maillot : nom "${expectedName}" AU-DESSUS du numéro "${expectedNumber}".
L'orthographe doit être vérifiée STRICTEMENT, lettre par lettre (accents et tirets compris) : "${expectedName}" et le numéro ${expectedNumber}. Tout signe diacritique ABSENT du nom demandé est une faute d'orthographe : en particulier, un I majuscule surmonté d'un point (« İ » turc — piège FRÉQUENT du générateur, regarde attentivement chaque I) n'est PAS un « I » -> name_spelling_exact=false.
${notesBlock}
Note le candidat selon la rubrique demandée. Sois exigeant : c'est un produit premium à 34,90-49,90 EUR.
- Ressemblance : compare au visage de la PHOTO SOURCE (traits, carnation, coiffure, lunettes éventuelles, âge).
- Fidélité maillot : compare aux références ET aux notes de fidélité (couleurs exactes, motif et son emplacement, col, BLASON et SPONSOR lisibles et corrects). La pose attendue montre le maillot DE DOS : les éléments portés UNIQUEMENT DE FACE (blason côté cœur, sponsor poitrine, bande centrale de face type bande Hechter du PSG) sont alors normalement invisibles — ne pénalise JAMAIS kit_fidelity pour leur absence dans une vue de dos ; ne les évalue que si une partie de la face du maillot est visible.
- ANATOMIE, examine chaque membre un par un :
  1) COMPTE le nombre de bras visibles (épaules, coudes, avant-bras), puis le nombre de mains, une par une.
  2) SUIS chaque bras en CONTINU de l'épaule au coude puis au poignet, et rédige ce trajet dans arms_trace AVANT de conclure : la manche doit être PLEINE — si le fond ou la foule est visible dans un gap entre la fin de manche et l'avant-bras, ou si un avant-bras surgit du flanc/de la taille SANS haut de bras le reliant à l'épaule, le bras est DÉCONNECTÉ (arms_connected=false). SIGNATURE FRÉQUENTE du défaut chez le générateur : manche courte présente mais VIDE, puis un coude qui apparaît à hauteur de taille, collé au flanc, sans haut de bras au-dessus — demande-toi pour chaque coude visible : « quel haut de bras relie ce coude à une épaule ? ». Ne donne PAS le bénéfice du doute : si tu ne peux pas suivre une ligne continue épaule->coude->main, décris-le.
  3) VÉRIFIE proportions et articulations : un avant-bras ne mesure jamais la longueur du torse, une main n'arrive jamais aux genoux, un coude ne se situe pas à la taille, une paume ne fait pas face au spectateur sur un bras pendant vu de dos, chaque main visible a des doigts différenciés (pas de moignon).
  Tout membre surnuméraire ou main difforme AVÉRÉS = anatomy_defect=true.
- DOS : le nom doit être AU-DESSUS du numéro (name_above_number) et AUCUN blason ne doit apparaître dans le dos (crest_on_back) — le blason ne se porte que côté cœur, visible de face. Un blason peint dans le dos est une faute de kit_fidelity.
Réponds uniquement via le format structuré demandé, verdicts en français.`
  }

  private anatomyPrompt(): string {
    return `Tu es un inspecteur en anatomie chargé du contrôle qualité de peintures générées : UNE personne en footballeur, vue de DOS en trois-quarts, tête tournée par-dessus l'épaule, dans un stade. ENVIRON UN TIERS des images de ce générateur contient un défaut de bras ou de main (membre déconnecté, avant-bras flottant, main absente ou difforme) que des inspecteurs précédents ont raté en jugeant la silhouette « naturelle » d'un coup d'œil. Ton rôle est UNIQUEMENT de DÉCRIRE ce que tu VOIS — le verdict est calculé par programme à partir de tes descriptions.

Tu reçois 4 agrandissements de l'image (quadrants avec recouvrement : haut-gauche, haut-droit, bas-gauche, bas-droit de la zone sous la tête — épaules, bras, mains, bassin). Une même zone peut apparaître sur plusieurs agrandissements : fusionne tes observations.

PROCÉDURE : liste CHAQUE zone de peau nue visible hors tête/cou (un élément du tableau skin_zones par zone). Pour chacune réponds STRICTEMENT avec les valeurs proposées :
1. RATTACHEMENT : peux-tu la suivre des yeux jusqu'à une épaule, directement ou via une manche PLEINE (la chair remplit et prolonge la manche) ? Si la zone débute au flanc ou à la taille sans haut de bras au-dessus, ou si du fond/de la foule apparaît entre la fin de manche et la chair, c'est "sans rattachement visible a une epaule". Ne réponds "rattachement masque de facon credible" que si quelque chose de CONCRET la masque.
2. TERMINAISON : suis la zone vers le bas — main visible ? sort du cadre ? cachée derrière le corps de façon crédible ? ou s'arrête-t-elle SANS main dans le cadre (terminaison abrupte/floue fondue dans la hanche ou le maillot) ?
3. ROTATION : bras pendant vu de dos => pointe du coude + dos de la main. Pli interne du coude (creux de flexion face au spectateur) ou paume visible = réponds "pli interne du coude ou paume face au spectateur".
4. LONGUEUR : segment coude->poignet comparé au torse.
Compte ensuite les bras et les mains, et signale membres surnuméraires et mains difformes.
Décris exactement ce qui est VISIBLE, pas ce qui serait anatomiquement attendu — au doute, choisis la valeur la plus défavorable ("incertain", "s arrete sans main dans le cadre", etc.). Réponds uniquement via le format structuré demandé, en français.`
  }

  /**
   * Signaux de suspicion (calibration §0.14) — déduits en code des descriptions par zone
   * de la passe anatomie + signaux faibles de la rubrique. Matching par mots-clés
   * (tolérant) : on ne dépend pas des valeurs d'enum à la lettre.
   */
  private suspicionSignals(rubric: RubricVerdict, anatomy: AnatomyInspection): string[] {
    const signals: string[] = []
    const norm = (s: any) => String(s || '').toLowerCase()

    for (const zone of anatomy.skin_zones || []) {
      const membre = zone.membre || zone.position || 'membre indéterminé'
      const ratt = norm(zone.rattachement_epaule)
      const term = norm(zone.terminaison)
      const rot = norm(zone.rotation)
      const len = norm(zone.longueur_avant_bras)
      if (ratt.includes('sans rattachement') || ratt.includes('incertain')) {
        signals.push(`${membre} sans rattachement visible à une épaule`)
      }
      if (term.includes('sans main')) {
        signals.push(`${membre} qui s'arrête sans main dans le cadre`)
      }
      if (rot.includes('pli interne') || rot.includes('paume')) {
        signals.push(`rotation suspecte (${membre} : pli interne/paume face au spectateur)`)
      }
      if (len.includes('demesur') || len.includes('démesur')) {
        signals.push(`avant-bras démesuré (${membre})`)
      }
    }
    if (anatomy.extra_limb === true)
      signals.push('membre surnuméraire ou segment flottant signalé en passe anatomie')
    if (anatomy.hands_malformed === true) signals.push('main difforme signalée en passe anatomie')
    if (rubric.arms_connected === false)
      signals.push('bras décrit comme déconnecté par la rubrique')
    return signals
  }

  // --------------------------------------------------------------------------
  // Images
  // --------------------------------------------------------------------------

  private async imageBlock(buffer: Buffer, maxPx: number) {
    return {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: (
          await sharp(buffer)
            .resize(maxPx, maxPx, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 88 })
            .toBuffer()
        ).toString('base64'),
      },
    }
  }

  /**
   * Agrandissements en 4 quadrants (avec recouvrement) de la zone sous la tête du
   * candidat : à taille pleine et sur demi-bandes, le juge ratait les avant-bras
   * déconnectés/démesurés — les mêmes défauts deviennent évidents sur un crop serré.
   * Bandes verticales [20-65 %] (épaules->coudes) et [50-100 %] (coudes->mains), qui
   * se recouvrent pour ne jamais couper un coude à la couture.
   */
  private async armCropBlocks(buffer: Buffer, maxPx: number) {
    const meta = await sharp(buffer).metadata()
    const width = meta.width || 0
    const height = meta.height || 0
    if (!width || !height) return []

    const rows = [
      { top: Math.round(height * 0.2), h: Math.round(height * 0.45) },
      { top: Math.round(height * 0.5), h: height - Math.round(height * 0.5) },
    ]
    const cols = [
      { left: 0, w: Math.round(width * 0.55) },
      { left: Math.round(width * 0.45), w: width - Math.round(width * 0.45) },
    ]
    const blocks: any[] = []
    for (const row of rows) {
      for (const col of cols) {
        const crop = await sharp(buffer)
          .extract({ left: col.left, top: row.top, width: col.w, height: row.h })
          .resize(maxPx, maxPx, { fit: 'inside' }) // upscale volontaire : zoom d'inspection
          .jpeg({ quality: 88 })
          .toBuffer()
        blocks.push({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: crop.toString('base64') },
        })
      }
    }
    return blocks
  }

  // --------------------------------------------------------------------------
  // Appel structuré (tool_choice forcé, pattern du repo) + retry backoff
  // --------------------------------------------------------------------------

  private async structuredCall<T>(
    model: string,
    content: any[],
    toolName: string,
    toolDescription: string,
    schema: z.ZodType<T>
  ): Promise<T> {
    const jsonSchema: any = zodToJsonSchema(schema as any)
    if (!jsonSchema.type) jsonSchema.type = 'object'

    return this.retryOperation(async () => {
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 2000,
        tools: [{ name: toolName, description: toolDescription, input_schema: jsonSchema }],
        tool_choice: { type: 'tool', name: toolName },
        messages: [{ role: 'user', content }],
      })

      const toolUse = response.content.find((c) => c.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error("Le juge n'a pas retourné de sortie structurée")
      }

      const parsed = schema.safeParse(toolUse.input)
      if (!parsed.success) {
        throw new Error(`Sortie du juge invalide: ${parsed.error.message}`)
      }
      return parsed.data
    })
  }

  /**
   * Retry avec backoff (copie du pattern du service Claude Mockup) :
   * 429 = attendre retry-after, 529 = backoff exponentiel, 3 essais.
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error

        if (error.status === 429) {
          const retryAfter = parseInt(error.headers?.['retry-after'] || delayMs.toString())
          Logger.warn('custom-art judge rate limited, retry dans %sms', retryAfter)
          await new Promise((resolve) => setTimeout(resolve, retryAfter))
          continue
        }

        if (error.status === 529) {
          const backoff = delayMs * Math.pow(2, attempt - 1)
          Logger.warn('custom-art judge overloaded (529), retry dans %sms', backoff)
          await new Promise((resolve) => setTimeout(resolve, backoff))
          continue
        }

        throw error
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }
}
