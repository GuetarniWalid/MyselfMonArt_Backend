import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import { randomUUID } from 'crypto'
import CleanMockupRequestValidator from 'App/Validators/CleanMockupRequestValidator'
import * as ResizeJobs from 'App/Services/ArtworkResizer/jobStore'

export default class CleanMockupController {
  /**
   * POST /api/clean-mockup
   * Démarre le nettoyage d'une photo de mockup importée (Nano Banana 2) et renvoie un jobId
   * IMMÉDIATEMENT. Asynchrone (job + polling) comme le décor : jamais de 524 Cloudflare.
   */
  public async generate({ request, response }: HttpContextContract) {
    try {
      const { image, target, product } = await request.validate(CleanMockupRequestValidator)
      const jobId = randomUUID()
      await ResizeJobs.create(jobId)
      ResizeJobs.startClean(jobId, image, target, { product }) // détaché : surtout PAS de await
      Logger.info('clean START job=%s target=%s product=%s', jobId, target, product || 'canvas')
      return { success: true, data: { jobId } }
    } catch (error) {
      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      Logger.error('clean START error: %s', error?.message || error)
      return response.status(500).json({
        success: false,
        message: 'Impossible de démarrer le nettoyage du mockup',
        error: error?.message || 'An unexpected error occurred',
      })
    }
  }

  /**
   * GET /api/clean-mockup/result?id=<jobId>
   * État du job (instantané -> jamais de 524). Consommé (supprimé) sur done/error.
   */
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
        message: 'Session de nettoyage expirée. Relance.',
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
        message: job.error || 'Échec du nettoyage du mockup.',
      }
    }
    return { success: true, status: 'pending' }
  }
}
