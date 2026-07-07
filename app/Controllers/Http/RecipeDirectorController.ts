import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import { randomUUID } from 'crypto'
import { schema } from '@ioc:Adonis/Core/Validator'
import * as ResizeJobs from 'App/Services/ArtworkResizer/jobStore'
import type { RecipeDirectorStepInfo } from 'App/Services/RecipeDirector'

/**
 * Analyse du DESIGN d'un poster personnalisé : écrit les fragments de prompt de la recette
 * (base / perPerson / replaceTitle / addExtra / removeExtra) depuis l'image, pour que Walid
 * n'ait plus qu'un rôle de relecture dans la carte 4. Même patron asynchrone que le décor
 * (job + polling, jamais de 524 Cloudflare). Auth obligatoire (appel Gemini payant) — les
 * fetch same-origin de /publisher/personalized envoient le cookie de session.
 */
export default class RecipeDirectorController {
  private validationSchema = schema.create({
    artwork: schema.string(), // le design (data URI) — le prompt-director en décrit le style
    steps: schema.array.optional().anyMembers(), // étapes du parcours (whitelistées ci-dessous)
  })

  /** POST /api/analyze-design — démarre le job, renvoie { jobId } immédiatement. */
  public async generate({ request, response }: HttpContextContract) {
    try {
      const { artwork, steps } = await request.validate({ schema: this.validationSchema })
      // Whitelist stricte des étapes (données front non fiables) : 3 chaînes bornées par étape.
      const clean: RecipeDirectorStepInfo[] = (Array.isArray(steps) ? steps : [])
        .filter((s: any) => s && typeof s === 'object')
        .slice(0, 12)
        .map((s: any) => ({
          payloadKey: String(s.payloadKey || '').slice(0, 60),
          type: String(s.type || '').slice(0, 20),
          titleFr: String(s.titleFr || '').slice(0, 120),
        }))
        .filter((s) => s.payloadKey)
      const jobId = randomUUID()
      await ResizeJobs.create(jobId)
      ResizeJobs.startRecipeDirector(jobId, artwork, clean) // détaché : surtout PAS de await
      Logger.info('recipe-director START job=%s steps=%s', jobId, clean.length)
      return { success: true, data: { jobId } }
    } catch (error) {
      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }
      Logger.error('recipe-director START error: %s', error?.message || error)
      return response.status(500).json({
        success: false,
        message: "Impossible de démarrer l'analyse du design",
        error: error?.message || 'An unexpected error occurred',
      })
    }
  }

  /** GET /api/analyze-design/result?id=<jobId> — état du job (polling). */
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
        message: "Session d'analyse expirée. Relance.",
      })
    }
    if (job.status === 'done') {
      ResizeJobs.remove(id).catch(() => {})
      return { success: true, status: 'done', data: { prompts: job.prompts } }
    }
    if (job.status === 'error') {
      ResizeJobs.remove(id).catch(() => {})
      return {
        success: false,
        status: 'error',
        message: job.error || "Échec de l'analyse du design.",
      }
    }
    return { success: true, status: 'pending' }
  }
}
