import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import CustomArtJob, { CustomArtFormat } from 'App/Models/CustomArtJob'
import CustomArtOrder from 'App/Models/CustomArtOrder'
import CustomArtTeam from 'App/Models/CustomArtTeam'
import CustomArtStorage from './Storage'
import PrintMailer from './PrintMailer'

/**
 * Gabarits print Picanova (plan §9) : dimensions EXACTES en pixels + densité.
 *   30×40 cm -> 3543×4724 px @300 dpi ; 60×80 cm -> 4724×6299 px @200 dpi.
 * Les deux formats sont au ratio 3:4, comme l'œuvre générée (aspect_ratio 3:4).
 */
export const PRINT_SPECS: Record<CustomArtFormat, { width: number; height: number; dpi: number }> =
  {
    '30x40': { width: 3543, height: 4724, dpi: 300 },
    '60x80': { width: 4724, height: 6299, dpi: 200 },
  }

// Modèle d'upscale Replicate (Real-ESRGAN ×4). Surchargeable par env
// CUSTOM_ART_UPSCALE_MODEL ('owner/name' ou 'owner/name:version' pour figer une version).
const UPSCALE_MODEL = process.env.CUSTOM_ART_UPSCALE_MODEL || 'nightmareai/real-esrgan'
const EST_UPSCALE_COST_EUR = 0.01

const API_BASE = 'https://api.replicate.com/v1'
const UPSCALE_TIMEOUT_MS = 5 * 60_000
// 1 essai + 1 retry (plan M9) ; au-delà, print_status reste awaiting_file + email d'alerte
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 5_000

/**
 * Préparation du fichier d'impression d'une commande payée (M9, plan §9) :
 * HD ÉLUE du job (candidat choisi, clé privée — JAMAIS l'aperçu réduit)
 *   -> upscale ×4 Real-ESRGAN via l'API REST Replicate (fidélité préservée :
 *      ⛔ surtout pas l'ArtworkResizer existant, qui RÉGÉNÈRE via gpt-image-2)
 *   -> sharp : redimension EXACTE aux gabarits print + sRGB + JPEG qualité 95
 *   -> stockage PRIVÉ custom-art/print/<orderId>/<jobUuid>.jpg
 *   -> print_status='awaiting_review' + notification email (file admin /custom-art-print-queue).
 *
 * Échec (après retry ×1) : print_status RESTE 'awaiting_file', print_error est posé
 * (affiché dans la file admin, bouton « Régénérer l'upscale ») + email d'alerte.
 *
 * CUSTOM_ART_SKIP_UPSCALE=true (tests locaux M9 uniquement) : l'appel Replicate est
 * sauté, le fichier print est produit par interpolation sharp depuis la HD élue.
 */
export default class PrintFileService {
  /** Cache mémoire de la version résolue du modèle (GET /models une seule fois). */
  private static modelVersionCache: string | null = null

  /**
   * Point d'entrée détaché (webhook orders/paid, bouton « Régénérer l'upscale »).
   * Ne throw JAMAIS : toute erreur finit en print_error + email d'alerte.
   */
  public static async prepare(orderId: number): Promise<void> {
    const order = await CustomArtOrder.find(orderId)
    if (!order) {
      Logger.error('custom-art print: commande introuvable (id=%s)', orderId)
      return
    }

    const job = await CustomArtJob.find(order.jobId)
    if (!job) {
      await PrintFileService.fail(order, null, `Job introuvable (id=${order.jobId})`)
      return
    }

    let lastError = 'inconnue'
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await PrintFileService.buildPrintFile(order, job)
        Logger.info(
          'custom-art print PRÊT commande=%s job=%s -> %s (tentative %s)',
          order.shopifyOrderId,
          job.uuid,
          order.printFilePath,
          attempt
        )
        // Notification : fichier à valider dans la file admin (best-effort)
        await new PrintMailer()
          .sendAwaitingReview({ order, job, teamName: await PrintFileService.teamName(job) })
          .catch(() => {})
        return
      } catch (error) {
        lastError = (error as any)?.message || String(error)
        Logger.warn(
          'custom-art print échec commande=%s job=%s tentative %s/%s: %s',
          order.shopifyOrderId,
          job.uuid,
          attempt,
          MAX_ATTEMPTS,
          lastError
        )
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        }
      }
    }

    await PrintFileService.fail(order, job, lastError)
  }

  /** Échec final : print_status reste awaiting_file, erreur posée + email d'alerte. */
  private static async fail(
    order: CustomArtOrder,
    job: CustomArtJob | null,
    reason: string
  ): Promise<void> {
    order.printStatus = 'awaiting_file'
    order.printError = reason.slice(0, 2000)
    await order.save().catch(() => {})
    Logger.error(
      'custom-art print ÉCHEC FINAL commande=%s job=%s: %s',
      order.shopifyOrderId,
      job?.uuid || order.jobId,
      reason
    )
    await new PrintMailer()
      .sendFailure({
        order,
        job,
        teamName: job ? await PrintFileService.teamName(job) : '—',
        reason,
      })
      .catch(() => {})
  }

  /** Chaîne complète HD élue -> upscale -> gabarit print -> stockage privé -> statut. */
  private static async buildPrintFile(order: CustomArtOrder, job: CustomArtJob): Promise<void> {
    const spec = PRINT_SPECS[job.format]
    if (!spec) throw new Error(`Format inconnu: ${job.format}`)

    // HD élue du job : le candidat que le client a validé au pixel près.
    const candidates = job.candidates || []
    const chosen = job.chosenIndex !== null ? candidates[job.chosenIndex] : null
    if (!chosen?.path) {
      throw new Error('Aucun candidat élu sur ce job (chosenIndex/path manquant)')
    }
    const hdBuffer = await CustomArtStorage.get(chosen.path)

    const upscaled = await PrintFileService.upscale(hdBuffer, job)

    // Gabarit print : dimensions exactes (cover, les deux côtés sont au ratio 3:4),
    // espace sRGB, densité dpi du format, JPEG qualité 95 sans sous-échantillonnage.
    const printBuffer = await sharp(upscaled, { limitInputPixels: false })
      .resize(spec.width, spec.height, { fit: 'cover', position: 'centre' })
      .toColorspace('srgb')
      .withMetadata({ density: spec.dpi })
      .jpeg({ quality: 95, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toBuffer()

    // Stockage PRIVÉ : jamais d'URL publique permanente sur un fichier print
    // (téléchargement admin = URL signée temporaire ou flux authentifié).
    const key = `custom-art/print/${order.shopifyOrderId}/${job.uuid}.jpg`
    await CustomArtStorage.put(key, printBuffer, { contentType: 'image/jpeg', isPublic: false })

    order.printFilePath = key
    order.printStatus = 'awaiting_review'
    order.printError = null
    await order.save()
  }

  /**
   * Upscale ×4 Real-ESRGAN via l'API REST Replicate (pattern ReplicateProvider :
   * input par URL publique temporaire — les data URI sont limités à ~256 Ko —,
   * Prefer: wait puis polling jusqu'à l'état terminal).
   */
  private static async upscale(buffer: Buffer, job: CustomArtJob): Promise<Buffer> {
    // Tests locaux M9 : on saute l'appel payant, sharp interpole depuis la HD élue.
    if (Env.get('CUSTOM_ART_SKIP_UPSCALE')) {
      Logger.warn('custom-art print: upscale SAUTÉ (CUSTOM_ART_SKIP_UPSCALE=true — test local)')
      return buffer
    }

    const token = Env.get('REPLICATE_API_TOKEN')
    if (!token) throw new Error('REPLICATE_API_TOKEN absent : upscale impossible')
    if (!CustomArtStorage.spacesConfigured()) {
      throw new Error("Storage distant requis pour l'upscale (DO Spaces non configuré)")
    }

    const t0 = Date.now()
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Prefer': 'wait',
      'Content-Type': 'application/json',
    }

    // Input par URL publique temporaire, supprimée ensuite (best-effort)
    const tmpKey = `custom-art/tmp/${randomUUID()}.jpg`
    await CustomArtStorage.put(tmpKey, buffer, { contentType: 'image/jpeg', isPublic: true })

    try {
      const version = await PrintFileService.resolveModelVersion(headers.Authorization)
      const createRsp = await axios.post(
        `${API_BASE}/predictions`,
        {
          version,
          input: {
            image: CustomArtStorage.publicUrl(tmpKey),
            scale: 4,
            face_enhance: false,
          },
        },
        { headers, timeout: 90_000 }
      )

      let prediction: any = createRsp.data
      while (prediction?.status === 'starting' || prediction?.status === 'processing') {
        if (Date.now() - t0 > UPSCALE_TIMEOUT_MS) {
          throw new Error(`Upscale Replicate timeout (${UPSCALE_TIMEOUT_MS}ms)`)
        }
        await new Promise((resolve) => setTimeout(resolve, 3000))
        const pollRsp = await axios.get(`${API_BASE}/predictions/${prediction.id}`, {
          headers: { Authorization: headers.Authorization },
          timeout: 15_000,
        })
        prediction = pollRsp.data
      }

      if (prediction?.status !== 'succeeded') {
        throw new Error(
          `Upscale Replicate échoué: ${prediction?.error || prediction?.status || 'inconnu'}`
        )
      }

      const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
      if (!output || typeof output !== 'string') {
        throw new Error('Upscale Replicate: sortie vide ou inattendue')
      }

      // Fichier upscalé volumineux (×16 pixels) : pas de limite de taille axios
      const imgRsp = await axios.get(output, {
        responseType: 'arraybuffer',
        timeout: 120_000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })

      // Coût tracé sur le job (compteur global quotidien)
      job.addCost('print-upscale', EST_UPSCALE_COST_EUR, `replicate:${UPSCALE_MODEL}`)
      await job.save().catch(() => {})

      Logger.info(
        'custom-art print upscale OK job=%s (%ss, modèle %s)',
        job.uuid,
        Math.round((Date.now() - t0) / 1000),
        UPSCALE_MODEL
      )
      return Buffer.from(imgRsp.data)
    } finally {
      CustomArtStorage.delete(tmpKey).catch(() => {})
    }
  }

  /**
   * Résout la version du modèle d'upscale. nightmareai/real-esrgan est un modèle
   * communautaire : POST /predictions exige un id de version — on lit latest_version
   * via GET /models/{owner}/{name} (caché en mémoire), sauf si la version est figée
   * dans CUSTOM_ART_UPSCALE_MODEL ('owner/name:version').
   */
  private static async resolveModelVersion(authorization: string): Promise<string> {
    const pinned = UPSCALE_MODEL.split(':')[1]
    if (pinned) return pinned
    if (PrintFileService.modelVersionCache) return PrintFileService.modelVersionCache

    const rsp = await axios.get(`${API_BASE}/models/${UPSCALE_MODEL}`, {
      headers: { Authorization: authorization },
      timeout: 15_000,
    })
    const version = rsp.data?.latest_version?.id
    if (!version) {
      throw new Error(`Version introuvable pour le modèle Replicate ${UPSCALE_MODEL}`)
    }
    PrintFileService.modelVersionCache = version
    return version
  }

  private static async teamName(job: CustomArtJob): Promise<string> {
    const team = await CustomArtTeam.find(job.teamId)
    return team?.name || `équipe #${job.teamId}`
  }
}
