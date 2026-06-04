import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import { randomUUID } from 'crypto'
import InsertArtworkRequestValidator from 'App/Validators/InsertArtworkRequestValidator'
import * as ResizeJobs from 'App/Services/ArtworkResizer/jobStore'

export default class InsertArtworkController {
  /**
   * POST /api/insert-artwork
   * Démarre l'insertion de l'oeuvre dans le décor (Nano Banana) et renvoie un jobId IMMÉDIATEMENT.
   * Asynchrone (job + polling) comme decor/resize : Nano Banana Pro peut dépasser ~100s (Cloudflare 524).
   */
  public async generate({ request, response }: HttpContextContract) {
    try {
      const { decor, artwork, target, product, fidelity } = await request.validate(
        InsertArtworkRequestValidator
      )
      const jobId = randomUUID()
      await ResizeJobs.create(jobId)
      ResizeJobs.startInsert(jobId, decor, artwork, target, { product, fidelity }) // détaché : surtout PAS de await
      Logger.info(
        'insert START job=%s target=%s fidelity=%s',
        jobId,
        target,
        fidelity || 'standard'
      )
      return { success: true, data: { jobId } }
    } catch (error) {
      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      Logger.error('insert START error: %s', error?.message || error)
      return response.status(500).json({
        success: false,
        message: "Impossible de démarrer l'insertion",
        error: error?.message || 'An unexpected error occurred',
      })
    }
  }

  /**
   * GET /api/insert-artwork/result?id=<jobId>
   * État du job (instantané -> jamais de 524). Consommé sur done/error.
   */
  public async result({ request, response }: HttpContextContract) {
    response.header('Cache-Control', 'no-store') // sinon Cloudflare figerait un état "pending"
    const id = request.input('id')
    if (!id) {
      return response.status(400).json({ success: false, status: 'error', message: 'id manquant' })
    }
    const job = await ResizeJobs.read(id)
    if (!job) {
      return response
        .status(404)
        .json({ success: false, status: 'not_found', message: 'Session expirée. Relance.' })
    }
    if (job.status === 'done') {
      ResizeJobs.remove(id).catch(() => {})
      return { success: true, status: 'done', data: { image: job.image } }
    }
    if (job.status === 'error') {
      ResizeJobs.remove(id).catch(() => {})
      return { success: false, status: 'error', message: job.error || "Échec de l'insertion." }
    }
    return { success: true, status: 'pending' }
  }
}
