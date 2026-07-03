import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import sharp from 'sharp'
import { GoogleGenAI, Type } from '@google/genai'
import type { Schema } from '@google/genai'
import { DateTime } from 'luxon'
import CustomArtPhotoCheck from 'App/Models/CustomArtPhotoCheck'

/**
 * Juge « photo-check » du studio (endpoint POST /api/custom-art/photo-check).
 *
 * BUT (cœur de la demande) : valider la photo du visiteur TÔT, à coût quasi nul, AVANT de
 * dépenser une génération (≈0,04–0,13 € × 3 candidats). Verdict actionnable, jamais deux
 * jugements LLM pour la même photo.
 *
 * CASCADE du GRATUIT au PAYANT :
 *   1. Pré-filtres SERVEUR (sharp, zéro appel API) : photo illisible (quasi noire) ou
 *      ridiculement petite → verdict immédiat, on n'appelle pas le LLM.
 *   2. Cache par hash (MySQL, TTL ~1 h — pas de Redis ici) : hash connu → verdict mémorisé,
 *      AUCUN appel LLM. Garantit « 1 photo unique = 1 appel LLM maximum ».
 *   3. Sinon UN appel Gemini Flash (multimodal, sortie JSON structurée) — fraction de
 *      centime. Claude reste réservé au juge des candidats GÉNÉRÉS (JudgeService), pas ici.
 *
 * POLITIQUE PHOTO PAR PRODUIT (contrat §9) — « le modèle CLASSE, le code CONCLUT » :
 *   Le LLM produit une ÉVALUATION INTRINSÈQUE, POLICY-AGNOSTIQUE de la photo (nb de visages,
 *   nb de PERSONNES même de dos, corps entiers visibles, angle dominant, flou, sombre, nsfw…) ;
 *   le VERDICT final (ok/issues/grade) est recalculé EN CODE en appliquant la `photoPolicy`
 *   déclarée par la fiche produit (sujet solo/groupe, cadrage visage/en-pied, bornes de
 *   personnes, mapping angle-détecté → 🟢/🟡/🔴). Une fiche SANS policy retombe sur un SHIM
 *   dérivé de `faceAngle` = la table de tolérance §4 historique → le foot reste inchangé au
 *   pixel, zéro migration.
 *
 * CACHE INDÉPENDANT DE LA POLICY : la clé de cache est le HASH SEUL. La même photo soumise
 * avec une autre policy (ou un autre faceAngle) reste un hit et ne re-coûte jamais un appel
 * LLM — le verdict est simplement redérivé en code. Le schéma d'évaluation caché est VERSIONNÉ
 * (`evalVersion`, §9.8.3) : un hit d'une version antérieure (jugé « façon foot », sans comptage
 * de personnes ni cadrage) est re-jugé UNE fois puis réécrit, pour ne jamais servir un verdict
 * groupe/en-pied faux depuis le cache.
 *
 * RGPD : la photo n'est JAMAIS stockée — on ne garde que hash + évaluation dans le cache.
 */

// Angle de visage attendu par l'œuvre (envoyé VERBATIM par le studio thème, depuis
// studio.config). Enum CANONIQUE des crans REQUÊTABLES — le thème compare sur le TIRET de
// 'three-quarter' (jamais l'underscore), on stocke/compare donc à l'identique.
// NB : 'none' n'en fait PAS partie — c'est une valeur INTERNE au résultat LLM (« aucun
// visage détecté », cf. PhotoAssessment.faceAngle), jamais un angle que le thème demande.
export type FaceAngle = 'front' | 'three-quarter' | 'profile' | 'back'
export const FACE_ANGLES: FaceAngle[] = ['front', 'three-quarter', 'profile', 'back']

/**
 * Normalise la valeur `faceAngle` reçue du front vers l'enum canonique.
 *  - tolérant à la casse / aux espaces ;
 *  - mappe un éventuel underscore (`three_quarter`) vers le tiret (`three-quarter`),
 *    par sécurité — le contrat thème est le tiret, mais on ne veut pas qu'une faute de
 *    frappe côté config recale à tort une vraie photo 3/4.
 *
 * Retourne `null` si la valeur n'appartient PAS à l'enum. `null` signifie « cran inconnu »
 * → le juge IGNORE alors la contrainte d'angle (laisse passer) plutôt que de retomber
 * silencieusement sur 'front', ce qui refuserait à tort une photo de profil ou de 3/4.
 * Ne retourne JAMAIS 'none' : c'est une valeur de RÉSULTAT LLM, pas un cran requêtable.
 */
export function normalizeFaceAngle(raw: string | null | undefined): FaceAngle | null {
  if (!raw || typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase().replace(/_/g, '-')
  return (FACE_ANGLES as string[]).includes(v) ? (v as FaceAngle) : null
}

// Liste FERMÉE des codes d'anomalie (le front a un message i18n par code). Les 3 derniers
// (contrat §9.4) n'apparaissent QUE sous une policy `subject:"group"` / `framing:"full-body"`.
export type PhotoCheckIssue =
  | 'no_face'
  | 'multiple_faces'
  | 'too_dark'
  | 'blurry'
  | 'face_too_small'
  | 'obstructed'
  | 'angle_mismatch'
  | 'low_quality'
  | 'nsfw'
  | 'not_full_body'
  | 'too_many_people'
  | 'no_person'

/** Grade d'une photo ACCEPTÉE (ok:true) : 🟢 parfaite vs 🟡 acceptée avec mise en garde. */
export type PhotoGrade = 'perfect' | 'warn'

/** Verdict renvoyé au front : seul `ok` débloque « Continuer ». */
export interface PhotoCheckVerdict {
  ok: boolean
  issues: PhotoCheckIssue[]
  // Grade CALCULÉ CÔTÉ BACK (une seule source de vérité, contrat §9.5) en appliquant la
  // policy : 'perfect' (🟢) quand l'angle détecté correspond au cran idéal, 'warn' (🟡) quand
  // la photo est acceptée mais pas idéale (angle toléré). N'a de sens que si `ok:true` ; sur
  // un refus (`ok:false`) il vaut 'perfect' par convention (le front lit `issues`, pas grade).
  grade: PhotoGrade
  // Bucket d'angle RÉELLEMENT détecté sur la photo (≠ l'angle DEMANDÉ par l'œuvre) : un des
  // 4 crans canoniques, ou 'none' si aucun visage/orientation évaluable. TOUJOURS présent sur
  // une réponse 200 — conservé pour rétro-compat (un vieux front sans support `grade` retombe
  // sur le calcul local `detected === faceAngle`).
  faceAngleDetected: FaceAngle | 'none'
  // Nombre de personnes détectées (silhouettes, de face comme de dos). Surtout utile en mode
  // groupe (famille) ; null quand non évalué (pré-filtre serveur court-circuit).
  peopleCount: number | null
  cached: boolean
}

// Version du SCHÉMA d'évaluation intrinsèque (contrat §9.8.3). Toute évolution du set de
// champs jugés/comptés DOIT l'incrémenter : un hit de cache d'une version antérieure est
// re-jugé UNE fois (getCached le traite comme un miss) puis réécrit. v1 = schéma foot d'origine
// (sans peopleCount/bodiesFullyVisible) ; v2 = schéma policy (personnes + corps entiers).
const EVAL_VERSION = 2

/**
 * Évaluation INTRINSÈQUE et POLICY-AGNOSTIQUE de la photo (mise en cache, indépendante de la
 * policy appliquée). Champs à `null` = non évalués par le LLM (pré-filtre serveur court-circuit).
 */
export interface PhotoAssessment {
  // Visages nettement visibles (mode solo). Peut être 0 alors que des personnes sont présentes
  // (groupe vu de dos → aucun visage mais `peopleCount` > 0).
  faceCount: number | null
  // Personnes/silhouettes distinctes, Y COMPRIS de dos (compte les corps, pas les visages).
  peopleCount: number | null
  // true si CHAQUE personne est visible en entier (tête → pieds) ; false si un corps est coupé.
  bodiesFullyVisible: boolean | null
  // Orientation DOMINANTE du sujet/groupe (même échelle §3). 'none' = le LLM n'a vu aucun
  // sujet ; null = non évalué (court-circuit pré-filtre serveur).
  faceAngle: FaceAngle | 'none' | null
  tooDark: boolean
  blurry: boolean
  faceTooSmall: boolean
  obstructed: boolean
  lowQuality: boolean
  nsfw: boolean
  // Version du schéma ci-dessus (cf. EVAL_VERSION). Absent/inférieur => entrée de cache
  // périmée (re-jugée une fois).
  evalVersion: number
}

/**
 * Politique photo NORMALISÉE (résolue) appliquée à la dérivation du verdict. Provient soit du
 * bloc `photoPolicy` du front (parsePhotoPolicy), soit du SHIM de compatibilité dérivé de
 * `faceAngle` (fiche sans policy). Représentation interne : le mapping d'angles y est déjà
 * canonicalisé (clés d'angle normalisées, valeurs perfect|warn|reject).
 */
export interface PhotoPolicy {
  subject: 'person' | 'group'
  framing: 'face' | 'full-body'
  // Borne haute du nombre de personnes (mode groupe) : au-delà → `too_many_people`. null = pas
  // de borne.
  peopleMax: number | null
  // angle DÉTECTÉ → grade. `perfect`/`warn` acceptent (🟢/🟡), `reject` bloque (🔴). Un angle
  // ABSENT du mapping (mais mapping non vide) → `warn` (jamais bloquant par surprise, §9.2).
  angles: Record<string, PhotoGrade | 'reject'>
  // Le mapping d'angles est-il renseigné ? false (mapping vide) = angle NON jugé (cran inconnu /
  // groupe sans mapping) → l'angle ne contribue ni au refus ni au 🟡.
  angleJudged: boolean
}

const POLICY_GRADES = new Set(['perfect', 'warn', 'reject'])
// Clés d'angle acceptées dans un mapping de policy (les 4 crans + 'none' = « aucun sujet »).
const POLICY_ANGLE_KEYS = new Set<string>([...FACE_ANGLES, 'none'])

/** Normalise une clé d'angle de mapping (casse, underscore→tiret) ; null si hors périmètre. */
function normalizePolicyAngleKey(raw: string): string | null {
  const v = raw.trim().toLowerCase().replace(/_/g, '-')
  return POLICY_ANGLE_KEYS.has(v) ? v : null
}

/**
 * Parse le bloc `photoPolicy` (JSON envoyé VERBATIM en multipart `policy`) vers une PhotoPolicy
 * normalisée. Défensif : toute entrée absente/malformée → `null` (le service retombe sur le
 * shim `faceAngle`, comportement historique). Les surcharges i18n `messages` sont ignorées ici
 * (concern FRONT — le thème lit la policy de son côté).
 */
export function parsePhotoPolicy(raw: unknown): PhotoPolicy | null {
  if (!raw || typeof raw !== 'string') return null
  let json: any
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null

  const subject: PhotoPolicy['subject'] = json.subject === 'group' ? 'group' : 'person'
  const framingRaw = String(json.framing || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
  const framing: PhotoPolicy['framing'] = framingRaw === 'full-body' ? 'full-body' : 'face'

  let peopleMax: number | null = null
  const rawMax = json.people?.max
  if (Number.isFinite(rawMax)) peopleMax = Math.max(1, Math.trunc(rawMax))

  const angles: PhotoPolicy['angles'] = {}
  if (json.angles && typeof json.angles === 'object' && !Array.isArray(json.angles)) {
    for (const [k, v] of Object.entries(json.angles)) {
      const key = normalizePolicyAngleKey(String(k))
      const grade = String(v).trim().toLowerCase()
      if (key && POLICY_GRADES.has(grade)) angles[key] = grade as PhotoGrade | 'reject'
    }
  }

  return { subject, framing, peopleMax, angles, angleJudged: Object.keys(angles).length > 0 }
}

// --- Pré-filtres serveur (sharp) — volontairement TRÈS conservateurs : ils ne doivent
// jamais recaler une vraie photo (un faux positif bloquerait une vente ET serait mis en
// cache 1 h). Le LLM reste le juge des cas limites (sombre/flou modérés). ---
// Luminance moyenne (0-255) en deçà de laquelle la photo est inexploitable (quasi noire).
const DARK_MEAN_THRESHOLD = 25
// Plus petit côté (px) en deçà duquel la photo est trop petite pour un tirage.
const MIN_SHORT_SIDE_PX = 200

// Taille d'image envoyée au LLM : la photo est déjà réduite côté client (~768 px), on
// borne quand même pour des tokens image minimaux.
const LLM_IMAGE_MAX_PX = 768

// TTL du cache (≈1 h, plan §2) appliqué à la lecture.
const CACHE_TTL_MS = 60 * 60 * 1000
// Au-delà, balayage best-effort des entrées périmées (garde la table minuscule).
const CACHE_SWEEP_MS = 2 * 60 * 60 * 1000

// Borne de l'appel LLM : le visiteur attend à l'upload, on veut un verdict rapide. Sur
// dépassement → throw → le contrôleur renvoie 5xx → le front fail-open (la vente passe).
const LLM_TIMEOUT_MS = 15000

// Estimation indicative €/check (suivi du coût, pas une facture) : 1 appel Gemini Flash sur
// une petite image ≈ une fraction de centime.
const EST_COST_PHOTO_CHECK_EUR = 0.002

// Modèle CHEAP par défaut : Gemini Flash multimodal (vision + JSON structuré).
const DEFAULT_PHOTO_CHECK_MODEL = 'gemini-2.5-flash'

const HEX64_RE = /^[0-9a-f]{64}$/

export default class PhotoCheck {
  // Clé Gemini DÉDIÉE (AI Studio), lue via process.env comme le reste du pipeline image.
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  private model =
    Env.get('CUSTOM_ART_PHOTO_CHECK_MODEL') ||
    process.env.GEMINI_TEXT_MODEL ||
    DEFAULT_PHOTO_CHECK_MODEL

  /**
   * Évalue une photo et renvoie le verdict. `photo` = JPEG déjà réduit côté client.
   * `hash` = SHA-256 hex de la photo ORIGINALE (clé de cache) ; ignoré pour le cache s'il
   * est absent/malformé (le check tourne quand même, simplement non mémorisé).
   *
   * `policy` prime ; à défaut, un SHIM est dérivé de `faceAngle` (+ `legacyGroup` pour la
   * convention dormante `faceAngle:"group"`) → comportement foot historique inchangé.
   */
  public async check(input: {
    photo: Buffer
    // `null` = cran inconnu / non fourni : le shim n'appliquera AUCUNE contrainte d'angle
    // (cf. normalizeFaceAngle) — tous les AUTRES contrôles restent actifs.
    faceAngle: FaceAngle | null
    // Politique produit parsée (bloc `photoPolicy`) ; null → shim `faceAngle`.
    policy?: PhotoPolicy | null
    // Convention dormante `faceAngle:"group"` (recipe-contract §8) : mappée sur un shim groupe
    // quand aucune `policy` n'est fournie. La `policy` du front la remplace (§9.2).
    legacyGroup?: boolean
    hash: string | null
    productType?: string | null
  }): Promise<PhotoCheckVerdict> {
    const hash = this.sanitizeHash(input.hash)
    const policy = input.policy ?? this.shimPolicy(input.faceAngle, Boolean(input.legacyGroup))

    // 2) Cache par hash (avant tout appel payant). Verdict redérivé pour la policy courante.
    if (hash) {
      const cached = await this.getCached(hash)
      if (cached) {
        const verdict = this.deriveVerdict(cached, policy, true)
        this.log(verdict, 'cache', policy, input.faceAngle, 0)
        return verdict
      }
    }

    // 1) Pré-filtres serveur (sharp) — quasi noire / trop petite : verdict sans LLM.
    const pre = await this.prefilter(input.photo)
    if (pre) {
      if (hash) await this.putCached(hash, pre)
      const verdict = this.deriveVerdict(pre, policy, false)
      this.log(verdict, 'prefilter', policy, input.faceAngle, 0)
      return verdict
    }

    // 3) Appel LLM cheap (Gemini Flash, sortie structurée).
    const assessment = await this.assessWithLlm(input.photo)
    if (hash) await this.putCached(hash, assessment)
    const verdict = this.deriveVerdict(assessment, policy, false)
    this.log(verdict, 'llm', policy, input.faceAngle, EST_COST_PHOTO_CHECK_EUR)
    return verdict
  }

  // --------------------------------------------------------------------------
  // SHIM de compatibilité (§9.2) : `faceAngle` -> PhotoPolicy équivalente à la table §4
  // --------------------------------------------------------------------------

  /**
   * Traduit l'ancien contrat `faceAngle` en une PhotoPolicy équivalente à la table de
   * tolérance §4 — de sorte que le foot reste inchangé AU PIXEL (mêmes `ok`/`issues`).
   *  - cran de face connu → mapping ±1 cran (idéal = perfect, tolérés = warn, hors bornes =
   *    reject) ;
   *  - `back` → policy « produit de dos » : le visage n'a pas à être lisible (le mapping met
   *    back=perfect, ce qui suffit à désactiver les contrôles visage, cf. deriveVerdict) ;
   *  - cran inconnu (`faceAngle` null) → aucune contrainte d'angle (mapping vide) ;
   *  - `legacyGroup` → shim GROUPE (plusieurs visages OK, angle non jugé) — dormant, remplacé
   *    par `subject:"group"` dès que le front envoie une policy.
   *
   * Le grade 🟡 tombe du mapping (`warn`) : identique au calcul local que faisait le front
   * (`detected !== faceAngle` → 🟡), donc aucune régression visuelle sur le foot.
   */
  private shimPolicy(faceAngle: FaceAngle | null, legacyGroup: boolean): PhotoPolicy {
    if (legacyGroup) {
      // Groupe legacy : angle NON jugé, cadrage visage (pas d'exigence en-pied), pas de borne.
      return { subject: 'group', framing: 'face', peopleMax: null, angles: {}, angleJudged: false }
    }
    if (faceAngle === null) {
      // Cran inconnu : angle ignoré (mapping vide), tous les autres contrôles restent actifs.
      return { subject: 'person', framing: 'face', peopleMax: null, angles: {}, angleJudged: false }
    }
    // Mapping ±1 cran (fidèle aux fourchettes de yaw §4). 'none' → reject : un visage compté
    // mais d'orientation « aucune » est incohérent (recalé, comme l'ancien angleMatches).
    const SHIM_ANGLES: Record<FaceAngle, PhotoPolicy['angles']> = {
      'front': {
        'front': 'perfect',
        'three-quarter': 'warn',
        'profile': 'reject',
        'back': 'reject',
        'none': 'reject',
      },
      'three-quarter': {
        'three-quarter': 'perfect',
        'front': 'warn',
        'profile': 'warn',
        'back': 'reject',
        'none': 'reject',
      },
      'profile': {
        'profile': 'perfect',
        'three-quarter': 'warn',
        'front': 'reject',
        'back': 'reject',
        'none': 'reject',
      },
      'back': {
        'back': 'perfect',
        'front': 'reject',
        'three-quarter': 'reject',
        'profile': 'reject',
        'none': 'reject',
      },
    }
    return {
      subject: 'person',
      framing: 'face',
      peopleMax: null,
      angles: SHIM_ANGLES[faceAngle],
      angleJudged: true,
    }
  }

  // --------------------------------------------------------------------------
  // Verdict : (évaluation intrinsèque, policy) -> { ok, issues, grade, ... }
  // --------------------------------------------------------------------------

  private deriveVerdict(
    a: PhotoAssessment,
    policy: PhotoPolicy,
    cached: boolean
  ): PhotoCheckVerdict {
    // Angle DÉTECTÉ exposé tel quel (jamais l'angle demandé). Les 4 crans canoniques passent
    // verbatim ; 'none' du LLM ET null du pré-filtre se rabattent sur 'none' — le champ reste
    // TOUJOURS l'un des 5 buckets { front, three-quarter, profile, back, none }.
    const detected: FaceAngle | 'none' =
      a.faceAngle && a.faceAngle !== 'none' ? a.faceAngle : 'none'
    const peopleCount = a.peopleCount ?? null

    const mk = (issues: PhotoCheckIssue[], warn: boolean): PhotoCheckVerdict => {
      const ok = issues.length === 0
      return {
        ok,
        issues,
        grade: ok && warn ? 'warn' : 'perfect',
        faceAngleDetected: detected,
        peopleCount,
        cached,
      }
    }

    // NSFW : court-circuit (un seul code, on ne mélange pas avec le reste).
    if (a.nsfw) return mk(['nsfw'], false)

    const issues: PhotoCheckIssue[] = []
    // Signaux indépendants du sujet (valables même pour un dos / un groupe).
    if (a.tooDark) issues.push('too_dark')
    if (a.blurry) issues.push('blurry')
    if (a.lowQuality) issues.push('low_quality')

    // Pré-filtre serveur (faceCount null = LLM non appelé) : aucune évaluation de sujet.
    if (a.faceCount === null) return mk(issues, false)

    // Grade d'angle appliqué à l'orientation DÉTECTÉE. Mapping vide (cran inconnu) => angle non
    // jugé (null). Angle absent d'un mapping non vide => 'warn' (jamais bloquant par surprise).
    const angleGrade: PhotoGrade | 'reject' | null = policy.angleJudged
      ? policy.angles[detected] ?? 'warn'
      : null
    let warn = false

    // ----- Mode GROUPE (famille) : on compte des PERSONNES, `multiple_faces` désactivé -----
    if (policy.subject === 'group') {
      const count = peopleCount ?? a.faceCount ?? 0
      if (count === 0) {
        // Aucune personne : refus dédié (≠ `no_face` du mode solo).
        issues.push('no_person')
        return mk(issues, false)
      }
      if (policy.peopleMax != null && count > policy.peopleMax) issues.push('too_many_people')
      // Cadrage en-pied (D-2) : un corps coupé fausse les tailles relatives → refus.
      if (policy.framing === 'full-body' && a.bodiesFullyVisible === false) {
        issues.push('not_full_body')
      }
      // Angle dominant du groupe : reject bloque, warn informe (jamais un faux rejet).
      if (angleGrade === 'reject') issues.push('angle_mismatch')
      else if (angleGrade === 'warn') warn = true
      return mk(issues, warn)
    }

    // ----- Mode SOLO (portrait) -----
    if (a.faceCount > 1) {
      // Plusieurs visages sur un portrait solo : refus (comme historiquement).
      issues.push('multiple_faces')
      return mk(issues, false)
    }
    // Un sujet potentiellement DE DOS (produit « de dos ») : le visage n'a pas à être lisible.
    // Le mapping l'exprime en acceptant l'angle 'back' (perfect/warn) → on ne valide alors que
    // qualité + unicité (déjà faites), ni angle, ni visage trop petit/masqué.
    const backAccepted = Boolean(policy.angles['back']) && policy.angles['back'] !== 'reject'
    if (backAccepted) return mk(issues, false)

    if (a.faceCount === 0) {
      // Aucun visage sur un produit qui en exige un.
      issues.push('no_face')
      return mk(issues, false)
    }

    // faceCount === 1 : contrôles liés au visage selon le cadrage.
    if (policy.framing === 'full-body') {
      if (a.bodiesFullyVisible === false) issues.push('not_full_body')
    } else {
      if (a.faceTooSmall) issues.push('face_too_small')
      if (a.obstructed) issues.push('obstructed')
    }
    // Contrainte d'angle (uniquement si un mapping s'applique) : reject bloque, warn informe.
    if (angleGrade === 'reject') issues.push('angle_mismatch')
    else if (angleGrade === 'warn') warn = true
    return mk(issues, warn)
  }

  // --------------------------------------------------------------------------
  // 1) Pré-filtres serveur (sharp) — null = rien à signaler, on continue la cascade
  // --------------------------------------------------------------------------

  private async prefilter(photo: Buffer): Promise<PhotoAssessment | null> {
    try {
      const meta = await sharp(photo).metadata()
      const shortSide = Math.min(meta.width || 0, meta.height || 0)
      if (shortSide > 0 && shortSide < MIN_SHORT_SIDE_PX) {
        return this.flag({ lowQuality: true })
      }

      const stats = await sharp(photo).greyscale().stats()
      const mean = stats.channels[0]?.mean ?? 255
      if (mean < DARK_MEAN_THRESHOLD) {
        return this.flag({ tooDark: true })
      }
    } catch {
      // Photo illisible côté serveur (format exotique) -> low_quality plutôt que de tenter le LLM.
      return this.flag({ lowQuality: true })
    }
    return null
  }

  /** Évaluation « pré-filtre » : sujet non évalué (faceCount null), un seul signal posé. */
  private flag(partial: Partial<PhotoAssessment>): PhotoAssessment {
    return {
      faceCount: null,
      peopleCount: null,
      bodiesFullyVisible: null,
      faceAngle: null,
      tooDark: false,
      blurry: false,
      faceTooSmall: false,
      obstructed: false,
      lowQuality: false,
      nsfw: false,
      evalVersion: EVAL_VERSION,
      ...partial,
    }
  }

  // --------------------------------------------------------------------------
  // 3) Appel LLM cheap (Gemini Flash) — sortie JSON structurée
  // --------------------------------------------------------------------------

  private async assessWithLlm(photo: Buffer): Promise<PhotoAssessment> {
    const jpeg = await sharp(photo)
      .rotate() // applique l'orientation EXIF
      .resize(LLM_IMAGE_MAX_PX, LLM_IMAGE_MAX_PX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        faceCount: {
          type: Type.INTEGER,
          description:
            'Nombre de VISAGES humains nettement visibles (0, 1, 2, …). Peut être 0 même si des personnes sont présentes mais vues de dos.',
        },
        peopleCount: {
          type: Type.INTEGER,
          description:
            "Nombre de PERSONNES humaines distinctes (silhouettes/corps), Y COMPRIS celles vues de dos ou de profil dont le visage n'est pas visible. 0 si aucune personne.",
        },
        bodiesFullyVisible: {
          type: Type.BOOLEAN,
          description:
            "true si CHAQUE personne présente est visible en entier, de la tête aux pieds (pieds inclus) ; false si au moins un corps est coupé par le cadre (buste seul, jambes/pieds hors champ). Répondre true s'il n'y a aucune personne.",
        },
        faceAngle: {
          type: Type.STRING,
          format: 'enum',
          enum: ['front', 'three-quarter', 'profile', 'back', 'none'],
          description:
            "Orientation (yaw) DOMINANTE du sujet principal (ou du groupe). front=face caméra ~0–25° (les deux yeux visibles). three-quarter=trois-quarts ~25–65°. profile=profil marqué ~65–110°. back=vu de DOS / nuque (visage non visible) — à choisir dès que la ou les personnes sont vues de dos, PAS 'none'. none=aucune personne / orientation indéterminée. En cas d'hésitation entre front et three-quarter, ou entre three-quarter et profile, choisis three-quarter.",
        },
        tooDark: { type: Type.BOOLEAN, description: 'Photo trop sombre/sous-exposée.' },
        blurry: { type: Type.BOOLEAN, description: 'Photo floue / pas nette sur le sujet.' },
        faceTooSmall: {
          type: Type.BOOLEAN,
          description: 'Le visage principal est trop petit dans le cadre (personne trop loin).',
        },
        obstructed: {
          type: Type.BOOLEAN,
          description: 'Visage masqué (lunettes de soleil, masque, main, cheveux devant, objet).',
        },
        lowQuality: {
          type: Type.BOOLEAN,
          description: 'Qualité insuffisante pour un tirage (très pixelisé, capture d’écran).',
        },
        nsfw: { type: Type.BOOLEAN, description: 'Contenu sexuel, violent ou choquant.' },
      },
      required: [
        'faceCount',
        'peopleCount',
        'bodiesFullyVisible',
        'faceAngle',
        'tooDark',
        'blurry',
        'faceTooSmall',
        'obstructed',
        'lowQuality',
        'nsfw',
      ],
    }

    const req = {
      model: this.model,
      contents: [
        { text: this.prompt() },
        { inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0,
      },
    }

    const rsp: any = await this.withTimeout(this.ai.models.generateContent(req as any))
    const raw = typeof rsp?.text === 'string' ? rsp.text : ''
    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error(`photo-check: sortie LLM non-JSON (${raw.slice(0, 120)})`)
    }

    // Tout ce qui n'est pas l'un des 4 crans canoniques (le 'none' du LLM = aucun sujet, ou une
    // sortie inattendue) retombe sur 'none' — jamais sur un faux cran de face.
    const angle: PhotoAssessment['faceAngle'] = FACE_ANGLES.includes(parsed.faceAngle)
      ? parsed.faceAngle
      : 'none'
    const faceCount = Number.isFinite(parsed.faceCount)
      ? Math.max(0, Math.trunc(parsed.faceCount))
      : 0
    // peopleCount : au moins autant que les visages comptés (une personne sans visage lisible
    // reste une personne) ; défaut = faceCount si le champ manque.
    const peopleCount = Number.isFinite(parsed.peopleCount)
      ? Math.max(0, Math.trunc(parsed.peopleCount))
      : faceCount

    return {
      faceCount,
      peopleCount: Math.max(peopleCount, faceCount),
      bodiesFullyVisible:
        typeof parsed.bodiesFullyVisible === 'boolean' ? parsed.bodiesFullyVisible : null,
      faceAngle: angle,
      tooDark: Boolean(parsed.tooDark),
      blurry: Boolean(parsed.blurry),
      faceTooSmall: Boolean(parsed.faceTooSmall),
      obstructed: Boolean(parsed.obstructed),
      lowQuality: Boolean(parsed.lowQuality),
      nsfw: Boolean(parsed.nsfw),
      evalVersion: EVAL_VERSION,
    }
  }

  private prompt(): string {
    return `Tu analyses une photo destinée à devenir un poster artistique personnalisé imprimé.
Tu CLASSES OBJECTIVEMENT la photo via le format structuré demandé — tu ne décides PAS si elle est « acceptable » ni « idéale » (c'est le code, selon le produit, qui conclura) : tu te contentes de CONSTATER ce que tu vois :
- faceCount : nombre de VISAGES humains nettement visibles (0, 1, 2, …). Peut valoir 0 si les personnes sont vues de dos.
- peopleCount : nombre de PERSONNES humaines distinctes (silhouettes/corps), Y COMPRIS de dos ou de profil dont le visage n'est pas visible. 0 si aucune personne.
- bodiesFullyVisible : true si CHAQUE personne est visible en entier, de la tête aux pieds (pieds inclus) ; false si au moins un corps est coupé par le cadre (buste seul, jambes ou pieds hors champ). true s'il n'y a aucune personne.
- faceAngle : orientation (yaw) DOMINANTE du sujet principal ou du groupe — "front" (face caméra, ~0–25°), "three-quarter" (trois-quarts, ~25–65°), "profile" (profil marqué, ~65–110°), "back" (vu de DOS / nuque, visage non visible — choisis-le dès que les personnes sont de dos), ou "none" si aucune personne. En cas d'hésitation entre front et three-quarter, ou entre three-quarter et profile, choisis "three-quarter".
- tooDark : true si la photo est trop sombre ou sous-exposée pour distinguer le sujet.
- blurry : true si la photo est floue / pas nette sur le sujet.
- faceTooSmall : true si le visage principal occupe une trop petite part du cadre (personne trop loin).
- obstructed : true si le visage principal est partiellement masqué (lunettes de soleil, masque, main, cheveux devant, objet).
- lowQuality : true si la qualité générale est insuffisante pour un tirage (très pixelisé, fortement compressé, capture d'écran).
- nsfw : true si la photo a un contenu sexuel, violent ou choquant.
Sois neutre et factuel : tu DÉCRIS, tu ne juges pas. Réponds uniquement via le format structuré.`
  }

  // --------------------------------------------------------------------------
  // 2) Cache MySQL (pas de Redis ici) — TTL ~1 h à la lecture, balayage best-effort
  // --------------------------------------------------------------------------

  private async getCached(hash: string): Promise<PhotoAssessment | null> {
    try {
      const row = await CustomArtPhotoCheck.findBy('hash', hash)
      if (!row) return null
      const ageMs = Date.now() - row.createdAt.toMillis()
      if (ageMs > CACHE_TTL_MS) return null // périmé : on re-jugera (et on écrasera l'entrée)
      // Schéma d'évaluation périmé (§9.8.3) : une entrée d'une `evalVersion` antérieure a été
      // jugée « façon foot » (sans comptage de personnes ni cadrage) — la re-juger UNE fois
      // plutôt que de servir un verdict groupe/en-pied faux depuis le cache.
      if (!row.assessment || row.assessment.evalVersion !== EVAL_VERSION) return null
      return row.assessment
    } catch (e) {
      Logger.warn('photo-check cache read %s: %s', hash.slice(0, 8), (e as Error).message)
      return null
    }
  }

  private async putCached(hash: string, assessment: PhotoAssessment): Promise<void> {
    try {
      // created_at posé explicitement : sur un updateOrCreate d'une entrée périmée, il
      // rafraîchit le TTL (autoCreate ne s'applique qu'à l'insertion).
      await CustomArtPhotoCheck.updateOrCreate({ hash }, { assessment, createdAt: DateTime.now() })
      this.sweep().catch(() => {})
    } catch (e) {
      Logger.warn('photo-check cache write %s: %s', hash.slice(0, 8), (e as Error).message)
    }
  }

  /** Purge best-effort des entrées au-delà du TTL (la table reste minuscule). */
  private async sweep(): Promise<void> {
    try {
      const cutoff = DateTime.now().minus({ milliseconds: CACHE_SWEEP_MS })
      const cutoffSql = cutoff.toSQL({ includeOffset: false }) as string
      await CustomArtPhotoCheck.query().where('created_at', '<', cutoffSql).delete()
    } catch {
      // best-effort
    }
  }

  // --------------------------------------------------------------------------
  // Divers
  // --------------------------------------------------------------------------

  private sanitizeHash(hash: string | null | undefined): string | null {
    if (!hash || typeof hash !== 'string') return null
    const h = hash.trim().toLowerCase()
    return HEX64_RE.test(h) ? h : null
  }

  private withTimeout<T>(p: Promise<T>): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Gemini photo-check timeout (${LLM_TIMEOUT_MS}ms)`)),
          LLM_TIMEOUT_MS
        )
      ),
    ])
  }

  private log(
    verdict: PhotoCheckVerdict,
    source: 'cache' | 'prefilter' | 'llm',
    policy: PhotoPolicy,
    faceAngle: FaceAngle | null,
    costEur: number
  ): void {
    // Mode compact : subject/framing + cran demandé (ou 'any' si angle non jugé).
    const mode = `${policy.subject}/${policy.framing}`
    Logger.info(
      'custom-art photo-check ok=%s grade=%s issues=[%s] angle=%s/%s people=%s mode=%s source=%s cached=%s costEur=%s',
      verdict.ok,
      verdict.grade,
      verdict.issues.join(','),
      verdict.faceAngleDetected, // détecté (toujours présent : un des 5 buckets, dont 'none')
      policy.angleJudged ? faceAngle || 'mapped' : 'any', // cran demandé / 'any' = angle non jugé
      verdict.peopleCount ?? '-',
      mode,
      source,
      verdict.cached,
      costEur.toFixed(4)
    )
  }
}
