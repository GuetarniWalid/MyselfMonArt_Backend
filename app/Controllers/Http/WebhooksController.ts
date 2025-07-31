import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import crypto from 'crypto'
import Env from '@ioc:Adonis/Core/Env'
import Shopify from 'App/Services/Shopify'
import WebhookLog from 'App/Models/WebhookLog'
import Database from '@ioc:Adonis/Lucid/Database'
import { logTaskBoundary } from 'App/Utils/Logs'

export default class WebhooksController {
  private static processingProducts = new Set<string>()
  private static readonly COOLDOWN_PERIOD = 5000 // 5 seconds
  private static readonly MAX_RETRIES = 3
  private static readonly RETRY_DELAY = 1000 // 1 second

  public async handle({ request, response }: HttpContextContract) {
    logTaskBoundary(true, 'Webhook received')

    try {
      const rawBody = (await request.raw()) ?? ''

      const isAuthentic = this.verifyWebhook(request, rawBody)
      if (!isAuthentic && Env.get('NODE_ENV') !== 'development') {
        console.warn('Invalid webhook signature received')
        return response.unauthorized({ error: 'Invalid webhook signature' })
      }

      const topic = request.header('X-Shopify-Topic')
      const shop = request.header('X-Shopify-Shop-Domain')
      const webhookId = request.header('X-Shopify-Webhook-Id')

      if (!webhookId) {
        console.warn('No webhook ID found in request')
        return response.status(200).send({ message: 'Webhook received' })
      }

      // Check if webhook was already processed (outside transaction)
      const existingLog = await WebhookLog.findBy('webhookId', webhookId)
      if (existingLog) {
        console.info(`Webhook ${webhookId} already processed, skipping`)
        return response.status(200).send({ message: 'Webhook already processed' })
      }

      const { id } = request.body()
      if (!id) {
        console.warn('No ID found in webhook request')
        return response.status(200).send({ message: 'Webhook received' })
      }

      // Check if product is in cooldown
      if (WebhooksController.processingProducts.has(id)) {
        console.info(`Product ${id} is in cooldown, skipping`)
        return response.status(200).send({ message: 'Product in cooldown' })
      }

      // Try to process the webhook with retries
      let retryCount = 0
      let lastError = null

      while (retryCount < WebhooksController.MAX_RETRIES) {
        try {
          const trx = await Database.transaction()
          try {
            // Create new webhook log
            const webhookLog = await WebhookLog.create(
              {
                webhookId,
                topic,
                shop,
                status: 'processing',
              },
              { client: trx }
            )

            WebhooksController.processingProducts.add(id)

            try {
              switch (topic) {
                case 'products/create':
                  await this.handleProductCreate(id)
                  break
                case 'products/update':
                  await this.handleProductUpdate(id)
                  break
                default:
                  console.warn(`Unhandled webhook topic: ${topic}`)
              }

              webhookLog.status = 'completed'
              await webhookLog.save()
              await trx.commit()

              // Remove from cooldown after delay
              setTimeout(() => {
                WebhooksController.processingProducts.delete(id)
              }, WebhooksController.COOLDOWN_PERIOD)

              return response.status(200).send({ message: 'Webhook received' })
            } catch (error) {
              webhookLog.status = 'failed'
              webhookLog.error = error.message
              await webhookLog.save()
              await trx.commit()
              throw error
            }
          } catch (error) {
            await trx.rollback()
            throw error
          }
        } catch (error) {
          lastError = error
          retryCount++

          // Check if it's a duplicate entry error (webhook was processed by another instance)
          if (error.code === 'ER_DUP_ENTRY') {
            console.info(`Webhook ${webhookId} was processed by another instance`)
            return response.status(200).send({ message: 'Webhook processed by another instance' })
          }

          // Check if it's a lock timeout error
          if (error.code === 'ER_LOCK_WAIT_TIMEOUT') {
            if (retryCount === WebhooksController.MAX_RETRIES) {
              console.warn(
                `Lock timeout after ${WebhooksController.MAX_RETRIES} retries for webhook ${webhookId}`
              )
              return response.status(200).send({ message: 'Webhook received' })
            }
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, WebhooksController.RETRY_DELAY))
            continue
          }

          // For other errors, log and return
          console.error(`Error processing webhook ${webhookId}:`, error)
          return response.status(200).send({ message: 'Webhook received' })
        }
      }

      // If we get here, all retries failed
      console.error(
        `Failed to process webhook ${webhookId} after ${WebhooksController.MAX_RETRIES} retries:`,
        lastError
      )
      return response.status(200).send({ message: 'Webhook received' })
    } catch (error) {
      console.error('Error processing webhook:', error)
      return response.status(200).send({ message: 'Webhook received' })
    } finally {
      logTaskBoundary(false, 'Webhook received')
    }
  }

  private async handleProductCreate(id: string) {
    console.info(`🚀 Handling product create: ${id}`)
    await this.handlePaintingCreate(id)
  }

  private async handlePaintingCreate(id: string) {
    const shopify = new Shopify()
    const product = await shopify.product.getProductById(id)
    const canProcess = shopify.product.modelCopier.canProcessPaintingCreate(product)
    if (!canProcess) return

    console.info(`🚀 Filling model data on product`)
    await shopify.product.modelCopier.copyModelDataFromImageRatio(product)
    console.info(`🚀 Data successfully copied on product ${id}`)
  }

  private async handleProductUpdate(id: string) {
    console.info(`🚀 Handling product update: ${id}`)

    // if the id come from a model, we need to update all related products
    await this.updateRelatedProductsFromModel(id)
  }

  private async updateRelatedProductsFromModel(id: string) {
    try {
      const shopify = new Shopify()
      const product = await shopify.product.getProductById(id)
      const isModel = shopify.product.modelCopier.isModelProduct(product)
      if (!isModel) return

      console.info(`🚀 Updating related products from model: ${id}`)
      const tag = shopify.product.modelCopier.getTagFromModel(product)

      const products = await shopify.product.getAll()
      const relatedProducts = products.filter((p) => {
        if (p.templateSuffix !== 'painting' && p.templateSuffix !== 'personalized') return false

        const pSecondImage = p.media.nodes[1]
        if (!pSecondImage?.image) return false

        const isModel = shopify.product.modelCopier.isModelProduct(p)
        if (isModel) return false

        const pTag = shopify.product.modelCopier.getTagFromProduct(p)
        return pTag === tag
      })

      // Process related products sequentially to avoid overwhelming the system
      for (const relatedProduct of relatedProducts) {
        if (!WebhooksController.processingProducts.has(relatedProduct.id)) {
          await this.handlePaintingCreate(relatedProduct.id)
        }
      }
      console.info(`🚀 Related products updated: ${relatedProducts.length}`)
    } catch (error) {
      console.error('Error updating related products with id:', id, error)
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

      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmac))
    } catch (error) {
      console.error('Error verifying webhook:', error)
      return false
    }
  }
}
