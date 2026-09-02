import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import { promises as fs } from 'fs'
import sharp from 'sharp'
import CustomArtJob from 'App/Models/CustomArtJob'
import CustomArtTeam from 'App/Models/CustomArtTeam'
import CustomArtStorage from 'App/Services/CustomArt/Storage'
import CustomArtOrder from 'App/Models/CustomArtOrder'
import CustomArtSession from 'App/Models/CustomArtSession'
import { purgeJobFiles } from 'App/Services/CustomArt/jobPurge'
import { notifyReadyIfRequested } from 'App/Services/CustomArt/notifyReady'
import MockupRenderer from 'App/Services/CustomArt/MockupRenderer'
import PreviewService from 'App/Services/CustomArt/PreviewService'
import CustomArtWorker from 'App/Services/CustomArt/Worker'
import { resolveProviderChain, resolveForcedProvider } from 'App/Services/CustomArt/providers'
import { describeJob } from 'App/Services/CustomArt/jobLabelling'

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

    // teamId null = job GÉNÉRIQUE (recette produit) — pas d'équipe à charger
    const teamIds = [...new Set(jobs.map((j) => j.teamId))].filter(
      (id): id is number => id !== null
    )
    const teams = teamIds.length > 0 ? await CustomArtTeam.query().whereIn('id', teamIds) : []
    const teamById = new Map(teams.map((t) => [t.id, t]))

    return {
      success: true,
      data: {
        jobs: jobs.map((job) => {
          // Nommage CENTRALISÉ (cf. jobLabelling) : le chemin historique lit les colonnes, le
          // chemin recette lit les entrées validées, et l'artiste voit la même chose des deux
          // côtés. Les replis plus riches de cet écran (équipe supprimée en base, job sans
          // option) restent ici : describeJob ne peut pas les connaître.
          const label = describeJob(job, teamById.get(job.teamId as number)?.name ?? null)
          if (label.incomplete) {
            Logger.warn(
              'custom-art revue: création SANS libellé exploitable uuid=%s (recette mal configurée ?)',
              job.uuid
            )
          }
          return {
            uuid: job.uuid,
            // Générique : libellé du job (titre/tokens) — l'UI garde une colonne unique
            playerName: label.displayName,
            playerNumber: label.number,
            format: job.format,
            frame: job.frame,
            team:
              label.optionName ??
              (job.teamId !== null ? `équipe #${job.teamId}` : job.productType || 'générique'),
            // Entrées sanitizées du chemin générique (tokens/titre) : SANS ça l'artiste ne
            // peut pas réaliser à la main un job famille en manual_review. null côté foot.
            // ⚠️ inputs client uniquement — jamais la recette (prompts).
            inputs: job.inputs
              ? { tokens: job.inputs.tokens, title: job.inputs.title, values: job.inputs.values }
              : null,
            reason: job.error || null,
            round: job.round,
            createdAt: job.createdAt?.toISO() || null,
            // Photo source servie par la route admin dédiée (clé storage PRIVÉE)
            photoUrl: `/admin/custom-art/review/${job.uuid}/photo`,
            // Candidats déjà jugés (aperçus réduits publics) : aident à décider
            candidates: (job.candidates || []).map((c) => ({
              previewUrl: CustomArtStorage.publicUrl(c.previewPath),
              provider: c.provider,
              score: c.score,
              pass: c.pass,
              suspicion: c.suspicion ?? 0,
              reason: c.verdicts?.reason || null,
            })),
          }
        }),
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
   * POST /admin/custom-art/review/:uuid/dismiss — RETIRE une création de la file.
   *
   * Il n'existait aucun moyen de sortir une création devenue sans objet (test, doublon, demande
   * abandonnée) : la file grossissait et noyait les vraies. On réutilise EXACTEMENT le chemin de
   * la purge automatique J+30 (`purgeJobFiles`) : fichiers effacés — photo du client, candidats,
   * aperçus, mises en situation — et statut `expired`, un état terminal que le front sait déjà
   * afficher. La LIGNE est conservée : la trace reste, seules les données personnelles partent.
   *
   * GARDE : une création ACHETÉE n'est jamais retirable — l'atelier doit encore la produire et ses
   * fichiers servent au tirage. C'est la règle que la purge automatique applique déjà.
   */
  public async dismiss({ params, response }: HttpContextContract) {
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

    const order = await CustomArtOrder.query().where('job_id', job.id).first()
    if (order) {
      return response.status(409).json({
        success: false,
        message: 'Cette création a été achetée : elle doit être produite, pas retirée.',
      })
    }

    await purgeJobFiles(job)
    Logger.info('custom-art review DISMISS uuid=%s (fichiers purgés, statut expired)', job.uuid)
    return { success: true, data: { uuid: job.uuid, status: job.status } }
  }

  /**
   * POST /admin/custom-art/review/:uuid/result — multipart `image` : attache manuellement
   * le rendu réalisé par l'artiste. HD stockée privée + aperçu réduit public,
   * le job repasse en ready avec ce résultat (les anciens candidats restent archivés
   * mais ne sont plus révélables).
   */
  public async uploadResult({ params, request, response }: HttpContextContract) {
    const job = await this.findJob(params.uuid)
    if (!job) {
      return response.status(404).json({ success: false, message: 'Job introuvable.' })
    }
    // `ready` est accepté AU MÊME TITRE que `manual_review` : c'est le cas « le rendu produit ne
    // convient pas, je fournis le mien ». Sans lui, une création déjà aboutie n'était plus
    // corrigeable depuis l'écran — il fallait passer par la base. Constaté le 02/09/2026 : une
    // création cliente était sortie de la file en réussissant, et l'atelier ne pouvait plus
    // remplacer l'image. Les états terminaux (expired) et l'échec restent refusés.
    if (job.status !== 'manual_review' && job.status !== 'ready') {
      return response.status(409).json({
        success: false,
        message: `Cette création n'accepte pas de rendu (statut actuel : ${job.status}).`,
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
    const preview = await PreviewService.makePreview(hd)
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

    // « Prévenez-moi quand c'est prêt » : c'est ICI que ça compte le plus — la cliente d'un job
    // passé en revue a attendu bien plus que les 3 minutes du studio.
    void notifyReadyIfRequested(job)

    // Le job vient de passer ready : mises en situation Photopea en tâche de fond
    // (M7, plan §8) — fire-and-forget, renderForJob ne throw jamais (backlog interne).
    void MockupRenderer.renderForJob(job)

    return { success: true, data: { uuid: job.uuid, status: 'ready' } }
  }

  /**
   * GET /admin/custom-art/creations?q= — TOUTES les créations sur lesquelles l'atelier peut
   * encore agir, pas seulement celles en revue.
   *
   * La file de revue ne liste que `manual_review` : une création qui aboutit en sort et devient
   * introuvable. Le 30/08/2026, une cliente a vu sa création disparaître de l'écran parce
   * qu'elle était simplement passée `ready` — l'atelier n'avait alors plus AUCUN moyen de la
   * retrouver, de savoir à qui écrire, ni de corriger l'image. C'est ce trou que cette liste
   * comble.
   *
   * `expired` est exclu : plus de fichiers, donc plus rien à faire — conformément à la règle
   * « on ne montre que ce sur quoi on agit ».
   */
  public async creations({ request, response }: HttpContextContract) {
    response.header('Cache-Control', 'no-store')

    const q = String(request.input('q') || '')
      .trim()
      .toLowerCase()
    const jobs = await CustomArtJob.query()
      .whereNot('status', 'expired')
      .orderBy('created_at', 'desc')
      .limit(60)

    const teamIds = [...new Set(jobs.map((j) => j.teamId))].filter(
      (id): id is number => id !== null
    )
    const teams = teamIds.length > 0 ? await CustomArtTeam.query().whereIn('id', teamIds) : []
    const teamById = new Map(teams.map((t) => [t.id, t]))

    // Adresses : portées par la SESSION (« sauvegarder ma création ») ou par le job
    // (« prévenez-moi »). Sans cette jointure, l'atelier ne sait pas à qui écrire.
    const sessionIds = [...new Set(jobs.map((j) => j.sessionId))]
    const sessions =
      sessionIds.length > 0 ? await CustomArtSession.query().whereIn('id', sessionIds) : []
    const emailBySession = new Map(sessions.map((s) => [s.id, s.email]))

    // Achetée ou non : ça change la portée d'un remplacement d'image (le tirage est en jeu),
    // donc l'écran le signale. Garde sur la liste vide, comme pour les équipes et les sessions.
    const orders =
      jobs.length > 0
        ? await CustomArtOrder.query().whereIn(
            'job_id',
            jobs.map((j) => j.id)
          )
        : []
    const orderedJobIds = new Set(orders.map((o) => o.jobId))

    const LISIBLE: Record<string, string> = {
      pending: 'en attente de génération',
      generating: 'génération en cours',
      judging: 'jugement en cours',
      ready: 'prête',
      manual_review: 'en revue',
      failed: 'échec',
    }

    const rows = jobs
      .map((job) => {
        const label = describeJob(job, teamById.get(job.teamId as number)?.name ?? null)
        const candidates = job.candidates || []
        const chosen =
          (job.chosenIndex !== null ? candidates[job.chosenIndex] : null) ||
          candidates.find((c) => c.rank === 1) ||
          null
        return {
          uuid: job.uuid,
          nom: label.displayName || '—',
          numero: label.number,
          option: label.optionName ?? (job.productType || 'générique'),
          format: job.format,
          frame: job.frame,
          statut: job.status,
          statutLisible: LISIBLE[job.status] || job.status,
          creeLe: job.createdAt?.toISO() || null,
          // Aperçu de la version actuellement retenue : c'est CE que voit la cliente.
          apercuUrl: chosen?.previewPath ? CustomArtStorage.publicUrl(chosen.previewPath) : null,
          email: job.notifyEmail || emailBySession.get(job.sessionId) || null,
          mailPretEnvoyeLe: job.notifySentAt?.toISO() || null,
          achetee: orderedJobIds.has(job.id),
        }
      })
      .filter((r) => {
        if (!q) return true
        return [r.nom, r.option, r.email, r.uuid].some(
          (v) => v && String(v).toLowerCase().includes(q)
        )
      })

    return { success: true, data: { creations: rows } }
  }

  /**
   * POST /admin/custom-art/creations/:uuid/ready-mail — envoie (ou renvoie) à la cliente
   * l'e-mail « votre création est prête ».
   *
   * Il n'existait AUCUN moyen de le déclencher : `notifyReadyIfRequested` n'est appelé qu'aux
   * bascules automatiques en `ready` et par POST /jobs/:uuid/notify, qui exige la session de la
   * cliente. Une création prête dont la cliente n'avait pas armé « prévenez-moi » ne recevait
   * donc jamais rien — elle ignorait que son tableau l'attendait.
   *
   * On repasse par le chemin de production (`notifyReadyIfRequested`) plutôt que d'appeler le
   * mailer à la main : même rendu, même horodatage, même garde anti-doublon.
   */
  public async resendReady({ params, response }: HttpContextContract) {
    const job = await this.findJob(params.uuid)
    if (!job) {
      return response.status(404).json({ success: false, message: 'Création introuvable.' })
    }
    if (job.status !== 'ready') {
      return response.status(409).json({
        success: false,
        message: `La création n'est pas prête (statut actuel : ${job.status}).`,
      })
    }

    const session = await CustomArtSession.find(job.sessionId)
    const target = job.notifyEmail || session?.email || null
    if (!target) {
      return response.status(422).json({
        success: false,
        message: "Cette cliente n'a jamais laissé d'adresse : impossible de lui écrire.",
      })
    }

    // Renvoi explicitement demandé : on rouvre la porte que `notifySentAt` avait fermée.
    job.notifyEmail = target
    job.notifyLocale = job.notifyLocale || 'fr'
    job.notifySentAt = null
    await job.save()

    await notifyReadyIfRequested(job)

    // `notifyReadyIfRequested` est best-effort et n'horodate qu'en cas de succès : `notifySentAt`
    // est donc notre SEULE preuve d'envoi. Sans cette relecture, l'écran annoncerait « envoyé »
    // alors que rien n'est parti. Relu depuis la base (et non `job.refresh()`) pour repartir
    // d'un objet neuf : on vient d'écrire `null` sur cette colonne juste au-dessus.
    const relu = await CustomArtJob.findBy('uuid', job.uuid)
    const envoyeLe = relu?.notifySentAt
    if (!envoyeLe) {
      return response.status(502).json({
        success: false,
        message: "L'envoi a échoué (Resend). Rien n'est parti — tu peux réessayer.",
      })
    }

    Logger.info('custom-art ready-mail (atelier) uuid=%s -> %s', job.uuid, target)
    return {
      success: true,
      data: { uuid: job.uuid, email: target, envoyeLe: envoyeLe.toISO() },
    }
  }

  // --------------------------------------------------------------------------
  // Helpers privés
  // --------------------------------------------------------------------------

  private async findJob(uuid: string): Promise<CustomArtJob | null> {
    if (!uuid || !UUID_RE.test(String(uuid))) return null
    return CustomArtJob.findBy('uuid', uuid)
  }
}
