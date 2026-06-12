import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Drive from '@ioc:Adonis/Core/Drive'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import { DateTime } from 'luxon'
import sharp from 'sharp'
import CustomArtJob from 'App/Models/CustomArtJob'
import CustomArtOrder from 'App/Models/CustomArtOrder'
import CustomArtTeam from 'App/Models/CustomArtTeam'
import CustomArtStorage from 'App/Services/CustomArt/Storage'
import OrderMailer from 'App/Services/CustomArt/OrderMailer'
import PrintFileService, { PRINT_SPECS } from 'App/Services/CustomArt/PrintFileService'

// Largeur max des aperçus servis par GET :id/file?w= (le fichier print fait ~5000 px,
// la vignette de la file n'a pas besoin de plus)
const FILE_PREVIEW_MAX_W = 1600

/**
 * File print admin (M9, plan §9) — routes /admin/custom-art/print-queue (auth,
 * pattern publisher). Chaque fichier d'impression est validé HUMAINEMENT à 100 %
 * avant la commande manuelle sur le portail Picanova (flux actuel inchangé) :
 *   awaiting_file -> (préparation auto) -> awaiting_review -> [Approuver] -> approved
 *   -> commande portail Picanova -> [Marquer commandée] -> ordered.
 * « Régénérer l'upscale » relance la préparation (depuis la HD élue du job).
 * Le téléchargement du fichier print passe par une URL signée temporaire (DO Spaces)
 * — JAMAIS d'URL publique permanente sur un fichier print.
 */
export default class CustomArtPrintAdminController {
  /** GET /admin/custom-art/print-queue — commandes (toutes) + contexte job/équipe. */
  public async index({ response }: HttpContextContract) {
    response.header('Cache-Control', 'no-store')

    const orders = await CustomArtOrder.query().orderBy('created_at', 'desc').limit(300)

    const jobIds = [...new Set(orders.map((o) => o.jobId))]
    const jobs = jobIds.length > 0 ? await CustomArtJob.query().whereIn('id', jobIds) : []
    const jobById = new Map(jobs.map((j) => [j.id, j]))

    const teamIds = [...new Set(jobs.map((j) => j.teamId))]
    const teams = teamIds.length > 0 ? await CustomArtTeam.query().whereIn('id', teamIds) : []
    const teamById = new Map(teams.map((t) => [t.id, t]))

    return {
      success: true,
      data: {
        orders: orders.map((order) => {
          const job = jobById.get(order.jobId) || null
          const candidates = job?.candidates || []
          const chosen =
            job && job.chosenIndex !== null ? candidates[job.chosenIndex] || null : null
          const spec = job ? PRINT_SPECS[job.format] : null
          return {
            id: order.id,
            shopifyOrderId: order.shopifyOrderId,
            orderName: order.orderName,
            lineItemId: order.lineItemId,
            customerEmail: order.customerEmail,
            printStatus: order.printStatus,
            printError: order.printError,
            hasFile: Boolean(order.printFilePath),
            createdAt: order.createdAt?.toISO() || null,
            reviewedAt: order.reviewedAt?.toISO() || null,
            // Visuel du fichier print servi par la route admin (clé storage PRIVÉE)
            fileUrl: order.printFilePath ? `/admin/custom-art/print-queue/${order.id}/file` : null,
            downloadUrl: order.printFilePath
              ? `/admin/custom-art/print-queue/${order.id}/download`
              : null,
            // Aperçu watermarké public (vignette rapide en attendant le fichier)
            previewUrl: chosen?.previewPath ? CustomArtStorage.publicUrl(chosen.previewPath) : null,
            shopifyAdminUrl: this.shopifyAdminOrderUrl(order.shopifyOrderId),
            printSpec: spec ? `${spec.width} × ${spec.height} px @${spec.dpi} dpi` : null,
            job: job
              ? {
                  uuid: job.uuid,
                  playerName: job.playerName,
                  playerNumber: job.playerNumber,
                  format: job.format,
                  frame: job.frame,
                  team: teamById.get(job.teamId)?.name || `équipe #${job.teamId}`,
                }
              : null,
          }
        }),
      },
    }
  }

  /**
   * GET /admin/custom-art/print-queue/:id/file[?w=600] — fichier print servi à
   * l'admin (clé privée, auth obligatoire). Sans `w` : pleine résolution (zoom 100 %).
   * Avec `w` : vignette redimensionnée à la volée pour la liste.
   */
  public async file({ params, request, response }: HttpContextContract) {
    const order = await CustomArtOrder.find(Number(params.id))
    if (!order || !order.printFilePath) {
      return response.status(404).json({ success: false, message: 'Fichier print introuvable.' })
    }

    let buffer: Buffer
    try {
      buffer = await CustomArtStorage.get(order.printFilePath)
    } catch {
      return response.status(404).json({ success: false, message: 'Fichier print indisponible.' })
    }

    const w = Number(request.input('w'))
    if (Number.isInteger(w) && w > 0) {
      buffer = await sharp(buffer, { limitInputPixels: false })
        .resize(Math.min(w, FILE_PREVIEW_MAX_W), undefined, { withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer()
    }

    response.header('Content-Type', 'image/jpeg')
    // Le fichier peut être régénéré : pas de cache
    response.header('Cache-Control', 'no-store')
    return response.send(buffer)
  }

  /**
   * GET /admin/custom-art/print-queue/:id/download — téléchargement du fichier print.
   * DO Spaces : redirection vers une URL SIGNÉE temporaire (10 min) — pas d'URL
   * publique permanente. Fallback local (dev) : flux authentifié en pièce jointe.
   */
  public async download({ params, response }: HttpContextContract) {
    const order = await CustomArtOrder.find(Number(params.id))
    if (!order || !order.printFilePath) {
      return response.status(404).json({ success: false, message: 'Fichier print introuvable.' })
    }

    const filename = `print-${(order.orderName || order.shopifyOrderId).replace(/[^a-z0-9_-]/gi, '')}.jpg`

    if (CustomArtStorage.spacesConfigured()) {
      try {
        const signedUrl = await Drive.use('spaces').getSignedUrl(order.printFilePath, {
          expiresIn: '10mins',
          contentDisposition: `attachment; filename="${filename}"`,
        })
        return response.redirect(signedUrl)
      } catch (error) {
        Logger.error('custom-art print signed-url: %s', (error as any)?.message || error)
        return response
          .status(500)
          .json({ success: false, message: 'URL signée indisponible. Réessaie.' })
      }
    }

    // Dev local : la route est derrière l'auth, on streame directement
    try {
      const buffer = await CustomArtStorage.get(order.printFilePath)
      response.header('Content-Type', 'image/jpeg')
      response.header('Content-Disposition', `attachment; filename="${filename}"`)
      response.header('Cache-Control', 'no-store')
      return response.send(buffer)
    } catch {
      return response.status(404).json({ success: false, message: 'Fichier print indisponible.' })
    }
  }

  /**
   * POST /admin/custom-art/print-queue/:id/approve — valide le fichier print
   * (awaiting_review -> approved) + email client « votre tableau part en production ».
   */
  public async approve({ params, response }: HttpContextContract) {
    const order = await CustomArtOrder.find(Number(params.id))
    if (!order) {
      return response.status(404).json({ success: false, message: 'Commande introuvable.' })
    }
    if (order.printStatus !== 'awaiting_review') {
      return response.status(409).json({
        success: false,
        message: `Cette commande n'est pas en attente de validation (statut : ${order.printStatus}).`,
      })
    }

    order.printStatus = 'approved'
    order.reviewedAt = DateTime.now()
    await order.save()
    Logger.info('custom-art print APPROVED commande=%s', order.orderName || order.shopifyOrderId)

    // Email client « part en production » — best-effort, détaché du retour HTTP
    if (order.customerEmail) {
      const job = await CustomArtJob.find(order.jobId)
      if (job) {
        const team = await CustomArtTeam.find(job.teamId)
        const candidates = job.candidates || []
        const chosen = job.chosenIndex !== null ? candidates[job.chosenIndex] || null : null
        void new OrderMailer()
          .sendInProduction({
            email: order.customerEmail,
            orderName: order.orderName,
            item: {
              playerName: job.playerName,
              playerNumber: job.playerNumber,
              teamName: team?.name || 'votre équipe',
              format: job.format,
              frame: job.frame,
              previewUrl: chosen?.previewPath
                ? CustomArtStorage.publicUrl(chosen.previewPath)
                : null,
              mockupUrls: [],
            },
          })
          .catch(() => {})
      }
    }

    return { success: true, data: { id: order.id, printStatus: order.printStatus } }
  }

  /**
   * POST /admin/custom-art/print-queue/:id/regenerate — relance la préparation du
   * fichier print (upscale + gabarit) depuis la HD élue du job. Repasse la commande
   * en awaiting_file le temps du traitement. Interdit après commande Picanova.
   */
  public async regenerate({ params, response }: HttpContextContract) {
    const order = await CustomArtOrder.find(Number(params.id))
    if (!order) {
      return response.status(404).json({ success: false, message: 'Commande introuvable.' })
    }
    if (order.printStatus === 'ordered' || order.printStatus === 'shipped') {
      return response.status(409).json({
        success: false,
        message: 'Commande déjà passée chez Picanova : fichier verrouillé.',
      })
    }

    order.printStatus = 'awaiting_file'
    order.printError = null
    order.reviewedAt = null
    await order.save()
    Logger.info('custom-art print REGENERATE commande=%s', order.orderName || order.shopifyOrderId)

    // Détaché : PrintFileService.prepare ne throw pas (échec -> print_error + email)
    setImmediate(() => {
      PrintFileService.prepare(order.id).catch((error) =>
        Logger.error('custom-art print regenerate: %s', (error as any)?.message || error)
      )
    })

    return { success: true, data: { id: order.id, printStatus: order.printStatus } }
  }

  /**
   * POST /admin/custom-art/print-queue/:id/ordered — la commande a été passée
   * manuellement sur le portail Picanova (approved -> ordered).
   */
  public async markOrdered({ params, response }: HttpContextContract) {
    const order = await CustomArtOrder.find(Number(params.id))
    if (!order) {
      return response.status(404).json({ success: false, message: 'Commande introuvable.' })
    }
    if (order.printStatus !== 'approved') {
      return response.status(409).json({
        success: false,
        message: `Approuve d'abord le fichier (statut actuel : ${order.printStatus}).`,
      })
    }

    order.printStatus = 'ordered'
    await order.save()
    Logger.info('custom-art print ORDERED commande=%s', order.orderName || order.shopifyOrderId)
    return { success: true, data: { id: order.id, printStatus: order.printStatus } }
  }

  // --------------------------------------------------------------------------
  // Helpers privés
  // --------------------------------------------------------------------------

  /** Lien admin Shopify de la commande (handle de boutique dérivé de SHOPIFY_SHOP_URL). */
  private shopifyAdminOrderUrl(shopifyOrderId: string): string | null {
    const shopUrl = String(Env.get('SHOPIFY_SHOP_URL') || '')
    const match = shopUrl.match(/https?:\/\/([^.]+)\.myshopify\.com/i)
    if (!match) return null
    return `https://admin.shopify.com/store/${match[1]}/orders/${shopifyOrderId}`
  }
}
