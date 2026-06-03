import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import { randomUUID } from 'crypto'
import GenerateDecorRequestValidator from 'App/Validators/GenerateDecorRequestValidator'
import * as ResizeJobs from 'App/Services/ArtworkResizer/jobStore'

export default class DecorController {
  /**
   * POST /api/generate-decor
   * Démarre la génération d'un décor (gpt-image-2) et renvoie un jobId IMMÉDIATEMENT.
   * Asynchrone (job + polling) comme le resize : gpt-image-2 dépasse les ~100s que Cloudflare tolère.
   */
  public async generate({ request, response }: HttpContextContract) {
    try {
      const { image, target, product, roomType, theme } = await request.validate(
        GenerateDecorRequestValidator
      )
      const jobId = randomUUID()
      await ResizeJobs.create(jobId)
      ResizeJobs.startDecor(jobId, image, target, { product, roomType, theme }) // détaché : surtout PAS de await
      Logger.info('decor START job=%s target=%s product=%s', jobId, target, product || 'canvas')
      return { success: true, data: { jobId } }
    } catch (error) {
      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      Logger.error('decor START error: %s', error?.message || error)
      return response.status(500).json({
        success: false,
        message: 'Impossible de démarrer la génération du décor',
        error: error?.message || 'An unexpected error occurred',
      })
    }
  }

  /**
   * GET /api/generate-decor/result?id=<jobId>
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
      return response
        .status(404)
        .json({
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
        message: job.error || 'Échec de la génération du décor.',
      }
    }
    return { success: true, status: 'pending' }
  }
}
