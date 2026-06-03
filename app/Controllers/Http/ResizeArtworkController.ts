import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import { randomUUID } from 'crypto'
import ResizeArtworkRequestValidator from 'App/Validators/ResizeArtworkRequestValidator'
import * as ResizeJobs from 'App/Services/ArtworkResizer/jobStore'

export default class ResizeArtworkController {
  /**
   * POST /api/resize-artwork
   * Démarre un job de redimensionnement et renvoie un jobId IMMÉDIATEMENT.
   * Le travail (gpt-image-2, ~120-180s en high) tourne en arrière-plan : on ne
   * peut pas répondre de façon synchrone car Cloudflare coupe à ~100s (-> 524).
   */
  public async resize({ request, response }: HttpContextContract) {
    try {
      const { image, target, quality, mode } = await request.validate(ResizeArtworkRequestValidator)
      const jobId = randomUUID()
      await ResizeJobs.create(jobId)
      // détaché : surtout PAS de await. mode 'enhance' = re-rendu fidèle de l'aperçu LOW validé.
      ResizeJobs.start(jobId, image, target, quality || 'low', mode || 'recompose')
      Logger.info(
        'resize START job=%s target=%s q=%s mode=%s',
        jobId,
        target,
        quality || 'low',
        mode || 'recompose'
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
      Logger.error('resize START error: %s', error?.message || error)
      return response.status(500).json({
        success: false,
        message: 'Impossible de démarrer le redimensionnement',
        error: error?.message || 'An unexpected error occurred',
      })
    }
  }

  /**
   * GET /api/resize-artwork/result?id=<jobId>
   * Renvoie l'état du job (instantané -> jamais de 524). Le front interroge en boucle.
   * Sur 'done'/'error', le job est consommé (supprimé) après lecture.
   */
  public async result({ request, response }: HttpContextContract) {
    // jamais de cache (Cloudflare/navigateur) : sinon un état "pending" mis en cache bloquerait le polling
    response.header('Cache-Control', 'no-store')
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
        message: job.error || 'Échec du redimensionnement.',
      }
    }
    return { success: true, status: 'pending' }
  }
}
