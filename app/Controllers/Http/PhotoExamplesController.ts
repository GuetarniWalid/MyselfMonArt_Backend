import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import { randomUUID } from 'crypto'
import { schema } from '@ioc:Adonis/Core/Validator'
import * as ResizeJobs from 'App/Services/ArtworkResizer/jobStore'
import type { PhotoExamplesPolicy } from 'App/Services/PhotoExamplesGenerator'

/**
 * Génération IA d'UN exemple photo du studio personnalisé (« bonne photo » OU « photo à
 * éviter » — image par image, validées indépendamment côté UI) à partir de l'ŒUVRE, des
 * règles du juge photo et d'une CONSIGNE courte optionnelle (réécrite en brief par IA).
 * Même patron asynchrone que le décor (job + polling, jamais de 524 Cloudflare). Auth
 * obligatoire (appels Gemini payants) — les fetch same-origin de /publisher/personalized
 * envoient le cookie de session.
 */
export default class PhotoExamplesController {
  private validationSchema = schema.create({
    artwork: schema.string(), // l'œuvre (data URI) — le photo-director en déduit le casting
    kind: schema.enum(['good', 'bad'] as const), // quelle image : bonne ou à éviter
    intent: schema.string.optional(), // consigne courte de Walid (réécrite par l'intent-rewriter)
    policy: schema.object.optional().anyMembers(), // photoPolicy simplifiée (whitelistée ci-dessous)
  })

  /** POST /api/generate-photo-examples — démarre le job, renvoie { jobId } immédiatement. */
  public async generate({ request, response }: HttpContextContract) {
    try {
      const { artwork, kind, intent, policy } = await request.validate({
        schema: this.validationSchema,
      })
      // Whitelist stricte de la policy (données front non fiables) : tout le reste est ignoré.
      const raw: any = policy || {}
      const angle = (v: any) =>
        ['back', 'front', 'three-quarter', 'profile'].includes(v) ? v : undefined
      const clean: PhotoExamplesPolicy = {
        subject:
          raw.subject === 'group' ? 'group' : raw.subject === 'person' ? 'person' : undefined,
        framing:
          raw.framing === 'full-body' ? 'full-body' : raw.framing === 'face' ? 'face' : undefined,
        peopleMin: Number.isInteger(raw.peopleMin)
          ? Math.max(1, Math.min(12, raw.peopleMin))
          : undefined,
        peopleMax: Number.isInteger(raw.peopleMax)
          ? Math.max(1, Math.min(12, raw.peopleMax))
          : undefined,
        perfectAngle: angle(raw.perfectAngle),
        rejectAngles: Array.isArray(raw.rejectAngles)
          ? raw.rejectAngles.map(angle).filter(Boolean).slice(0, 4)
          : undefined,
      }
      const jobId = randomUUID()
      await ResizeJobs.create(jobId)
      // détaché : surtout PAS de await. Consigne bornée (l'intent-rewriter la réécrit).
      ResizeJobs.startPhotoExamples(
        jobId,
        artwork,
        kind,
        clean,
        (intent || '').trim().slice(0, 300) || undefined
      )
      Logger.info('photo-example START job=%s kind=%s intent=%s', jobId, kind, intent ? 'oui' : '—')
      return { success: true, data: { jobId } }
    } catch (error) {
      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      Logger.error('photo-examples START error: %s', error?.message || error)
      return response.status(500).json({
        success: false,
        message: 'Impossible de démarrer la génération des exemples',
        error: error?.message || 'An unexpected error occurred',
      })
    }
  }

  /** GET /api/generate-photo-examples/result?id=<jobId> — état du job (polling). */
  public async result({ request, response }: HttpContextContract) {
    response.header('Cache-Control', 'no-store') // sinon Cloudflare figerait un état "pending"
    const id = request.input('id')
    if (!id) {
      return response.status(400).json({ success: false, status: 'error', message: 'id manquant' })
    }
    const job = await ResizeJobs.read(id)
    if (!job) {
      return response.status(404).json({
        success: false,
        status: 'not_found',
        message: 'Session de génération expirée. Relance.',
      })
    }
    if (job.status === 'done') {
      ResizeJobs.remove(id).catch(() => {})
      return { success: true, status: 'done', data: { image: job.image } }
    }
    if (job.status === 'error') {
      ResizeJobs.remove(id).catch(() => {})
      return {
        success: false,
        status: 'error',
        message: job.error || 'Échec de la génération des exemples.',
      }
    }
    return { success: true, status: 'pending' }
  }
}
