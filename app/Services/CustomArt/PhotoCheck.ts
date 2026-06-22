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
 * CACHE INDÉPENDANT DE L'ANGLE (décision d'implémentation) : le LLM/pré-filtre produit une
 * ÉVALUATION INTRINSÈQUE de la photo (nb de visages, angle détecté, flou, sombre…) ; le
 * verdict final (ok/issues, dont `angle_mismatch`) est recalculé EN CODE à partir de
 * (évaluation, faceAngle demandé). Ainsi la même photo soumise avec un autre `faceAngle`
 * reste un hit de cache (clé = hash seul) et ne re-coûte jamais un appel LLM.
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

// Liste FERMÉE des codes d'anomalie (le front a un message i18n par code).
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

/** Verdict renvoyé au front : seul `ok` débloque « Continuer ». */
export interface PhotoCheckVerdict {
  ok: boolean
  issues: PhotoCheckIssue[]
  faceAngleDetected?: string
  cached: boolean
}

/**
 * Évaluation INTRINSÈQUE de la photo (mise en cache, indépendante de l'angle demandé).
 * `faceCount`/`faceAngle` à null = non évalué par le LLM (pré-filtre serveur court-circuit).
 */
export interface PhotoAssessment {
  faceCount: number | null
  // 'none' = le LLM n'a vu aucun visage (≠ des 4 crans requêtables FACE_ANGLES) ;
  // null = visage non évalué (court-circuit pré-filtre serveur).
  faceAngle: FaceAngle | 'none' | null
  tooDark: boolean
  blurry: boolean
  faceTooSmall: boolean
  obstructed: boolean
  lowQuality: boolean
  nsfw: boolean
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
   */
  public async check(input: {
    photo: Buffer
    // `null` = cran inconnu / non fourni : le juge ignore la contrainte d'angle (cf.
    // normalizeFaceAngle) — tous les AUTRES contrôles (visage, netteté, nsfw…) s'appliquent.
    faceAngle: FaceAngle | null
    hash: string | null
    productType?: string | null
  }): Promise<PhotoCheckVerdict> {
    const hash = this.sanitizeHash(input.hash)

    // 2) Cache par hash (avant tout appel payant). Verdict recalculé pour l'angle demandé.
    if (hash) {
      const cached = await this.getCached(hash)
      if (cached) {
        const verdict = this.deriveVerdict(cached, input.faceAngle, true)
        this.log(verdict, 'cache', input.faceAngle, 0)
        return verdict
      }
    }

    // 1) Pré-filtres serveur (sharp) — quasi noire / trop petite : verdict sans LLM.
    const pre = await this.prefilter(input.photo)
    if (pre) {
      if (hash) await this.putCached(hash, pre)
      const verdict = this.deriveVerdict(pre, input.faceAngle, false)
      this.log(verdict, 'prefilter', input.faceAngle, 0)
      return verdict
    }

    // 3) Appel LLM cheap (Gemini Flash, sortie structurée).
    const assessment = await this.assessWithLlm(input.photo)
    if (hash) await this.putCached(hash, assessment)
    const verdict = this.deriveVerdict(assessment, input.faceAngle, false)
    this.log(verdict, 'llm', input.faceAngle, EST_COST_PHOTO_CHECK_EUR)
    return verdict
  }

  // --------------------------------------------------------------------------
  // Verdict : (évaluation intrinsèque, angle demandé) -> { ok, issues, ... }
  // --------------------------------------------------------------------------

  private deriveVerdict(
    a: PhotoAssessment,
    faceAngle: FaceAngle | null,
    cached: boolean
  ): PhotoCheckVerdict {
    const detected = a.faceAngle && a.faceAngle !== 'none' ? a.faceAngle : undefined
    const base = (issues: PhotoCheckIssue[]): PhotoCheckVerdict => ({
      ok: issues.length === 0,
      issues,
      faceAngleDetected: detected,
      cached,
    })

    // NSFW : court-circuit (un seul code, on ne mélange pas avec le reste).
    if (a.nsfw) return base(['nsfw'])

    const issues: PhotoCheckIssue[] = []
    // Signaux indépendants du visage (valables même pour un dos).
    if (a.tooDark) issues.push('too_dark')
    if (a.blurry) issues.push('blurry')
    if (a.lowQuality) issues.push('low_quality')

    // Évaluation liée au visage : ignorée si le LLM n'a pas tourné (pré-filtre, faceCount null).
    if (a.faceCount !== null) {
      if (a.faceCount > 1) {
        issues.push('multiple_faces')
      } else if (faceAngle !== 'back') {
        // Pour un dos (faceAngle='back') le visage n'a pas à être lisible : on ne valide
        // que netteté/exposition/qualité/nsfw + un seul sujet (plan §prompt).
        if (a.faceCount === 0) {
          issues.push('no_face')
        } else {
          if (a.faceTooSmall) issues.push('face_too_small')
          if (a.obstructed) issues.push('obstructed')
          // Contrainte d'angle UNIQUEMENT si l'œuvre a précisé un cran connu. Sur cran
          // inconnu (faceAngle null), on NE recale PAS sur l'angle (laisser passer plutôt
          // qu'appliquer un mauvais cran) ; les autres contrôles restent actifs.
          if (faceAngle !== null && !this.angleMatches(a.faceAngle, faceAngle)) {
            issues.push('angle_mismatch')
          }
        }
      }
    }

    return base(issues)
  }

  /**
   * L'angle détecté correspond-il à l'angle attendu ? Tolérance d'UN cran sur l'échelle
   * front(0)→three-quarter(1)→profile(2). Volontairement PERMISSIF (un faux rejet bloque une
   * vente ; en cas de doute entre deux crans adjacents on accepte). Matrice résultante,
   * fidèle aux fourchettes de yaw du contrat thème (front 0–25°, 3/4 25–65°, profil 65–110°) :
   *   - attendu `front`         → accepte front + three-quarter ; refuse profile.
   *   - attendu `three-quarter` → accepte front + three-quarter + profile (fourchette large
   *                                voulue : le cran 3/4 ne doit JAMAIS recaler à tort).
   *   - attendu `profile`       → accepte three-quarter + profile ; refuse front.
   *   - attendu `back`          → correspondance EXACTE (un dos n'a pas de demi-mesure).
   * `none`/`back` détecté pour un cran de face = mismatch.
   */
  private angleMatches(detected: PhotoAssessment['faceAngle'], expected: FaceAngle): boolean {
    if (expected === 'back') return detected === 'back'
    const scale: Record<string, number> = { 'front': 0, 'three-quarter': 1, 'profile': 2 }
    if (!detected || !(detected in scale)) return false // 'back' / 'none' attendu de face = mismatch
    return Math.abs(scale[detected] - scale[expected]) <= 1
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

  /** Évaluation « pré-filtre » : visage non évalué (faceCount null), un seul signal posé. */
  private flag(partial: Partial<PhotoAssessment>): PhotoAssessment {
    return {
      faceCount: null,
      faceAngle: null,
      tooDark: false,
      blurry: false,
      faceTooSmall: false,
      obstructed: false,
      lowQuality: false,
      nsfw: false,
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
          description: 'Nombre de visages humains nettement visibles (0, 1, 2, …).',
        },
        faceAngle: {
          type: Type.STRING,
          format: 'enum',
          enum: ['front', 'three-quarter', 'profile', 'back', 'none'],
          description:
            "Orientation (yaw) du visage principal. front=face caméra, tête tournée d'environ 0–25° (les deux yeux et les deux oreilles visibles). three-quarter=trois-quarts, ~25–65° (un côté du visage plus visible, les deux yeux restent visibles). profile=profil marqué, ~65–110° (un seul œil / une seule oreille visible). back=vu de dos ou nuque, visage non visible. none=aucun visage. En cas d'hésitation entre front et three-quarter, ou entre three-quarter et profile, choisis three-quarter.",
        },
        tooDark: { type: Type.BOOLEAN, description: 'Photo trop sombre/sous-exposée.' },
        blurry: { type: Type.BOOLEAN, description: 'Photo floue / pas nette sur le visage.' },
        faceTooSmall: {
          type: Type.BOOLEAN,
          description: 'Le visage est trop petit dans le cadre (personne trop loin).',
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

    // Tout ce qui n'est pas l'un des 4 crans canoniques (le 'none' du LLM = aucun visage,
    // ou une sortie inattendue) retombe sur 'none' — jamais sur un faux cran de face.
    const angle: PhotoAssessment['faceAngle'] = FACE_ANGLES.includes(parsed.faceAngle)
      ? parsed.faceAngle
      : 'none'
    const faceCount = Number.isFinite(parsed.faceCount)
      ? Math.max(0, Math.trunc(parsed.faceCount))
      : 0

    return {
      faceCount,
      faceAngle: angle,
      tooDark: Boolean(parsed.tooDark),
      blurry: Boolean(parsed.blurry),
      faceTooSmall: Boolean(parsed.faceTooSmall),
      obstructed: Boolean(parsed.obstructed),
      lowQuality: Boolean(parsed.lowQuality),
      nsfw: Boolean(parsed.nsfw),
    }
  }

  private prompt(): string {
    return `Tu analyses une photo destinée à devenir un poster artistique imprimé représentant la personne en footballeur.
Décris OBJECTIVEMENT la photo via le format structuré demandé — tu ne décides PAS si elle est « acceptable », tu te contentes de CONSTATER ce que tu vois :
- faceCount : nombre de visages humains nettement visibles (0, 1, 2, …).
- faceAngle : orientation (yaw) du visage principal — "front" (face caméra, ~0–25°, les deux yeux et oreilles visibles), "three-quarter" (trois-quarts, ~25–65°, un côté plus visible mais les deux yeux restent visibles), "profile" (profil marqué, ~65–110°, un seul œil/une seule oreille), "back" (vu de dos / nuque, visage non visible), ou "none" si aucun visage. En cas d'hésitation entre front et three-quarter, ou entre three-quarter et profile, choisis "three-quarter".
- tooDark : true si la photo est trop sombre ou sous-exposée pour distinguer le visage.
- blurry : true si la photo est floue / pas nette sur le visage.
- faceTooSmall : true si le visage occupe une trop petite part du cadre (personne trop loin).
- obstructed : true si le visage est partiellement masqué (lunettes de soleil, masque, main, cheveux devant, objet).
- lowQuality : true si la qualité générale est insuffisante pour un tirage (très pixelisé, fortement compressé, capture d'écran).
- nsfw : true si la photo a un contenu sexuel, violent ou choquant.
Sois bienveillant mais attentif à la lisibilité du visage. Réponds uniquement via le format structuré.`
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
    faceAngle: FaceAngle | null,
    costEur: number
  ): void {
    Logger.info(
      'custom-art photo-check ok=%s issues=[%s] angle=%s/%s source=%s cached=%s costEur=%s',
      verdict.ok,
      verdict.issues.join(','),
      verdict.faceAngleDetected || '-',
      faceAngle || 'any', // 'any' = cran inconnu, contrainte d'angle ignorée
      source,
      verdict.cached,
      costEur.toFixed(4)
    )
  }
}
