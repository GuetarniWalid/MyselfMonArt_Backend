import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import { promises as fs } from 'fs'
import sharp from 'sharp'
import CustomArtJob from 'App/Models/CustomArtJob'
import CustomArtTeam from 'App/Models/CustomArtTeam'
import CustomArtStorage from 'App/Services/CustomArt/Storage'
import MockupRenderer from 'App/Services/CustomArt/MockupRenderer'
import WatermarkService from 'App/Services/CustomArt/WatermarkService'
import CustomArtWorker from 'App/Services/CustomArt/Worker'
import { resolveProviderChain, resolveForcedProvider } from 'App/Services/CustomArt/providers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Contraintes du résultat attaché manuellement (fichier final, sera upscalé pour le print)
const RESULT_EXTNAMES = ['jpg', 'jpeg', 'png', 'webp']
const RESULT_MAX_SIZE = '25mb'

/**
 * File admin du fallback artiste (décision grill §0.15) — routes /admin/custom-art/review
 * (auth, pattern publisher). Liste les jobs `manual_review` (photo refusée IMAGE_SAFETY ou
 * 2 rounds sans pass) avec photo source, équipe, prénom/numéro, et permet :
 *   - « relancer avec <provider> » : le job repart en pending avec un maillon imposé ;
 *   - attacher manuellement une image résultat : le job repasse en ready avec ce rendu.
 */
export default class CustomArtReviewAdminController {
  /** GET /admin/custom-art/review — jobs en attente de revue + providers disponibles. */
  public async index({ response }: HttpContextContract) {
    response.header('Cache-Control', 'no-store')

    const jobs = await CustomArtJob.query()
      .where('status', 'manual_review')
      .orderBy('created_at', 'asc')

    const teamIds = [...new Set(jobs.map((j) => j.teamId))]
    const teams = teamIds.length > 0 ? await CustomArtTeam.query().whereIn('id', teamIds) : []
    const teamById = new Map(teams.map((t) => [t.id, t]))

    return {
      success: true,
      data: {
        jobs: jobs.map((job) => ({
          uuid: job.uuid,
          playerName: job.playerName,
          playerNumber: job.playerNumber,
          format: job.format,
          frame: job.frame,
          team: teamById.get(job.teamId)?.name || `équipe #${job.teamId}`,
          reason: job.error || null,
          round: job.round,
          createdAt: job.createdAt?.toISO() || null,
          // Photo source servie par la route admin dédiée (clé storage PRIVÉE)
          photoUrl: `/admin/custom-art/review/${job.uuid}/photo`,
          // Candidats déjà jugés (previews watermarkées publiques) : aident à décider
          candidates: (job.candidates || []).map((c) => ({
            previewUrl: CustomArtStorage.publicUrl(c.previewPath),
            provider: c.provider,
            score: c.score,
            pass: c.pass,
            suspicion: c.suspicion ?? 0,
            reason: c.verdicts?.reason || null,
          })),
        })),
        // Maillons relançables (« relancer avec X ») : la chaîne configurée
        providers: resolveProviderChain().map((p) => p.key),
      },
    }
  }

  /** GET /admin/custom-art/review/:uuid/photo — photo source (privée), admin uniquement. */
  public async photo({ params, response }: HttpContextContract) {
    const job = await this.findJob(params.uuid)
    if (!job) {
      return response.status(404).json({ success: false, message: 'Job introuvable.' })
    }
    try {
      const buffer = await CustomArtStorage.get(job.photoPath)
      response.header('Content-Type', 'image/jpeg')
      response.header('Cache-Control', 'no-store')
      return response.send(buffer)
    } catch {
      return response.status(404).json({ success: false, message: 'Photo indisponible.' })
    }
  }

  /**
   * POST /admin/custom-art/review/:uuid/retry — { provider } : relance le job avec un
   * maillon imposé (ex 'gemini:gemini-3-pro-image'). Le job repart en pending, le worker
   * le reprend avec ce seul provider ; nouvel échec -> retour en manual_review + email.
   */
  public async retry({ params, request, response }: HttpContextContract) {
    const job = await this.findJob(params.uuid)
    if (!job) {
      return response.status(404).json({ success: false, message: 'Job introuvable.' })
    }
    if (job.status !== 'manual_review') {
      return response.status(409).json({
        success: false,
        message: `Ce job n'est pas en revue (statut actuel : ${job.status}).`,
      })
    }

    const providerKey = String(request.input('provider') || '').trim()
    if (!providerKey || !resolveForcedProvider(providerKey)) {
      return response.status(422).json({
        success: false,
        message: `Provider inconnu ou non configuré : "${providerKey}".`,
      })
    }

    job.forcedProvider = providerKey
    job.status = 'pending'
    job.round = 1
    job.error = null
    await job.save()

    Logger.info('custom-art review RETRY uuid=%s provider=%s', job.uuid, providerKey)
    return { success: true, data: { uuid: job.uuid, status: 'pending', provider: providerKey } }
  }

  /**
   * POST /admin/custom-art/review/:uuid/result — multipart `image` : attache manuellement
   * le rendu réalisé par l'artiste. HD stockée privée + preview watermarkée publique,
   * le job repasse en ready avec ce résultat (les anciens candidats restent archivés
   * mais ne sont plus révélables).
   */
  public async uploadResult({ params, request, response }: HttpContextContract) {
    const job = await this.findJob(params.uuid)
    if (!job) {
      return response.status(404).json({ success: false, message: 'Job introuvable.' })
    }
    if (job.status !== 'manual_review') {
      return response.status(409).json({
        success: false,
        message: `Ce job n'est pas en revue (statut actuel : ${job.status}).`,
      })
    }

    const file = request.file('image', { size: RESULT_MAX_SIZE, extnames: RESULT_EXTNAMES })
    if (!file || !file.isValid) {
      return response.status(422).json({
        success: false,
        message: 'Image requise (champ "image") : JPG, PNG ou WEBP, 25 Mo max.',
      })
    }

    let hd: Buffer
    try {
      hd = await sharp(await fs.readFile(file.tmpPath!))
        .rotate() // applique l'orientation EXIF
        .jpeg({ quality: 95, progressive: true, mozjpeg: true })
        .toBuffer()
    } catch {
      return response.status(422).json({
        success: false,
        message: "Impossible de lire l'image. Envoie un JPG ou PNG.",
      })
    }

    const candidates = job.candidates || []
    const index = candidates.length
    const path = `custom-art/jobs/${job.uuid}/candidate-${index}.jpg`
    const previewPath = `custom-art/jobs/${job.uuid}/preview-${index}.jpg`
    await CustomArtStorage.put(path, hd, { isPublic: false })
    const preview = await WatermarkService.makePreview(hd)
    await CustomArtStorage.put(previewPath, preview, { isPublic: true })

    const artist = {
      path,
      previewPath,
      provider: 'artiste',
      model: 'revue-manuelle',
      latencyMs: 0,
      estCostEur: 0,
      score: 10,
      pass: true,
      suspicion: 0,
      verdicts: { manualReview: true, reason: 'Résultat attaché manuellement (file admin)' },
      rank: 0,
    }
    job.candidates = [...candidates, artist]

    // Re-classement : le résultat artiste (pass, score 10, suspicion 0) prend le rang 1
    CustomArtWorker.rankCandidates(job.candidates)
    job.chosenIndex = job.candidates.indexOf(artist)
    // Tous les anciens candidats sont « consommés » : reveal-next repartira sur une
    // nouvelle génération plutôt que de révéler un candidat refusé au client
    job.revealedCount = job.candidates.length
    job.provider = 'artiste'
    job.status = 'ready'
    job.error = null
    job.forcedProvider = null
    await job.save()

    Logger.info('custom-art review RESULT uuid=%s (candidat artiste #%s)', job.uuid, index)

    // Le job vient de passer ready : mises en situation Photopea en tâche de fond
    // (M7, plan §8) — fire-and-forget, renderForJob ne throw jamais (backlog interne).
    void MockupRenderer.renderForJob(job)

    return { success: true, data: { uuid: job.uuid, status: 'ready' } }
  }

  // --------------------------------------------------------------------------
  // Helpers privés
  // --------------------------------------------------------------------------

  private async findJob(uuid: string): Promise<CustomArtJob | null> {
    if (!uuid || !UUID_RE.test(String(uuid))) return null
    return CustomArtJob.findBy('uuid', uuid)
  }
}
