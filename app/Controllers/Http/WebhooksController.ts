import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import crypto from 'crypto'
import Env from '@ioc:Adonis/Core/Env'
import Shopify from 'App/Services/Shopify'
import ChatGPT from 'App/Services/ChatGPT'
import WebhookLog from 'App/Models/WebhookLog'
import Database from '@ioc:Adonis/Lucid/Database'
import { logTaskBoundary } from 'App/Utils/Logs'
import VideoStorage from 'App/Services/VideoStorage'
import PublishAlertMailer from 'App/Services/PublishAlertMailer'
import CustomArtJob from 'App/Models/CustomArtJob'
import CustomArtOrder from 'App/Models/CustomArtOrder'
import CustomArtTeam from 'App/Models/CustomArtTeam'
import CustomArtStorage from 'App/Services/CustomArt/Storage'
import PrintFileService from 'App/Services/CustomArt/PrintFileService'
import OrderMailer, { OrderMailItem } from 'App/Services/CustomArt/OrderMailer'
import { chosenCandidate } from 'App/Services/CustomArt/chosenCandidate'

interface UpdateFailure {
  productId: string
  productTitle: string
  error: string
  timestamp: Date
}

const JOB_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default class WebhooksController {
  private static processingProducts = new Set<string>()
  private static readonly COOLDOWN_PERIOD = 5000 // 5 seconds

  public async handle({ request, response }: HttpContextContract) {
    logTaskBoundary(true, 'Webhook received')

    // Variables declared here to be accessible in catch/finally blocks
    let productId: string | undefined
    let webhookId: string | undefined
    let topic: string | undefined

    try {
      const rawBody = (await request.raw()) ?? ''

      const isAuthentic = this.verifyWebhook(request, rawBody)
      if (!isAuthentic && Env.get('NODE_ENV') !== 'development') {
        console.warn('Invalid webhook signature received')
        return response.unauthorized({ error: 'Invalid webhook signature' })
      }

      topic = request.header('X-Shopify-Topic')
      const shop = request.header('X-Shopify-Shop-Domain')
      webhookId = request.header('X-Shopify-Webhook-Id')

      if (!webhookId) {
        console.warn('No webhook ID found in request')
        return response.status(200).send({ message: 'Webhook received' })
      }

      if (!topic) {
        console.warn('No topic found in request')
        return response.status(200).send({ message: 'Webhook received' })
      }

      const existingLog = await WebhookLog.findBy('webhookId', webhookId)
      if (existingLog) {
        console.info(`Webhook ${webhookId} already processed, skipping`)
        return response.status(200).send({ message: 'Webhook already processed' })
      }

      const { id } = request.body()
      productId = id
      if (!productId) {
        console.warn('No ID found in webhook request')
        return response.status(200).send({ message: 'Webhook received' })
      }

      if (WebhooksController.processingProducts.has(productId)) {
        console.info(`Product ${productId} is in cooldown, skipping`)
        return response.status(200).send({ message: 'Product in cooldown' })
      }

      // CRITICAL: Add to Set BEFORE responding to prevent race conditions with duplicate webhooks
      WebhooksController.processingProducts.add(productId)

      try {
        const trx = await Database.transaction()
        try {
          await WebhookLog.create(
            {
              webhookId,
              topic,
              shop,
              status: 'completed',
            },
            { client: trx }
          )

          await trx.commit()
          console.info(`📝 Webhook ${webhookId} logged successfully`)
        } catch (error: any) {
          await trx.rollback()

          if (error?.code === 'ER_DUP_ENTRY') {
            console.info(`Webhook ${webhookId} was already logged (duplicate)`)
            WebhooksController.processingProducts.delete(productId!)
            return response.status(200).send({ message: 'Webhook already processed' })
          }

          console.error(`Error logging webhook ${webhookId}:`, error)
          WebhooksController.processingProducts.delete(productId!)
          return response.status(200).send({ message: 'Webhook received' })
        }
      } catch (error: any) {
        console.error(`Transaction error for webhook ${webhookId}:`, error)
        WebhooksController.processingProducts.delete(productId!)
        return response.status(200).send({ message: 'Webhook received' })
      }

      response.status(200).send({ message: 'Webhook received' })

      // Payload complet requis par orders/paid (line items + properties) — capturé
      // avant le setImmediate, le contexte HTTP n'étant plus garanti ensuite.
      const payload = request.body()

      // Fire-and-forget: process asynchronously after responding
      setImmediate(() => {
        this.processWebhookAsync(topic!, productId!, payload).catch((error) => {
          console.error(`❌ Uncaught error in async webhook processing for ${productId}:`, error)
        })
      })

      return
    } catch (error: any) {
      console.error('Error processing webhook:', error)
      if (productId) {
        WebhooksController.processingProducts.delete(productId)
      }
      return response.status(200).send({ message: 'Webhook received' })
    } finally {
      logTaskBoundary(false, 'Webhook received')
    }
  }

  private async handleProductCreate(id: string) {
    console.info(`🚀 Handling product create: ${id}`)
    await this.handleArtworkCreate(id, 'painting')
    await this.handleArtworkCreate(id, 'poster')
    await this.handleTapestryCreate(id)
  }

  /**
   * Unified handler for artworks (paintings and posters)
   * Both use ratio-based models and require color/theme detection
   */
  private async handleArtworkCreate(id: string, type: 'painting' | 'poster') {
    const shopify = new Shopify()
    const product = await shopify.product.getProductById(id)

    const areMediaLoaded = await shopify.product.artworkCopier.areMediaImagesLoaded(product)
    if (!areMediaLoaded) return

    const canProcess = shopify.product.artworkCopier.canProcessProductCreate(product)
    if (!canProcess) return

    // Check if product matches the type we're processing
    if (product.artworkTypeMetafield?.value !== type) return

    console.info(`🚀 Filling model data on ${type}: ${id}`)
    let copyFailed = false
    try {
      await shopify.product.artworkCopier.copyModelDataFromImageRatio(product)
      console.info(`🚀 Data successfully copied on ${type} ${id}`)
    } catch (copyError: any) {
      const msg = copyError instanceof Error ? copyError.message : String(copyError)
      // Shopify's daily variant-creation limit is NOT a real copy failure: options,
      // metafields (color swatches, layout), category and translations were still
      // applied — only the variant matrix is incomplete, and RepairIncompleteArtworks
      // fills it once the quota resets. Color/theme detection below is independent of
      // variants, so keep going (the limit must block variants only, nothing else).
      if (msg.includes('Daily variant')) {
        console.warn(
          `⏸️  Daily variant limit hit for ${type} ${id}; variants deferred to repair cron, continuing with color/theme detection`
        )
      } else {
        copyFailed = true
        console.error(`❌ Model copy failed for ${type} ${id}: ${msg}`)
      }
    }

    // Safety net: make sure the full variant matrix was actually created.
    // Shopify caps variant creation (1,000/day past 50,000 variants), so a burst
    // publish can leave a product with only its default variant — alert if so.
    await this.verifyVariantMatrix(shopify, id, type)

    // Don't enrich an incomplete product only on a genuine copy failure. A daily
    // variant-limit hit is not one: the product is otherwise correct, so colors and
    // themes (which don't depend on variants) must still be detected and set.
    if (copyFailed) return

    // Color detection (runs after model data copy)
    console.info(`🎨 Detecting colors for ${type} ${id}`)
    const chatGPT = new ChatGPT()
    await chatGPT.colorPattern.detectAndSetColors(product)

    // Theme detection (runs after color detection)
    console.info(`🏷️  Detecting themes for ${type} ${id}`)
    await chatGPT.theme.detectAndSetThemes(product)
  }

  /**
   * Safety net for partial variant creation.
   *
   * Shopify throttles/limits bulk variant creation during heavy publishing (and
   * caps it at 1,000/day once a store passes 50,000 variants). When that happens
   * mid-batch, the options get copied but the size×border×frame matrix is left
   * incomplete (often a single default variant at 0,00). We compare the product's
   * variant count against the model and email an alert if it's incomplete, so the
   * product never silently ships with one variant. We do NOT auto-retry the copy
   * here: hitting the daily limit triggers Shopify's multi-hour backoff, which
   * would block the webhook — the human re-runs `shopify:resync_product_variants`
   * once the daily quota resets.
   */
  private async verifyVariantMatrix(shopify: Shopify, id: string, type: string): Promise<void> {
    try {
      const product = await shopify.product.getProductById(id)
      const model = await shopify.product.artworkCopier.getModelFromProduct(product)
      const expected = model?.variants?.nodes?.length ?? 0

      // No reliable reference point to assess completeness
      if (expected <= 1) return

      const actual = product.variants?.nodes?.length ?? 0
      if (actual >= expected) return

      console.error(
        `❌ Incomplete variant matrix for ${type} ${id}: ${actual}/${expected} — alerting`
      )
      await new PublishAlertMailer().sendIncompleteVariants({
        productId: id,
        title: product.title,
        type,
        actual,
        expected,
      })
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`⚠️  verifyVariantMatrix failed for ${id}: ${msg}`)
    }
  }

  private async handleTapestryCreate(id: string) {
    const shopify = new Shopify()
    const product = await shopify.product.getProductById(id)

    const canProcess = shopify.product.tapestryCopier.canProcessProductCreate(product)
    if (!canProcess) return

    console.info(`🚀 Filling model data on product`)
    await shopify.product.tapestryCopier.copyModelDataOnProduct(product)
    console.info(`🚀 Data successfully copied on product ${id}`)
  }

  private async handleProductUpdate(id: string) {
    console.info(`🚀 Handling product update: ${id}`)
    await this.updateRelatedProductsFromModel(id)
  }

  private async updateRelatedProductsFromModel(id: string) {
    try {
      const shopify = new Shopify()
      const product = await shopify.product.getProductById(id)
      const copier = shopify.product.getModelCopier(product)
      const isModel = copier.isModelProduct(product)
      if (!isModel) return

      console.info(`🚀 Updating related products from model: ${id}`)

      const products = await shopify.product.getAll()
      const relatedProducts = copier.getRelatedProducts(products, product)

      console.info(`📊 Found ${relatedProducts.length} related products to update`)

      const failures: UpdateFailure[] = []

      for (const relatedProduct of relatedProducts) {
        if (!WebhooksController.processingProducts.has(relatedProduct.id)) {
          WebhooksController.processingProducts.add(relatedProduct.id)

          try {
            await this.handleProductCreate(relatedProduct.id)

            setTimeout(() => {
              WebhooksController.processingProducts.delete(relatedProduct.id)
            }, WebhooksController.COOLDOWN_PERIOD)
          } catch (error: any) {
            const errorMessage = error?.message || String(error)
            failures.push({
              productId: relatedProduct.id,
              productTitle: relatedProduct.title,
              error: errorMessage,
              timestamp: new Date(),
            })
            console.error(`❌ Failed to update product ${relatedProduct.id}: ${errorMessage}`)

            setTimeout(() => {
              WebhooksController.processingProducts.delete(relatedProduct.id)
            }, 1000)
          }
        }
      }

      const successCount = relatedProducts.length - failures.length
      console.info(`\n${'='.repeat(60)}`)
      console.info(`📊 UPDATE SUMMARY`)
      console.info(`${'='.repeat(60)}`)
      console.info(`✅ Successfully updated: ${successCount}/${relatedProducts.length} products`)

      if (failures.length > 0) {
        console.error(`❌ Failed to update: ${failures.length} products`)
        console.error(`\n${'━'.repeat(60)}`)
        console.error(`FAILED PRODUCTS:`)
        console.error(`${'━'.repeat(60)}`)
        failures.forEach((f, index) => {
          console.error(`\n${index + 1}. ${f.productTitle}`)
          console.error(`   Product ID: ${f.productId}`)
          console.error(`   Error: ${f.error}`)
          console.error(`   Time: ${f.timestamp.toISOString()}`)
        })
        console.error(`${'━'.repeat(60)}\n`)
      } else {
        console.info(`🎉 All products updated successfully!`)
      }
      console.info(`${'='.repeat(60)}\n`)
    } catch (error: any) {
      console.error('Error during update related products:', error)
    }
  }

  /**
   * Processes webhook in background after HTTP response sent.
   * Product is already in processingProducts Set (added in handle() before responding).
   */
  private async processWebhookAsync(topic: string, id: string, payload?: any): Promise<void> {
    try {
      console.info(`🔄 Starting async processing for ${topic}: ${id}`)

      switch (topic) {
        case 'products/create':
          await this.handleProductCreate(id)
          break
        case 'products/update':
          await this.handleProductUpdate(id)
          // Also check if video metafield was cleared
          await this.handleVideoMetafieldCheck(id)
          break
        case 'products/delete':
          await this.handleProductDelete(id)
          break
        case 'orders/paid':
          await this.handleOrderPaid(payload)
          break
        default:
          console.warn(`Unhandled webhook topic in async processing: ${topic}`)
      }

      console.info(`✅ Async processing completed for ${id}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ Async processing failed for ${id}:`, errorMessage)
    } finally {
      setTimeout(() => {
        WebhooksController.processingProducts.delete(id)
        console.info(`🧹 Removed ${id} from processing set (cooldown complete)`)
      }, WebhooksController.COOLDOWN_PERIOD)
    }
  }

  /**
   * Handle product deletion: Delete associated video from DO Spaces
   */
  private async handleProductDelete(id: string | number): Promise<void> {
    console.info(`🗑️  Handling product delete: ${id}`)

    try {
      const videoStorage = new VideoStorage()

      // Convert to string and then to GID format for consistent handling
      const idStr = String(id)
      const productGid = idStr.startsWith('gid://') ? idStr : `gid://shopify/Product/${idStr}`

      // delete() handles non-existent files gracefully (returns true)
      const deleted = await videoStorage.delete(productGid)
      if (!deleted) {
        console.warn(`⚠️  Failed to delete video from DO Spaces for product ${id}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ Error deleting video for product ${id}:`, errorMessage)
    }
  }

  /**
   * Check if video metafield was cleared and delete video from DO Spaces if so.
   * This is called on products/update to handle manual metafield clearing.
   */
  private async handleVideoMetafieldCheck(id: string | number): Promise<void> {
    try {
      // Convert to string and then to GID format
      const idStr = String(id)
      const productGid = idStr.startsWith('gid://') ? idStr : `gid://shopify/Product/${idStr}`

      // Skip if an upload is currently in progress for this product
      // This prevents race conditions where webhook fires during upload
      if (VideoStorage.isUploadInProgress(productGid)) {
        console.info(`ℹ️  Upload in progress for product ${id}, skipping video metafield check`)
        return
      }

      const shopify = new Shopify()
      const videoStorage = new VideoStorage()

      // Check current metafield value
      const currentVideoUrl = await shopify.metafield.getVideoUrl(productGid)

      if (!currentVideoUrl) {
        // Metafield is empty - delete video if it exists (delete() handles non-existent files gracefully)
        console.info(
          `🗑️  Video metafield empty for product ${id}, attempting cleanup from DO Spaces...`
        )
        const deleted = await videoStorage.delete(productGid)

        if (!deleted) {
          console.warn(`⚠️  Failed to delete video from DO Spaces`)
        }

        // Also delete the video alt metafield if it exists
        await shopify.metafield.deleteVideoAlt(productGid)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ Error checking video metafield for product ${id}:`, errorMessage)
    }
  }

  /**
   * Rang (1-based, CustomArtCandidate.rank) de la version affichée à l'ajout au panier
   * (navigateur de versions du studio). Deux sources :
   *   - property explicite `_version_rank` (1-based) — contrat front ;
   *   - l'URL d'aperçu de la ligne (`.../jobs/<uuid>/preview/<n>` du MÊME job) => rank=n+1,
   *     soit l'image LITTÉRALEMENT affichée — source de secours ET garde-fou.
   *
   * Si les deux sont présentes mais DIVERGENT, on tranche pour l'URL (image réellement
   * vue par le client) et on le signale : c'est le filet anti off-by-one du front pendant
   * qu'il câble `_version_rank` (envoyer N au lieu de N+1 imprimerait sinon la version
   * voisine, en silence). Sinon on prend ce qui est disponible.
   *
   * ⚠️ Un rang n'est retenu QUE s'il désigne un candidat VALIDÉ par le juge (`pass:true`) —
   * décision Walid, défense en profondeur sur le chemin payé. Si un rang est indiqué mais ne
   * pointe AUCUN validé (rang forgé, ou ligne panier PÉRIMÉE d'avant le déploiement « validés
   * seulement »), repli SÛR sur le meilleur candidat validé (rang 1) + log — jamais d'erreur,
   * jamais une version recalée. Aucune info de version sur la ligne (vieux panier) => null
   * (repli chosenIndex, lui aussi protégé contre un non-validé, cf. chosenCandidate).
   */
  private extractCandidateRank(lineItem: any, job: CustomArtJob): number | null {
    const properties: any[] = Array.isArray(lineItem?.properties) ? lineItem.properties : []
    const candidates = job.candidates || []
    // Rang retenu UNIQUEMENT s'il désigne un candidat validé (pass:true).
    const isValidated = (rank: number) =>
      Number.isInteger(rank) && rank >= 1 && candidates.some((c) => c.rank === rank && c.pass)
    // Repli sûr : meilleur candidat validé (plus petit rang parmi les pass = rang 1).
    const bestValidatedRank =
      candidates.filter((c) => c.pass).sort((a, b) => a.rank - b.rank)[0]?.rank ?? null

    const re = new RegExp(`/api/custom-art/jobs/${job.uuid}/preview/(\\d+)`, 'i')

    // Rang dérivé de l'URL d'aperçu de CE job (`/preview/<n>` => rank = n + 1)
    let urlRank: number | null = null
    let urlHintPresent = false
    for (const p of properties) {
      if (typeof p?.value !== 'string') continue
      const m = p.value.match(re)
      if (m) {
        urlHintPresent = true
        const r = Number(m[1]) + 1
        if (isValidated(r)) {
          urlRank = r
          break
        }
      }
    }

    // Property explicite _version_rank (1-based)
    let propRank: number | null = null
    const rankProp = properties.find((p) => p?.name === '_version_rank')
    const propHintPresent = Boolean(rankProp)
    if (rankProp) {
      const r = Number(rankProp.value)
      if (isValidated(r)) propRank = r
    }

    // Désaccord entre deux rangs VALIDÉS => probable off-by-one front : on retient l'URL
    // (image réellement affichée) + alerte.
    if (urlRank !== null && propRank !== null && urlRank !== propRank) {
      console.warn(
        `⚠️ orders/paid job ${job.uuid}: _version_rank=${propRank} ≠ rang URL aperçu=${urlRank} — on retient l'URL (image affichée). Vérifier le 1-based côté front.`
      )
      return urlRank
    }

    const resolved = propRank ?? urlRank
    if (resolved !== null) return resolved

    // Un rang était indiqué (panier périmé d'avant « validés seulement », ou rang forgé) mais
    // ne pointe AUCUN candidat validé : repli SÛR sur le meilleur validé (jamais d'erreur,
    // jamais un recalé). Logué pour suivre l'arrivée éventuelle de vieilles lignes panier.
    if ((propHintPresent || urlHintPresent) && bestValidatedRank !== null) {
      console.warn(
        `⚠️ orders/paid job ${job.uuid}: _version_rank non-validé → repli best (rang ${bestValidatedRank})`
      )
      return bestValidatedRank
    }

    // Aucune info de version sur la ligne (vieux panier sans property) : null => chosenIndex
    // validé côté chosenCandidate (lui-même protégé contre un dernier révélé non validé).
    return null
  }

  /**
   * orders/paid (M9, plan §9) : pour chaque line item portant la property cachée
   * `_job_id` (création studio CustomArt), crée la ligne custom_art_orders en
   * 'awaiting_file' puis lance — détaché — la préparation du fichier print
   * (upscale Real-ESRGAN + gabarit Picanova, App/Services/CustomArt/PrintFileService).
   *
   * Idempotence à deux étages : WebhookLog (webhook_id unique, dédoublonné dans
   * handle()) + contrainte unique (shopify_order_id, line_item_id) via firstOrCreate —
   * une redélivraison Shopify ne crée ni doublon ni deuxième upscale.
   * L'email client de confirmation n'est envoyé que si au moins une ligne vient
   * d'être créée (jamais sur un rejeu).
   */
  private async handleOrderPaid(payload: any): Promise<void> {
    const orderId = String(payload?.id || '')
    if (!orderId) {
      console.warn('orders/paid sans id — ignoré')
      return
    }

    const lineItems: any[] = Array.isArray(payload?.line_items) ? payload.line_items : []
    const matches: Array<{ lineItem: any; jobUuid: string }> = []
    for (const lineItem of lineItems) {
      const properties: any[] = Array.isArray(lineItem?.properties) ? lineItem.properties : []
      const jobProp = properties.find(
        (p) => p?.name === '_job_id' && typeof p?.value === 'string' && JOB_UUID_RE.test(p.value)
      )
      if (jobProp) matches.push({ lineItem, jobUuid: jobProp.value })
    }
    // Commande classique (tableaux catalogue) : rien à faire ici
    if (matches.length === 0) return

    const orderName: string | null = payload?.name || null
    const customerEmail: string | null =
      payload?.email || payload?.contact_email || payload?.customer?.email || null

    console.info(
      `🛒 orders/paid ${orderName || orderId}: ${matches.length} article(s) personnalisé(s)`
    )

    const createdItems: OrderMailItem[] = []
    const createdJobUuids: string[] = []
    for (const { lineItem, jobUuid } of matches) {
      const job = await CustomArtJob.findBy('uuid', jobUuid)
      if (!job) {
        console.error(`❌ orders/paid ${orderId}: job CustomArt introuvable (uuid=${jobUuid})`)
        continue
      }

      // Version ACHETÉE (navigateur de versions du studio) : rang figé depuis la ligne
      // panier, validé contre les candidats du job. NULL => repli sur chosenIndex côté
      // impression (flux historique). cf. extractCandidateRank / chosenCandidate.
      const candidateRank = this.extractCandidateRank(lineItem, job)

      // Idempotent : contrainte unique (shopify_order_id, line_item_id) + firstOrCreate
      const order = await CustomArtOrder.firstOrCreate(
        { shopifyOrderId: orderId, lineItemId: String(lineItem.id) },
        {
          jobId: job.id,
          candidateRank,
          orderName,
          customerEmail,
          printStatus: 'awaiting_file',
        }
      )
      if (!order.$isLocal) {
        console.info(
          `↩️  orders/paid ${orderId}: ligne ${lineItem.id} déjà enregistrée (rejeu) — préparation non relancée`
        )
        continue
      }

      console.info(
        `📦 CustomArtOrder créé (commande ${orderName || orderId}, job ${job.uuid}) — préparation du fichier print lancée`
      )

      // Préparation du fichier print, détachée : ne bloque jamais le webhook.
      // PrintFileService.prepare ne throw pas (échec -> print_error + email d'alerte).
      setImmediate(() => {
        PrintFileService.prepare(order.id).catch((error) => {
          console.error(`❌ Préparation print commande ${orderId}:`, error?.message || error)
        })
      })

      // Contenu de l'email de confirmation client (aperçu de la version ACHETÉE + mockups)
      const team = await CustomArtTeam.find(job.teamId)
      const chosen = chosenCandidate(job, order.candidateRank)
      createdJobUuids.push(job.uuid)
      createdItems.push({
        playerName: job.playerName,
        playerNumber: job.playerNumber,
        teamName: team?.name || 'votre équipe',
        format: job.format,
        frame: job.frame,
        previewUrl: chosen?.previewPath ? CustomArtStorage.publicUrl(chosen.previewPath) : null,
        mockupUrls: (job.mockups || [])
          .filter((m) => m.status === 'done' && m.url)
          .map((m) => m.url as string),
      })
    }

    // Confirmation client (aperçu + mockups + délais) — uniquement sur création réelle
    if (createdItems.length > 0 && customerEmail) {
      await new OrderMailer()
        .sendPaidConfirmation({ email: customerEmail, orderName, items: createdItems })
        .catch(() => {})
    }

    // Marquage interne de la commande Shopify (admin UNIQUEMENT, jamais visible client) :
    // tag `custom-art` (repère filtrable d'un coup d'œil) + `ca-job:<uuid>` par création,
    // pour relier la commande à son image même hors de notre base (redondance de sécurité).
    // Détaché + best-effort : ne bloque jamais le webhook et n'échoue jamais la réponse.
    if (createdJobUuids.length > 0) {
      const tags = ['custom-art', ...createdJobUuids.map((uuid) => `ca-job:${uuid}`)]
      setImmediate(() => {
        new Shopify().order
          .addTags(orderId, tags)
          .catch((error) =>
            console.error(`❌ tagsAdd commande ${orderId}:`, error?.message || error)
          )
      })
    }
  }

  private verifyWebhook(request: HttpContextContract['request'], rawBody: string): boolean {
    try {
      const secret = Env.get('SHOPIFY_CLIENT_SECRET')
      const hmac = request.header('X-Shopify-Hmac-Sha256')
      const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf-8').digest('base64')

      if (!hmac) {
        console.info('No HMAC signature found in webhook request')
        return false
      }

      return crypto.timingSafeEqual(
        new Uint8Array(Buffer.from(hash)),
        new Uint8Array(Buffer.from(hmac))
      )
    } catch (error) {
      console.error('Error verifying webhook:', error)
      return false
    }
  }
}
