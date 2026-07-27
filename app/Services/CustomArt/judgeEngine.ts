import type { JudgeResult, JudgeVerdicts } from './JudgeService'

/**
 * Moteur de DÉCISION du juge — fonction PURE (aucun réseau, aucune image, aucun IoC).
 *
 * Rôle : à partir des réponses déjà obtenues des passes du modèle, produire le verdict final
 * (portes dures, seuils de réussite, fusion entre passes, score de classement, suspicion).
 * C'est la moitié DÉTERMINISTE du jugement — donc la seule qui puisse être prouvée exactement.
 * L'appel au modèle, lui, reste chez l'appelant et n'est pas reproductible (voir plus bas).
 *
 * POURQUOI CE MODULE EXISTE
 * Le chantier d'unification (PLAN-UNIFICATION-STUDIO-FOOT.md, lot P3) doit rendre le juge
 * paramétrable par produit SANS re-régler quoi que ce soit : les seuils du juge foot sont calibrés
 * à l'œil sur de vrais rendus. Ce moteur est donc un PORT LITTÉRAL de la logique de
 * JudgeService.judge(), avec les seules VALEURS extraites dans un profil.
 *
 * CE QUE LE PROFIL CONTIENT, ET CE QU'IL NE CONTIENT PAS (ligne de partage assumée)
 * - Les NOMBRES (seuils, pondérations, plafonds des portes) : c'est ce qu'une recette produit
 *   pourra un jour surcharger — ce sont des réglages.
 * - L'ASSEMBLAGE du verdict et la formulation des signaux : du CODE versionné par produit,
 *   sélectionné par son nom. Le prétendre déclaratif serait un trompe-l'œil : la liste des 21
 *   champs du foot et la rédaction de ses signaux ne se paramètrent pas, elles s'écrivent.
 *
 * NON-RÉGRESSION : `conclude(FOOT_V1, …)` doit reproduire à l'octet près le verdict de
 * JudgeService pour un même couple de réponses — c'est ce que vérifie tests/golden/judge-oracle.js
 * contre l'oracle capturé avant toute refonte.
 */

/** Réponse de la passe « rubrique » (schéma zod de JudgeService). */
export type RubricLike = Record<string, any>
/** Réponse de la passe « anatomie » (schéma zod de JudgeService). */
export type AnatomyLike = Record<string, any>

export interface JudgeProfile {
  /** Identifiant versionné — c'est lui qu'une recette citera. */
  name: string
  /** Seuils de RÉUSSITE. En dessous, le candidat est recalé (mais reste classable). */
  thresholds: { faceMin: number; kitMin: number }
  /** Pondérations du score de classement (leur somme vaut 1). */
  weights: { face: number; kit: number; anatomy: number; style: number }
  /** Plafonds des portes DURES : au-delà, échec immédiat. */
  gates: { maxArms: number; maxHands: number }
  /** Signaux de suspicion : jamais un échec, seulement un départage. */
  suspicionSignals: (rubric: RubricLike, anatomy: AnatomyLike) => string[]
  /** Assemblage du verdict détaillé, propre au produit. */
  buildVerdicts: (ctx: {
    rubric: RubricLike
    anatomy: AnatomyLike
    armsVisible: number
    handsVisible: number
    suspicionSignals: string[]
  }) => JudgeVerdicts
}

/**
 * Conclusion commune à tous les profils. Reproduit pas à pas JudgeService.judge() :
 * fusion par le PIRE des deux passes, puis portes, puis seuils, puis score.
 */
export function conclude(
  profile: JudgeProfile,
  input: { rubric: RubricLike; anatomy: AnatomyLike }
): JudgeResult {
  const { rubric, anatomy } = input

  // Fusion par union des défauts : on retient le PIRE des deux passes pour les compteurs.
  // Un membre surnuméraire vu par UNE SEULE passe doit suffire à recaler le candidat.
  const armsVisible = Math.max(rubric.arms_visible ?? 0, anatomy.arms_visible ?? 0)
  const handsVisible = Math.max(rubric.hands_visible ?? 0, anatomy.hands_visible ?? 0)

  // PORTES DURES — compteurs et défaut explicite UNIQUEMENT. Tout le reste est de la
  // suspicion, jamais un échec : calibration validée par audit (les signaux de zone
  // produisaient l'écrasante majorité de faux coupables).
  const gateFailures: string[] = []
  if (armsVisible > profile.gates.maxArms) {
    gateFailures.push(`${armsVisible} bras visibles (membre surnuméraire)`)
  }
  if (handsVisible > profile.gates.maxHands) {
    gateFailures.push(`${handsVisible} mains visibles (membre surnuméraire)`)
  }
  if (rubric.anatomy_defect === true) {
    gateFailures.push('défaut anatomique grave signalé (membre surnuméraire / main difforme)')
  }

  const suspicionSignals = profile.suspicionSignals(rubric, anatomy)
  const verdicts = profile.buildVerdicts({
    rubric,
    anatomy,
    armsVisible,
    handsVisible,
    suspicionSignals,
  })

  const pass =
    gateFailures.length === 0 &&
    verdicts.faceLikeness >= profile.thresholds.faceMin &&
    verdicts.kitFidelity >= profile.thresholds.kitMin

  const reason =
    gateFailures.length > 0
      ? `ÉCHEC GATE ANATOMIQUE (${gateFailures.join(' ; ')}) — ${rubric.verdict}`
      : rubric.verdict

  const w = profile.weights
  const score =
    Math.round(
      (verdicts.faceLikeness * w.face +
        verdicts.kitFidelity * w.kit +
        verdicts.anatomy * w.anatomy +
        verdicts.framingStyle * w.style) *
        100
    ) / 100

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
    suspicion: suspicionSignals.length,
    reason,
  }
}

/**
 * Signaux de suspicion du foot — déduits en code des descriptions par zone de la passe anatomie,
 * plus deux signaux faibles de la rubrique. Le rapprochement se fait par MOTS-CLÉS (tolérant) :
 * on ne dépend pas des valeurs d'énumération à la lettre, qui pourraient être reformulées.
 */
function footSuspicionSignals(rubric: RubricLike, anatomy: AnatomyLike): string[] {
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
  if (anatomy.extra_limb === true) {
    signals.push('membre surnuméraire ou segment flottant signalé en passe anatomie')
  }
  if (anatomy.hands_malformed === true) {
    signals.push('main difforme signalée en passe anatomie')
  }
  if (rubric.arms_connected === false) {
    signals.push('bras décrit comme déconnecté par la rubrique')
  }
  return signals
}

/**
 * Profil du poster foot — port LITTÉRAL de la calibration actuelle.
 *
 * ⚠️ Ces valeurs ont été réglées à l'œil sur de vrais rendus : elles se RECOPIENT, elles ne se
 * redécouvrent pas. Ne jamais les « arrondir » ni les « harmoniser » sans une nouvelle campagne
 * de validation visuelle. En particulier, deux non-évidences à préserver :
 * - l'orthographe du nom et l'exactitude du numéro ne sont PAS éliminatoires ici (elles ne
 *   pèsent que dans le classement, via textExact) ;
 * - un membre surnuméraire vu par la SEULE passe anatomie ne referme pas la porte : seul le
 *   compteur fusionné et le `anatomy_defect` de la rubrique le font.
 */
export const FOOT_V1: JudgeProfile = {
  name: 'foot.v1',
  thresholds: { faceMin: 7, kitMin: 7 },
  weights: { face: 0.35, kit: 0.3, anatomy: 0.2, style: 0.15 },
  gates: { maxArms: 2, maxHands: 2 },
  suspicionSignals: footSuspicionSignals,
  buildVerdicts: ({ rubric, anatomy, armsVisible, handsVisible, suspicionSignals }) => ({
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
    // Les types de réponse (RubricVerdict / AnatomyInspection) ne sont pas exportés par
    // JudgeService, et on s'interdit de le modifier tant qu'il sert d'ORACLE de non-régression.
    // On passe donc par son interface publique plutôt que de toucher au fichier legacy.
    anatomyInspection: anatomy as JudgeVerdicts['anatomyInspection'],
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
  }),
}

/** Registre des profils : une recette les citera PAR NOM, jamais par leur contenu. */
export const JUDGE_PROFILES: Record<string, JudgeProfile> = {
  [FOOT_V1.name]: FOOT_V1,
}
