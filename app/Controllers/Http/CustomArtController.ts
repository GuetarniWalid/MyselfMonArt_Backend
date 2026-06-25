import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Env from '@ioc:Adonis/Core/Env'
import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'
import { randomUUID, createHash } from 'crypto'
import { promises as fs } from 'fs'
import { DateTime } from 'luxon'
import sharp from 'sharp'
import CustomArtJob, { CustomArtCandidate } from 'App/Models/CustomArtJob'
import CustomArtSession from 'App/Models/CustomArtSession'
import CustomArtTeam from 'App/Models/CustomArtTeam'
import CustomArtJobValidator from 'App/Validators/CustomArtJobValidator'
import CustomArtSaveValidator from 'App/Validators/CustomArtSaveValidator'
import CustomArtPhotoCheckValidator from 'App/Validators/CustomArtPhotoCheckValidator'
import PhotoCheck, { normalizeFaceAngle } from 'App/Services/CustomArt/PhotoCheck'
import CustomArtStorage from 'App/Services/CustomArt/Storage'
import CustomArtVariantMapping from 'App/Services/CustomArt/VariantMapping'
import JobEstimate, { normalizeProductType } from 'App/Services/CustomArt/JobEstimate'
import { affectedRows } from 'App/Services/CustomArt/db'
import SaveMailer from 'App/Services/CustomArt/SaveMailer'
import { clientIp } from 'App/Services/ClientIp'

// Caps anti-abus (plan §4) : 2 essais anonymes/jour (session+IP), 5/jour avec email,
// + cap coût global quotidien (env CUSTOM_ART_DAILY_COST_CAP_EUR, défaut 30 €).
const CAP_ANON_PER_DAY = 2
const CAP_EMAIL_PER_DAY = 5
const DEFAULT_DAILY_COST_CAP_EUR = 30

// Envois « Sauvegarder ma création » : cap DB par session et par jour (anti-relais
// d'emails depuis le domaine de la marque), en plus du throttle HTTP.
const SAVE_MAILS_PER_DAY = 3

// Réserve de coût pour un job pas encore terminé : les coûts réels ne sont écrits
// qu'en fin de traitement par le worker (3 générations + 3 jugements, jusqu'à 2 rounds).
const EST_JOB_COST_EUR = 0.5

const SESSION_COOKIE = 'custom_art_session'
const SESSION_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90

// Contraintes photo (plan §4) : jpg/png/webp/heic, <12 Mo.
// Plancher de taille ALIGNÉ sur le photo-check (PhotoCheck.MIN_SHORT_SIDE_PX = 200) :
// décision Walid (2026-06-24) « le re-check de génération ne doit jamais être PLUS STRICT
// que /photo-check ». L'ancien plancher 512 px recalait (422) des originaux 200–511 px
// pourtant validés `ok:true` au photo-check (qui n'évalue qu'un JPEG réduit ~768 px côté
// client) -> les deux portes se contredisaient. La résolution du TIRAGE ne dépend PAS de
// la photo source (le poster imprimé = l'œuvre générée 2048 px) ; la finesse de la photo
// ne joue que sur la ressemblance du visage, déjà jugée par le photo-check
// (faceTooSmall/low_quality). Sous 200 px, photo-check ET /jobs refusent de concert.
const PHOTO_EXTNAMES = ['jpg', 'jpeg', 'png', 'webp', 'heic']
const PHOTO_MAX_SIZE = '12mb'
const PHOTO_MIN_PX = 200

// Photo-check (POST /photo-check) : la photo arrive DÉJÀ réduite côté client (~768 px, qqs
// dizaines de Ko) → plafond généreux (5 Mo) + types courants. Le check tourne SANS session.
const PHOTO_CHECK_EXTNAMES = ['jpg', 'jpeg', 'png', 'webp', 'heic']
const PHOTO_CHECK_MAX_SIZE = '5mb'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Message client du fallback artiste (décision grill §0.15) — chaleureux, sans jargon
const MANUAL_REVIEW_MESSAGE =
  'Votre photo mérite une attention particulière : un artiste de notre atelier va ' +
  'finaliser votre tableau à la main. Laissez-nous votre email et recevez votre aperçu ' +
  "sous 24 h — cet essai n'est pas décompté."

/**
 * API publique du studio CustomArt (poster personnalisé foot).
 * Toute génération est asynchrone : POST /jobs répond immédiatement avec un jobId,
 * le front polle GET /jobs/:uuid (Cache-Control: no-store, sinon Cloudflare fige
 * un état pending). Le travail réel est fait par App/Services/CustomArt/Worker.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTRAT JSON (consommé par le studio du thème — toute réponse est homogène) :
 *
 *   Succès : 200 `{ success: true,  data: { ... } }`
 *   Erreur : 4xx/5xx `{ success: false, message: string, code?: string, errors?: [...] }`
 *     codes : 'not_found' | 'email_required' | 'daily_cap' | 'high_traffic'
 *       - 'email_required' (429) : essais anonymes du jour épuisés -> le front ouvre la
 *         boîte e-mail (l'e-mail renvoyé en POST /jobs lève le cap 2 -> 5).
 *       - 'daily_cap'      (429) : quota du jour épuisé MÊME avec e-mail (5/5) -> message
 *         « limite du jour atteinte, reviens demain » (PAS la boîte e-mail : on bouclerait).
 *       - 'high_traffic'   (429) : cap COÛT global du studio atteint (pas la limite perso)
 *         -> message « forte affluence, réessaie plus tard ».
 *       NB : un 429 SANS `code` (et avec en-tête `Retry-After`) vient du throttle HTTP par
 *       IP/route (App/Middleware/Throttle) = anti-rafale (10/min sur /jobs) — distinct des
 *       caps métier ci-dessus. Brancher sur `data.code`, pas sur le seul statut 429.
 *     Les 429 de cap (email_required/daily_cap/high_traffic) renvoient AUSSI `token`
 *     (jeton de session, comme la réponse 200) ET `resetsAt` (ISO 8601 avec offset =
 *     prochain minuit Europe/Paris où le quota « du jour » se réinitialise ; sert au
 *     « reviens demain » de 'daily_cap'). Le `token` : le front le renvoie en header
 *     'x-custom-art-session' pour conserver UNE seule session quand les cookies tiers
 *     sont bloqués (mobile) — sinon chaque tentative recrée une session et l'e-mail de
 *     déblocage se rattache à une session éphémère.
 *
 * POST /api/custom-art/jobs  (multipart)
 *   in  : photo (jpg/png/webp/heic, <=12 Mo, min 200 px — aligné photo-check), teamId, playerName,
 *         playerNumber, et SOIT variantId (variante Shopify choisie — SOURCE DE
 *         VÉRITÉ, format+finition dérivés de ses options), SOIT format ('30x40'|
 *         '60x80') + frame (slug) en secours. email facultatif : associé à la
 *         session avant le contrôle des caps (débloque le cap 'email_required').
 *   out : data = { jobId, token }   (token = jeton de session à renvoyer en
 *         header 'x-custom-art-session' si les cookies tiers sont bloqués)
 *
 * GET /api/custom-art/jobs/:uuid  (polling 2 s)
 *   out : data.status =
 *     'processing'    -> { status, step: 'pending'|'generating'|'judging', progress }
 *     'ready'         -> { status, progress: 100, preview, revealed, remainingReveals,
 *                          candidate: { rank, total, hasMore },
 *                          playerName, playerNumber, teamId, format, frame, mockups }
 *                        `preview` = URL backend /jobs/:uuid/preview/:n (en-tête
 *                        Access-Control-Allow-Origin posé pour le WebGL du thème).
 *                        `candidate` = navigateur de versions du lot (compteur « rank/total »
 *                        côté studio) : `rank` 1-based du candidat servi (meilleur = 1),
 *                        `total` = candidats VALIDÉS par le juge (pass) du lot, tous déjà
 *                        rendus et révélables gratuitement ; `hasMore` = reste-t-il un
 *                        runner-up VALIDÉ à révéler (false = dernier validé).
 *     'failed'        -> { status, message }   (échec technique, essai non décompté)
 *     'manual_review' -> { status, message }   (fallback artiste §0.15 : écran
 *                        « Faire réaliser par un artiste », essai non décompté)
 *     'expired'       -> { status, message }   (purge J+30)
 *
 * GET /api/custom-art/jobs/:uuid/preview/:n
 *   Image JPEG (aperçu réduit) du candidat révélé n (0-based, ordre de classement),
 *   proxifiée depuis le storage avec Access-Control-Allow-Origin (texture WebGL).
 *   404 si le candidat n'est pas encore révélé.
 *
 * POST /api/custom-art/jobs/:uuid/reveal-next   (session propriétaire requise)
 *   out : data = { preview, revealed, remainingReveals,
 *                  candidate: { rank, total, hasMore } }        (runner-up instantané)
 *      ou data = { jobId, status: 'pending' }                  (nouvelle génération)
 *   `candidate` = même bloc qu'en 'ready' : `rank` du runner-up servi, `total` des candidats
 *   VALIDÉS, `hasMore:false` => dernier validé (le prochain reveal-next = génération payante).
 *
 * POST /api/custom-art/jobs/:uuid/save  { email }  (session propriétaire requise)
 *   out : data = { sent: boolean, alreadySent?: true }
 *
 * GET /api/custom-art/teams
 *   out : data = [{ id, name, slug, colors, aliases }]
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default class CustomArtController {
  /**
   * POST /api/custom-art/jobs — multipart photo + teamId + playerName + playerNumber
   * + format + frame. Crée la session si besoin (cookie/token) et applique les caps.
   */
  public async create(ctx: HttpContextContract) {
    const { request, response } = ctx
    try {
      // Honeypot : champ caché jamais rempli par un humain
      if (request.input('website')) {
        return response.badRequest({ success: false, message: 'Requête invalide.' })
      }

      // 1) Champs texte
      const payload = await request.validate(CustomArtJobValidator)

      const team = await CustomArtTeam.query()
        .where('id', payload.teamId)
        .where('active', true)
        .first()
      if (!team) {
        return response.status(422).json({ success: false, message: 'Équipe inconnue.' })
      }

      // 1bis) Format/finition : variantId = SOURCE DE VÉRITÉ (contrat front, revue J1).
      // La correspondance est dérivée des options de la variante Shopify ; les champs
      // explicites format/frame restent acceptés en secours si la résolution échoue.
      let format = payload.format ?? null
      let frame = payload.frame ?? null
      if (payload.variantId) {
        const mapped = await CustomArtVariantMapping.resolve(payload.variantId)
        if (mapped) {
          format = mapped.format
          frame = mapped.frame
        }
      }
      if (!format || !frame) {
        return response.status(422).json({
          success: false,
          message: payload.variantId
            ? 'Variante inconnue : impossible de déterminer le format et la finition.'
            : 'Choisis un format et une finition (variantId, ou format + frame).',
        })
      }

      // 2) Photo multipart
      const photo = request.file('photo', { size: PHOTO_MAX_SIZE, extnames: PHOTO_EXTNAMES })
      if (!photo) {
        return response.status(422).json({ success: false, message: 'La photo est requise.' })
      }
      if (!photo.isValid) {
        return response.status(422).json({
          success: false,
          message:
            'Photo refusée : formats acceptés JPG, PNG, WEBP ou HEIC, taille maximale 12 Mo.',
        })
      }

      const raw = await fs.readFile(photo.tmpPath!)

      // 3) Vérification + normalisation sharp (min 512 px, EXIF appliqué, JPEG 2048 max)
      let normalized: Buffer
      try {
        const meta = await sharp(raw).metadata()
        const minSide = Math.min(meta.width || 0, meta.height || 0)
        if (minSide < PHOTO_MIN_PX) {
          return response.status(422).json({
            success: false,
            message: `Photo trop petite : il nous faut au moins ${PHOTO_MIN_PX} px de côté.`,
          })
        }
        normalized = await sharp(raw)
          .rotate() // applique l'orientation EXIF (et supprime les métadonnées)
          .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer()
      } catch {
        // Typiquement un HEIC (HEVC) non décodable par sharp sur ce serveur
        return response.status(422).json({
          success: false,
          message: 'Impossible de lire cette photo sur nos serveurs. Envoie-la en JPG ou PNG.',
        })
      }

      // 4) Session + caps anti-abus
      const session = await this.resolveSession(ctx)

      // E-mail joint par le front (cap « 3e essai+ = e-mail requis ») : associé à la
      // session AVANT le contrôle des caps, sinon l'essai resterait bloqué en 429.
      // Même politique que save() : le premier e-mail posé ne s'écrase jamais.
      // On ne dépend plus du retour (premier e-mail = moment du déblocage) : plus aucun
      // e-mail « reprends ta génération » n'est envoyé sur ce déblocage (décision Walid
      // 2026-06-25 — la génération a déjà repris dans CETTE requête, le mail était
      // incohérent). Le lien de reprise volontaire reste SaveMailer via POST /jobs/:uuid/save.
      await this.attachEmailIfMissing(session, payload.email)

      const capError = await this.checkCaps(session)
      if (capError) {
        return response.status(429).json(capError)
      }

      // 5) Photo stockée en PRIVÉ (jamais d'URL publique sur les sources, RGPD)
      const uuid = randomUUID()
      const photoPath = `custom-art/jobs/${uuid}/source.jpg`
      await CustomArtStorage.put(photoPath, normalized, { isPublic: false })

      // productType : segmente l'estimation glissante (bucket 'default' si absent). Stocké
      // sur le job pour que GET /jobs/:uuid (polling) recale sur le même bucket.
      const productType = normalizeProductType(payload.productType)

      // 6) Job pending — le worker le prend en charge ; surtout PAS de await sur la
      // génération ici (Cloudflare coupe à ~100s)
      await CustomArtJob.create({
        uuid,
        sessionId: session.id,
        status: 'pending',
        photoPath,
        teamId: team.id,
        playerName: payload.playerName,
        playerNumber: payload.playerNumber,
        format,
        frame,
        productType,
        revealedCount: 0,
        round: 1,
      })

      session.essaisCount = session.essaisCount + 1
      await session.save()

      // Estimation globale (tous utilisateurs) de la durée de génération pour ce
      // productType : le studio cale sa barre de progression dessus. Best-effort —
      // ne fait jamais échouer la création (cf. JobEstimate).
      const estimatedMs = await JobEstimate.forProductType(productType)

      Logger.info('custom-art job START uuid=%s team=%s format=%s', uuid, team.slug, format)
      return { success: true, data: { jobId: uuid, token: session.sessionToken, estimatedMs } }
    } catch (error) {
      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      Logger.error('custom-art create: %s', error?.message || error)
      return response.status(500).json({
        success: false,
        message: 'Impossible de démarrer la création. Réessaie dans un instant.',
      })
    }
  }

  /**
   * POST /api/custom-art/photo-check — multipart photo + faceAngle (+ hash, productType).
   *
   * Valide la photo du visiteur AVANT toute génération (coût quasi nul, cf. App/Services/
   * CustomArt/PhotoCheck) et renvoie un verdict actionnable. Contrat front : HTTP 200 +
   * { ok, issues[], faceAngleDetected, cached } pour tous les cas NORMAUX (y compris ok:false).
   * `faceAngleDetected` (angle DÉTECTÉ : 'front'|'three-quarter'|'profile'|'back'|'none') est
   * TOUJOURS présent — le studio le compare au cran demandé pour le badge 🟢/🟡. N'EXIGE PAS de
   * session (ce check précède le POST /jobs, donc souvent sans
   * token) — rate-limité par IP. En cas d'erreur réelle (5xx) le front fait fail-open : la
   * panne de cet endpoint ne bloque jamais la vente (le pré-check de POST /jobs reste le filet).
   */
  public async photoCheck(ctx: HttpContextContract) {
    const { request, response } = ctx
    try {
      const payload = await request.validate(CustomArtPhotoCheckValidator)

      const photo = request.file('photo', {
        size: PHOTO_CHECK_MAX_SIZE,
        extnames: PHOTO_CHECK_EXTNAMES,
      })
      if (!photo || !photo.isValid || !photo.tmpPath) {
        // Contrat front violé (photo absente / trop lourde / format refusé) : 422 → le front
        // fail-open. On ne bloque jamais la vente sur un souci d'intégration.
        return response.status(422).json({
          success: false,
          message: 'Photo manquante ou invalide (JPG/PNG/HEIC, 5 Mo max).',
        })
      }

      const buffer = await fs.readFile(photo.tmpPath)
      // faceAngle arrive verbatim du studio : normalisé ici (underscore→tiret, casse) vers
      // l'enum canonique. Un cran inconnu => null => le juge ignore la contrainte d'angle
      // (jamais de fallback silencieux sur 'front' qui recalerait à tort une photo 3/4).
      const verdict = await new PhotoCheck().check({
        photo: buffer,
        faceAngle: normalizeFaceAngle(payload.faceAngle),
        hash: payload.hash ?? null,
        productType: payload.productType ?? null,
      })

      // RGPD : la photo n'est jamais stockée ; le fichier tmp multipart est purgé par Adonis.
      return { success: true, data: verdict }
    } catch (error) {
      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      // Erreur réelle (LLM indisponible, etc.) : 503 → le front fail-open (laisse passer, le
      // pré-check de POST /jobs reste le filet). On ne met JAMAIS un faux verdict en cache.
      Logger.error('custom-art photo-check: %s', error?.message || error)
      return response.status(503).json({ success: false, message: 'Vérification indisponible.' })
    }
  }

  /**
   * GET /api/custom-art/jobs/:uuid — polling (2 s côté front).
   * data.status + progression + (ready) preview proxifiée + mockups au fil de l'eau.
   */
  public async show({ params, response }: HttpContextContract) {
    response.header('Cache-Control', 'no-store') // sinon Cloudflare figerait un état "pending"

    const job = await this.findJob(params.uuid)
    if (!job) {
      return response
        .status(404)
        .json({ success: false, code: 'not_found', message: 'Création introuvable.' })
    }

    if (job.status === 'failed') {
      return {
        success: true,
        data: {
          status: 'failed',
          message: job.error || 'La génération a échoué. Réessaie.',
        },
      }
    }
    if (job.status === 'manual_review') {
      // Fallback artiste (décision §0.15) : écran « Faire réaliser par un artiste »
      return {
        success: true,
        data: { status: 'manual_review', message: MANUAL_REVIEW_MESSAGE },
      }
    }
    if (job.status === 'expired') {
      return {
        success: true,
        data: {
          status: 'expired',
          message: 'Cette création a expiré (30 jours). Relance une création.',
        },
      }
    }

    if (job.status !== 'ready') {
      return {
        success: true,
        data: {
          status: 'processing',
          step: job.status,
          progress: this.progressFor(job),
          // Même estimation globale que le POST /jobs : permet au studio de recaler la
          // barre si le visiteur recharge en cours de génération (bucket du job).
          estimatedMs: await JobEstimate.forProductType(job.productType),
        },
      }
    }

    const candidates = job.candidates || []
    const chosen = job.chosenIndex !== null ? candidates[job.chosenIndex] : null
    return {
      success: true,
      data: {
        status: 'ready',
        progress: 100,
        // URL proxifiée backend (en-tête ACAO) : exigée par le visualiseur WebGL du thème
        preview: chosen ? this.previewUrl(job, chosen) : null,
        revealed: job.revealedCount,
        // Runner-ups VALIDÉS déjà jugés, révélables instantanément via reveal-next
        remainingReveals: Math.max(0, this.revealableCount(job) - job.revealedCount),
        // Navigateur de versions (compteur « rank/total » du studio) — cf. candidateMeta()
        candidate: this.candidateMeta(job, chosen),
        playerName: job.playerName,
        playerNumber: job.playerNumber,
        teamId: job.teamId,
        format: job.format,
        frame: job.frame,
        mockups: (job.mockups || []).map((m) => ({ psd: m.psd, status: m.status, url: m.url })),
      },
    }
  }

  /**
   * GET /api/custom-art/jobs/last — Reprise « mon dernier job » (A2 du studio).
   *
   * Renvoie le dernier job EXPLOITABLE de la session courante, pour ré-afficher le reveal
   * (ou l'écran artiste) quand le visiteur revient SANS lien ?ca_job ni reveal local
   * (cache vidé, reveal local périmé > 3 j) mais que le back-end connaît encore sa session.
   *
   * LECTURE SEULE, aucun effet de bord :
   *  - résout via callerSession (cookie / header) — JAMAIS resolveSession (qui minterait une
   *    session + poserait un cookie) ;
   *  - n'appelle JAMAIS checkCaps : aucun décompte d'essai, aucun cap ;
   *  - session inconnue ou rien à reprendre => 204 (JAMAIS 401/403/429 : le thème lit tout
   *    403 comme le cap « e-mail requis » -> on recréerait le paradoxe qu'on corrige).
   *
   * Statuts renvoyés (le plus récent parmi les statuts reprenables) :
   *  - ready                  => le front ré-affiche le reveal (session valide => actions actives) ;
   *  - manual_review / failed => écran artiste « déjà pris en charge » ;
   *  - pending/generating/judging/expired => exclus (=> 204) : pas de polling cross-session,
   *    et un job purgé n'est plus productible.
   */
  public async last(ctx: HttpContextContract) {
    const { response } = ctx
    // Réponse propre à la session : jamais mise en cache (CDN / navigateur)
    response.header('Cache-Control', 'private, no-store')

    const session = await this.callerSession(ctx)
    if (!session) return response.noContent() // 204 — aucune session connue

    // Dernier job reprenable. On borne aux statuts exploitables : ainsi un reveal-next ayant
    // créé un nouveau 'pending' derrière ne masque pas le 'ready' encore utile.
    const job = await CustomArtJob.query()
      .where('session_id', session.id)
      .whereIn('status', ['ready', 'manual_review', 'failed'])
      .orderBy('id', 'desc') // récence ; couvert par l'index (session_id, created_at)
      .first()
    if (!job) return response.noContent() // 204 — rien à reprendre

    const createdAt = job.createdAt ? job.createdAt.toISO() : null
    // Plancher de purge si non commandé (J+30, cf. PurgeCustomArt.UNPURCHASED_RETENTION_DAYS).
    const expiresAt = job.createdAt ? job.createdAt.plus({ days: 30 }).toISO() : null

    if (job.status === 'failed') {
      return {
        success: true,
        data: {
          uuid: job.uuid,
          status: 'failed',
          message: job.error || 'La génération a échoué. Réessaie.',
          createdAt,
          expiresAt,
        },
      }
    }
    if (job.status === 'manual_review') {
      return {
        success: true,
        data: {
          uuid: job.uuid,
          status: 'manual_review',
          message: MANUAL_REVIEW_MESSAGE,
          createdAt,
          expiresAt,
        },
      }
    }

    // status === 'ready'
    const candidates = job.candidates || []
    const chosen = job.chosenIndex !== null ? candidates[job.chosenIndex] : null
    const preview = chosen ? this.previewUrl(job, chosen) : null
    if (!preview) return response.noContent() // ready sans aperçu affichable (chosenIndex null) => 204

    // teamName lisible pour l'affichage panier (relation belongsTo déjà sur le modèle).
    await job.load('team')

    return {
      success: true,
      data: {
        uuid: job.uuid,
        status: 'ready',
        progress: 100,
        // URL proxifiée backend (en-tête ACAO) : même helper que show(), texture WebGL OK
        preview,
        revealed: job.revealedCount,
        // Runner-ups VALIDÉS déjà jugés, révélables instantanément via reveal-next (session valide)
        remainingReveals: Math.max(0, this.revealableCount(job) - job.revealedCount),
        // Navigateur de versions : le studio rétablit le compteur « rank/total » à la reprise
        candidate: this.candidateMeta(job, chosen),
        playerName: job.playerName,
        playerNumber: job.playerNumber,
        teamId: job.teamId,
        teamName: job.team ? job.team.name : null,
        format: job.format,
        frame: job.frame,
        // Propre à la session : pré-remplit le formulaire « Sauvegarder » (jamais affiché).
        email: session.email || null,
        createdAt,
        expiresAt,
        mockups: (job.mockups || []).map((m) => ({ psd: m.psd, status: m.status, url: m.url })),
      },
    }
  }

  /**
   * GET /api/custom-art/jobs/:uuid/preview/:n — aperçu réduit du candidat révélé n
   * (0-based, ordre de classement), proxifiée depuis le storage avec l'en-tête
   * Access-Control-Allow-Origin : le visualiseur WebGL du thème charge l'image en
   * texture cross-origin (crossOrigin='anonymous'), ce que le CDN ne permet pas.
   */
  public async preview({ params, response }: HttpContextContract) {
    const job = await this.findJob(params.uuid)
    const n = Number(params.n)
    if (!job || !Number.isInteger(n) || n < 0) {
      return response
        .status(404)
        .json({ success: false, code: 'not_found', message: 'Aperçu introuvable.' })
    }

    // Jamais de fuite des runner-ups non révélés (ni des candidats d'un job non prêt)
    const candidates = job.candidates || []
    const candidate = candidates.find((c) => c.rank === n + 1)
    if (!candidate || n >= job.revealedCount) {
      return response
        .status(404)
        .json({ success: false, code: 'not_found', message: 'Aperçu introuvable.' })
    }

    let buffer: Buffer
    try {
      buffer = await CustomArtStorage.get(candidate.previewPath)
    } catch {
      return response
        .status(404)
        .json({ success: false, code: 'not_found', message: 'Aperçu indisponible.' })
    }

    response.header('Content-Type', 'image/jpeg')
    // CORS image : origin boutique en prod, ouvert en dev (aperçu réduit déjà public)
    response.header('Access-Control-Allow-Origin', Env.get('STOREFRONT_URL') || '*')
    response.header('Vary', 'Origin')
    response.header('Cross-Origin-Resource-Policy', 'cross-origin')
    // Une preview de candidat est immuable : cache navigateur/CDN ok
    response.header('Cache-Control', 'public, max-age=86400')
    return response.send(buffer)
  }

  /**
   * POST /api/custom-art/jobs/:uuid/reveal-next — révèle le runner-up suivant déjà jugé
   * (instantané, gratuit). Au-delà : nouvelle génération si caps OK, sinon email requis.
   * Accepte un champ `email` OPTIONNEL : comme POST /jobs, il est attaché à la session
   * AVANT le contrôle des caps — débloque ainsi 'email_required' aussi quand le cap est
   * touché sur ce chemin (clic « nouvelle version »), pas seulement sur POST /jobs.
   */
  public async revealNext(ctx: HttpContextContract) {
    const { params, request, response } = ctx
    response.header('Cache-Control', 'no-store')

    const job = await this.findJob(params.uuid)
    if (!job || job.status !== 'ready') {
      return response.status(404).json({ success: false, message: 'Création introuvable.' })
    }

    // Propriété : seul le détenteur de la session du job peut révéler. Sinon n'importe
    // qui connaissant l'uuid (lien email ca_job, URL de preview partagée) consommerait
    // le quota du propriétaire et déclencherait des générations à ses frais.
    const session = await this.callerSession(ctx)
    if (!session || session.id !== job.sessionId) {
      return response.status(403).json({
        success: false,
        message: 'Cette création appartient à une autre session.',
      })
    }

    const candidates = job.candidates || []
    const ranked = [...candidates].sort((a, b) => a.rank - b.rank)
    // On ne fait parcourir au client QUE les candidats validés par le juge (pass:true).
    // Ils trient EN TÊTE (Worker.rankCandidates) -> ce sont ranked[0..revealable-1] ; au-delà
    // (versions recalées) on ne révèle plus : le prochain clic = génération payante.
    const revealable = this.revealableCount(job)

    // 1) Runner-up VALIDÉ déjà jugé disponible -> révélation instantanée.
    // Verrou optimiste sur revealed_count : deux appels concurrents (double-clic) ne
    // révèlent pas deux fois le même runner-up ; le perdant reçoit 409.
    if (job.revealedCount < revealable) {
      const next = ranked[job.revealedCount]
      const revealed = job.revealedCount + 1
      const updated = affectedRows(
        await Database.from('custom_art_jobs')
          .where('id', job.id)
          .where('revealed_count', job.revealedCount)
          .update({
            revealed_count: revealed,
            chosen_index: candidates.indexOf(next),
            updated_at: new Date(),
          })
      )
      if (updated !== 1) {
        return response
          .status(409)
          .json({ success: false, message: 'Révélation déjà en cours. Réessaie.' })
      }
      return {
        success: true,
        data: {
          // URL proxifiée backend (ACAO) — même contrat que GET /jobs/:uuid
          preview: this.previewUrl(job, next),
          revealed,
          remainingReveals: Math.max(0, revealable - revealed),
          // Même bloc qu'en 'ready' : `next.rank` = rang du runner-up servi, `hasMore:false`
          // au dernier VALIDÉ (le prochain clic = génération payante).
          candidate: this.candidateMeta(job, next),
        },
      }
    }

    // 2) Plus de runner-up : nouvelle génération si les caps le permettent.
    // E-mail éventuellement fourni ICI aussi (déblocage du cap sur le chemin « nouvelle
    // version ») — attaché AVANT checkCaps, exactement comme create(). On ne renvoie plus
    // d'e-mail « reprise » sur ce déblocage : la nouvelle version se lance dans la foulée.
    await this.attachEmailIfMissing(session, request.input('email'))
    const capError = await this.checkCaps(session)
    if (capError) {
      return response.status(429).json(capError)
    }

    // Idempotence : si la session a déjà un job en cours, on le renvoie plutôt que
    // d'en créer (et payer) un deuxième.
    const inflightJob = await CustomArtJob.query()
      .where('session_id', session.id)
      .whereIn('status', ['pending', 'generating', 'judging'])
      .orderBy('id', 'desc')
      .first()
    if (inflightJob) {
      return { success: true, data: { jobId: inflightJob.uuid, status: 'pending' } }
    }

    // Verrou de session (optimiste sur essais_count, incrémenté AVANT la création) :
    // deux appels concurrents ne déclenchent qu'une seule régénération facturée.
    const claimed = affectedRows(
      await Database.from('custom_art_sessions')
        .where('id', session.id)
        .where('essais_count', session.essaisCount)
        .update({ essais_count: session.essaisCount + 1, updated_at: new Date() })
    )
    if (claimed !== 1) {
      return response
        .status(409)
        .json({ success: false, message: 'Une génération est déjà en cours.' })
    }

    // Nouveau job avec les mêmes réglages ; la photo est copiée sous le nouveau uuid
    // (les fichiers d'un job restent autonomes pour la purge J+30)
    const newUuid = randomUUID()
    const newPhotoPath = `custom-art/jobs/${newUuid}/source.jpg`
    const photoBuffer = await CustomArtStorage.get(job.photoPath)
    await CustomArtStorage.put(newPhotoPath, photoBuffer, { isPublic: false })

    await CustomArtJob.create({
      uuid: newUuid,
      sessionId: session.id,
      status: 'pending',
      photoPath: newPhotoPath,
      teamId: job.teamId,
      playerName: job.playerName,
      playerNumber: job.playerNumber,
      format: job.format,
      frame: job.frame,
      revealedCount: 0,
      round: 1,
    })

    Logger.info('custom-art reveal-next -> nouveau job uuid=%s (depuis %s)', newUuid, job.uuid)
    return { success: true, data: { jobId: newUuid, status: 'pending' } }
  }

  /**
   * POST /api/custom-art/jobs/:uuid/save — { email } : associe l'email à la session
   * et envoie le lien de reprise (Resend, pattern EscalationMailer).
   * Anti-relais : propriété de session exigée, email jamais écrasé, cap DB d'envois/jour.
   */
  public async save(ctx: HttpContextContract) {
    const { params, request, response } = ctx
    try {
      const { email } = await request.validate(CustomArtSaveValidator)

      const job = await this.findJob(params.uuid)
      if (!job) {
        return response.status(404).json({ success: false, message: 'Création introuvable.' })
      }

      // Propriété : seul le détenteur de la session du job déclenche l'email. Sans ça,
      // l'endpoint sert de relais d'emails arbitraires depuis le domaine de la marque.
      const session = await this.callerSession(ctx)
      if (!session || session.id !== job.sessionId) {
        return response.status(403).json({
          success: false,
          message: 'Cette création appartient à une autre session.',
        })
      }

      // L'email d'une session ne s'écrase JAMAIS : premier email posé = définitif.
      const normalized = email.toLowerCase()
      if (session.email && session.email !== normalized) {
        return response.status(409).json({
          success: false,
          message: 'Un autre email est déjà associé à cette création.',
        })
      }
      if (!session.email) {
        session.email = normalized
      }
      const targetEmail = session.email || normalized

      // Cap DB d'envois (en plus du throttle HTTP) : SAVE_MAILS_PER_DAY par session/jour,
      // et un seul envoi par job et par jour (re-cliquer ne renvoie pas de mail).
      const today = DateTime.now().toISODate() as string
      const isNewDay = !session.saveSendsDate || session.saveSendsDate.toISODate() !== today
      if (isNewDay) {
        session.saveSendsCount = 0
        session.saveSendsDate = DateTime.now()
      }
      if (!isNewDay && session.lastSaveJobUuid === job.uuid) {
        await session.save()
        return { success: true, data: { sent: false, alreadySent: true } }
      }
      if (session.saveSendsCount >= SAVE_MAILS_PER_DAY) {
        await session.save()
        return response.status(429).json({
          success: false,
          message: "Limite d'envois atteinte pour aujourd'hui. Ta création reste sauvegardée.",
        })
      }
      session.saveSendsCount = session.saveSendsCount + 1
      session.lastSaveJobUuid = job.uuid
      await session.save()

      const candidates = job.candidates || []
      const chosen = job.chosenIndex !== null ? candidates[job.chosenIndex] : null
      const sent = await new SaveMailer().send({
        // Toujours l'email de la session (jamais le payload brut) : pas de relais
        email: targetEmail,
        jobUuid: job.uuid,
        previewUrl: chosen ? CustomArtStorage.publicUrl(chosen.previewPath) : null,
      })

      return { success: true, data: { sent } }
    } catch (error) {
      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      Logger.error('custom-art save: %s', error?.message || error)
      return response.status(500).json({ success: false, message: 'Sauvegarde impossible.' })
    }
  }

  /** GET /api/custom-art/teams — équipes actives (public, cache 1 h). */
  public async teams({ response }: HttpContextContract) {
    response.header('Cache-Control', 'public, max-age=3600')
    const teams = await CustomArtTeam.query().where('active', true).orderBy('name', 'asc')
    return {
      success: true,
      data: teams.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        colors: t.colors,
        aliases: t.aliases,
      })),
    }
  }

  /**
   * GET /admin/custom-art/stats (auth) — squelette : jobs/jour, coûts agrégés,
   * taux de pass. Affiné en M9/M10.
   */
  public async adminStats({ response }: HttpContextContract) {
    response.header('Cache-Control', 'no-store')

    const since = DateTime.now().minus({ days: 6 }).startOf('day')
    const jobs = await CustomArtJob.query().where(
      'created_at',
      '>=',
      since.toSQL({ includeOffset: false }) as string
    )

    const byDay: Record<string, { total: number; ready: number; failed: number; costEur: number }> =
      {}
    for (const job of jobs) {
      const day = job.createdAt.toISODate() as string
      byDay[day] = byDay[day] || { total: 0, ready: 0, failed: 0, costEur: 0 }
      byDay[day].total++
      if (job.status === 'ready') byDay[day].ready++
      if (job.status === 'failed') byDay[day].failed++
      byDay[day].costEur = Math.round((byDay[day].costEur + (job.costs?.totalEur || 0)) * 100) / 100
    }

    const today = DateTime.now().toISODate() as string
    const finished = jobs.filter((j) => j.status === 'ready' || j.status === 'failed')
    const passRate =
      finished.length > 0
        ? Math.round((jobs.filter((j) => j.status === 'ready').length / finished.length) * 100)
        : null

    return {
      success: true,
      data: {
        days: byDay,
        today: byDay[today] || { total: 0, ready: 0, failed: 0, costEur: 0 },
        passRatePct: passRate,
        dailyCostCapEur:
          Number(Env.get('CUSTOM_ART_DAILY_COST_CAP_EUR')) || DEFAULT_DAILY_COST_CAP_EUR,
      },
    }
  }

  // --------------------------------------------------------------------------
  // Helpers privés
  // --------------------------------------------------------------------------

  private async findJob(uuid: string): Promise<CustomArtJob | null> {
    if (!uuid || !UUID_RE.test(uuid)) return null
    return CustomArtJob.findBy('uuid', uuid)
  }

  /**
   * URL de preview d'un candidat, proxifiée par GET /jobs/:uuid/preview/:n
   * (n = rang de classement 0-based). Le proxy pose l'en-tête ACAO requis par le
   * visualiseur WebGL du thème (texture cross-origin) — l'URL CDN brute ne l'a pas.
   */
  private previewUrl(job: CustomArtJob, candidate: CustomArtCandidate): string | null {
    if (!candidate || !candidate.rank || candidate.rank < 1) return null
    return `${Env.get('BACKEND_URL')}/api/custom-art/jobs/${job.uuid}/preview/${candidate.rank - 1}`
  }

  /**
   * Candidats PARCOURABLES par le client = uniquement ceux validés par le juge (`pass:true`).
   * Décision Walid (suivi du contrat candidate) : on ne fait jamais parcourir gratuitement
   * une version recalée par le juge. Les validés trient EN TÊTE (Worker.rankCandidates : pass
   * d'abord), donc ils occupent les rangs 1..N_validés de façon CONTIGUË -> leurs aperçus
   * sont servis en /preview/0..N_validés-1 (sans trou) et l'impression par rang reste
   * cohérente avec le `_version_rank` que le front dérive de l'URL (rank = N+1). Aucun
   * ré-index nécessaire. Toujours >= 1 à l'état ready (le job ne passe ready que si le
   * meilleur candidat passe, ou via un résultat artiste pass:true).
   */
  private revealableCount(job: CustomArtJob): number {
    return (job.candidates || []).filter((c) => c.pass).length
  }

  /**
   * Bloc `candidate` du contrat studio (navigateur de versions « rank/total »). Dérivé,
   * jamais persisté, et RESTREINT aux candidats validés (cf. revealableCount) :
   *  - `total` = nombre de candidats validés du lot (= base de `remainingReveals`) ;
   *  - `rank`  = position 1-based de `served` dans la séquence des validés (best-first) :
   *    = `served.rank` pour un validé (validés contigus en tête) ; un éventuel candidat NON
   *    validé (job legacy révélé au-delà du dernier validé avant ce déploiement) est borné à
   *    `total` (tous les validés le précèdent) ;
   *  - `hasMore` = reste-t-il un validé non encore servi (false = dernier -> le prochain
   *    reveal-next déclenche la génération payante).
   *
   * Stable pour un jobId donné : à `ready`, `job.candidates` est figé (les rounds de
   * rattrapage du worker se jouent AVANT le passage en ready). Épuiser les validés crée un
   * NOUVEAU job (autre `total`), c'est la seule action payante.
   */
  private candidateMeta(
    job: CustomArtJob,
    served: CustomArtCandidate | null
  ): { rank: number; total: number; hasMore: boolean } {
    const candidates = job.candidates || []
    const total = this.revealableCount(job)
    // Position de `served` parmi les validés (rang croissant) : = served.rank pour un validé
    // (validés contigus en tête), = total pour un non-validé (tous les validés le précèdent).
    const rank = served ? candidates.filter((c) => c.pass && c.rank <= served.rank).length : 0
    return { rank, total, hasMore: rank > 0 && rank < total }
  }

  /** Progression indicative pour la barre storytelling du front. */
  private progressFor(job: CustomArtJob): number {
    if (job.status === 'pending') return 8
    if (job.status === 'generating') return job.round > 1 ? 70 : 45
    if (job.status === 'judging') return 85
    return 100
  }

  /**
   * Session du visiteur courant (cookie / header / champ sessionToken), SANS création.
   * Sert aux contrôles de propriété appelant<->job : null si aucun jeton valide.
   */
  private async callerSession({ request }: HttpContextContract): Promise<CustomArtSession | null> {
    const token =
      request.cookie(SESSION_COOKIE) ||
      request.header('x-custom-art-session') ||
      request.input('sessionToken')

    if (!token || typeof token !== 'string' || token.length > 64) return null
    return CustomArtSession.findBy('session_token', token)
  }

  /**
   * Retrouve (cookie / header / champ) ou crée la session studio.
   * Le jeton est aussi renvoyé dans la réponse du POST /jobs : le front peut le
   * stocker en sessionStorage si les cookies tiers sont bloqués.
   */
  private async resolveSession(ctx: HttpContextContract) {
    const existing = await this.callerSession(ctx)
    if (existing) return existing

    const { request, response } = ctx
    const session = await CustomArtSession.create({
      sessionToken: randomUUID(),
      ipHash: this.hashIp(clientIp(request)),
      essaisCount: 0,
    })

    const isProd = Env.get('NODE_ENV') === 'production'
    response.cookie(SESSION_COOKIE, session.sessionToken, {
      maxAge: SESSION_COOKIE_MAX_AGE_SEC,
      httpOnly: true,
      path: '/',
      // cross-origin boutique -> backend : None+Secure requis en prod
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
    })
    return session
  }

  /**
   * Attache l'e-mail fourni à la session SI elle n'en a pas encore (premier e-mail =
   * définitif, même politique que save()). C'est ce qui lève le cap anonyme (2 -> 5
   * essais/jour) au prochain checkCaps, puisque le seuil dépend de `session.email`.
   *
   * Renvoie true UNIQUEMENT au PREMIER e-mail posé sur la session (le moment du
   * « déblocage »). Les appelants ignorent désormais ce retour : aucun e-mail n'est
   * envoyé sur le déblocage (la génération reprend dans la même requête). Conservé pour
   * la sémantique/les logs et un éventuel usage futur.
   *
   * Tolérant : `rawEmail` peut être non validé (reveal-next n'a pas de validator) — on
   * vérifie une forme minimale et on no-op sinon (jamais de throw, jamais d'écrasement).
   */
  private async attachEmailIfMissing(
    session: CustomArtSession,
    rawEmail: unknown
  ): Promise<boolean> {
    if (session.email) return false
    if (!rawEmail || typeof rawEmail !== 'string') return false
    const normalized = rawEmail.trim().toLowerCase()
    if (normalized.length > 191 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) return false
    session.email = normalized
    await session.save()
    Logger.info('custom-art e-mail attaché session=%s (déblocage cap anonyme)', session.id)
    return true
  }

  /** Hash SHA-256 salé (APP_KEY) de l'IP : caps anti-abus sans stocker l'IP en clair. */
  private hashIp(ip: string): string {
    return createHash('sha256')
      .update(`${Env.get('APP_KEY')}:${ip}`)
      .digest('hex')
  }

  /**
   * Caps quotidiens (plan §4). Les jobs `failed` et `manual_review` ne comptent pas
   * (« essai non décompté » — décision §0.15 pour le fallback artiste).
   * Retourne null si OK, sinon le corps de la réponse 429.
   */
  private async checkCaps(session: CustomArtSession): Promise<{
    success: false
    code: string
    message: string
    token: string
    resetsAt: string
  } | null> {
    const sinceSql = DateTime.now().startOf('day').toSQL({ includeOffset: false }) as string
    // Tous les caps « du jour » se réinitialisent au PROCHAIN minuit Europe/Paris (TZ du
    // conteneur, cf. Docker/node/Dockerfile : ENV TZ=Europe/Paris). On expose cet instant en
    // ISO 8601 (offset inclus) pour que le front affiche « reviens demain » / un compte à
    // rebours fiable. `plus({days:1}).startOf('day')` = minuit de demain, robuste au DST.
    const resetsAt = DateTime.now().plus({ days: 1 }).startOf('day').toISO() as string

    // Essais du jour pour la session ET pour l'IP (le plus restrictif gagne)
    const sessionRows = await CustomArtJob.query()
      .where('session_id', session.id)
      .where('created_at', '>=', sinceSql)
      .whereNotIn('status', ['failed', 'manual_review'])
      .count('* as total')
    const sessionCount = Number(sessionRows[0].$extras.total)

    const ipRows = await CustomArtJob.query()
      .join('custom_art_sessions', 'custom_art_sessions.id', 'custom_art_jobs.session_id')
      .where('custom_art_sessions.ip_hash', session.ipHash)
      .where('custom_art_jobs.created_at', '>=', sinceSql)
      .whereNotIn('custom_art_jobs.status', ['failed', 'manual_review'])
      .count('* as total')
    const ipCount = Number(ipRows[0].$extras.total)

    const used = Math.max(sessionCount, ipCount)

    // Observabilité (décision Walid 2026-06-24, Q6) : AUCUNE décision de cap n'était loggée
    // -> impossible de voir dans les logs app pourquoi une relance était refusée. On logge
    // désormais chaque cap (sans PII : `hasEmail` booléen, pas l'adresse).
    if (!session.email && used >= CAP_ANON_PER_DAY) {
      Logger.info(
        'custom-art cap=email_required session=%s used=%s (sess=%s ip=%s) hasEmail=false',
        session.id,
        used,
        sessionCount,
        ipCount
      )
      return {
        success: false,
        code: 'email_required',
        message:
          'Tu as utilisé tes essais découverte du jour. Laisse ton email pour continuer (et garder tes créations).',
        token: session.sessionToken,
        resetsAt,
      }
    }
    if (used >= CAP_EMAIL_PER_DAY) {
      Logger.info(
        'custom-art cap=daily_cap session=%s used=%s (sess=%s ip=%s) hasEmail=%s',
        session.id,
        used,
        sessionCount,
        ipCount,
        Boolean(session.email)
      )
      return {
        success: false,
        code: 'daily_cap',
        message: 'Tu as atteint la limite d’essais du jour. Reviens demain !',
        token: session.sessionToken,
        resetsAt,
      }
    }

    // Cap coût global quotidien (message « forte affluence » côté client).
    // Les coûts réels ne sont écrits qu'en fin de traitement par le worker : les jobs
    // encore pending/generating/judging comptent pour une réserve estimée, sinon un
    // pic de créations dépasserait largement le plafond avant que les coûts n'atterrissent.
    const cap = Number(Env.get('CUSTOM_ART_DAILY_COST_CAP_EUR')) || DEFAULT_DAILY_COST_CAP_EUR
    const todayJobs = await CustomArtJob.query().where('created_at', '>=', sinceSql)
    const todayCost = todayJobs.reduce((sum, j) => {
      const known = j.costs?.totalEur || 0
      const inflight = j.status === 'pending' || j.status === 'generating' || j.status === 'judging'
      return sum + (inflight ? Math.max(known, EST_JOB_COST_EUR) : known)
    }, 0)
    if (todayCost >= cap) {
      Logger.warn('custom-art CAP COÛT atteint: %s€ >= %s€', todayCost.toFixed(2), cap)
      return {
        success: false,
        code: 'high_traffic',
        message:
          'Forte affluence en ce moment : le studio reprend très vite. Réessaie un peu plus tard.',
        token: session.sessionToken,
        resetsAt,
      }
    }

    return null
  }
}
