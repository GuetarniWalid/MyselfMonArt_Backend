import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import crypto from 'crypto'
import Env from '@ioc:Adonis/Core/Env'
import Shopify from 'App/Services/Shopify'
import ChatGPT from 'App/Services/ChatGPT'
import WebhookLog from 'App/Models/WebhookLog'
import Database from '@ioc:Adonis/Lucid/Database'
import { logTaskBoundary } from 'App/Utils/Logs'

interface UpdateFailure {
  productId: string
  productTitle: string
  error: string
  timestamp: Date
}

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

      // Fire-and-forget: process asynchronously after responding
      setImmediate(() => {
        this.processWebhookAsync(topic!, productId!).catch((error) => {
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
    await shopify.product.artworkCopier.copyModelDataFromImageRatio(product)
    console.info(`🚀 Data successfully copied on ${type} ${id}`)

    // Color detection (runs after model data copy)
    console.info(`🎨 Detecting colors for ${type} ${id}`)
    const chatGPT = new ChatGPT()
    await chatGPT.colorPattern.detectAndSetColors(product)

    // Theme detection (runs after color detection)
    console.info(`🏷️  Detecting themes for ${type} ${id}`)
    await chatGPT.theme.detectAndSetThemes(product)
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
  private async processWebhookAsync(topic: string, id: string): Promise<void> {
    try {
      console.info(`🔄 Starting async processing for ${topic}: ${id}`)

      switch (topic) {
        case 'products/create':
          await this.handleProductCreate(id)
          break
        case 'products/update':
          await this.handleProductUpdate(id)
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
