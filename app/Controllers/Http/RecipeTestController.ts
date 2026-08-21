import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import { randomUUID } from 'crypto'
import { schema } from '@ioc:Adonis/Core/Validator'
import * as ResizeJobs from 'App/Services/ArtworkResizer/jobStore'

/**
 * « Tester le prompt » du Publisher : une génération d'essai + le verdict du juge, AVANT publication.
 *
 * Jusqu'ici il fallait publier un produit puis commander dans le studio pour savoir ce qu'un design
 * allait rendre : chaque réglage de prompt coûtait une publication. Le test emprunte le MÊME chemin
 * que la production (cf. RecipeTester) — sinon il mentirait là où on a besoin de vérité.
 *
 * Patron asynchrone des autres appels longs du Publisher (job + polling, jamais de 524 Cloudflare).
 * Auth obligatoire : génération ET jugement sont payants.
 */
export default class RecipeTestController {
  private validationSchema = schema.create({
    artwork: schema.string(), // le design (data URI) — référence de style
    photo: schema.string(), // photo « cliente » (data URI)
    studioConfig: schema.object().anyMembers(),
    studioRecipe: schema.object().anyMembers(),
    // Valeurs des champs texte, par payloadKey. Whitelistées ci-dessous.
    values: schema.object.optional().anyMembers(),
  })

  /** POST /api/test-recipe — démarre le job, renvoie { jobId } immédiatement. */
  public async generate({ request, response }: HttpContextContract) {
    try {
      const { artwork, photo, studioConfig, studioRecipe, values } = await request.validate({
        schema: this.validationSchema,
      })
      // Données front non fiables : 12 champs, clés et valeurs bornées.
      const cleanValues: Record<string, string> = {}
      for (const [k, v] of Object.entries((values as any) || {}).slice(0, 12)) {
        const key = String(k).slice(0, 60)
        if (key) cleanValues[key] = String(v ?? '').slice(0, 200)
      }

      const jobId = randomUUID()
      await ResizeJobs.create(jobId)
      // détaché : surtout PAS de await
      ResizeJobs.startRecipeTest(jobId, {
        artwork,
        photo,
        studioConfig,
        studioRecipe,
        values: cleanValues,
      })
      Logger.info('recipe-test START job=%s champs=%s', jobId, Object.keys(cleanValues).length)
      return { success: true, data: { jobId } }
    } catch (error) {
      if (error.code === 'E_VALIDATION_FAILURE') {
        return response
          .status(422)
          .json({ success: false, message: 'Validation failed', errors: error.messages })
      }
      Logger.error('recipe-test START error: %s', error?.message || error)
      return response.status(500).json({
        success: false,
        message: 'Impossible de démarrer le test',
        error: error?.message || 'An unexpected error occurred',
      })
    }
  }

  /** GET /api/test-recipe/result?id=<jobId> — état du job (polling). */
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
        .json({ success: false, status: 'not_found', message: 'Session de test expirée. Relance.' })
    }
    if (job.status === 'done') {
      ResizeJobs.remove(id).catch(() => {})
      return { success: true, status: 'done', data: job.test }
    }
    if (job.status === 'error') {
      ResizeJobs.remove(id).catch(() => {})
      return { success: false, status: 'error', message: job.error || 'Échec du test.' }
    }
    return { success: true, status: 'pending' }
  }
}
