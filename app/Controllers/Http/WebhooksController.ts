import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Logger from '@ioc:Adonis/Core/Logger'
import crypto from 'crypto'
import Env from '@ioc:Adonis/Core/Env'
import Shopify from 'App/Services/Shopify'

export default class WebhooksController {
  public async handle({ request, response }: HttpContextContract) {
    try {
      const rawBody = (await request.raw()) ?? ''

      const isAuthentic = this.verifyWebhook(request, rawBody)
      if (!isAuthentic && Env.get('NODE_ENV') !== 'development') {
        Logger.warn('Invalid webhook signature received')
        return response.unauthorized({ error: 'Invalid webhook signature' })
      }

      const topic = request.header('X-Shopify-Topic')
      const shop = request.header('X-Shopify-Shop-Domain')
      const webhookId = request.header('X-Shopify-Webhook-Id')

      Logger.info(`Processing webhook: ${topic} from ${shop} (ID: ${webhookId})`)

      const { id } = request.body()
      if (!id) {
        Logger.warn('No ID found in webhook request')
        return response.status(200).send({ message: 'Webhook received' })
      }

      switch (topic) {
        case 'products/create':
          await this.handleProductCreate(id)
          break
        case 'products/update':
          await this.handleProductUpdate(id)
          break
        default:
          Logger.warn(`Unhandled webhook topic: ${topic}`)
      }

      return response.status(200).send({ message: 'Webhook received' })
    } catch (error) {
      Logger.error('Error processing webhook:', error)
      return response.status(200).send({ message: 'Webhook received' })
    }
  }

  private async handleProductCreate(id: string) {
    Logger.info(`🚀 Handling painting create: ${id}`)
    await this.handlePaintingCreate(id)
  }

  private async handlePaintingCreate(id: string) {
    Logger.info(`🚀 Filling model data on product`)
    const shopify = new Shopify()
    const product = await shopify.product.getProductById(id)
    if (!product) {
      Logger.warn(`Product not found: ${id}`)
      return
    }

    if (product.templateSuffix !== 'painting') return
    if (product.media.nodes.length < 1) return
    if (!product.media.nodes[1].image) return

    const imageWidth = product.media.nodes[1].image.width
    const imageHeight = product.media.nodes[1].image.height
    const ratio = imageWidth / imageHeight

    const isPersonalized = product.tags.includes('personnalisé')

    const tag = shopify.product.getTagByRatio(ratio, isPersonalized)
    const model = await shopify.product.getProductByTag(tag)
    await shopify.product.modelCopier.copyModelDataOnProduct(product, model)
    Logger.info(`🚀 Data successfully copied on product ${id}`)
  }

  private async handleProductUpdate(id: string) {
    Logger.info(`🚀 Handling painting update: ${id}`)
    await this.handlePaintingCreate(id)
  }

  private verifyWebhook(request: HttpContextContract['request'], rawBody: string): boolean {
    try {
      const secret = Env.get('SHOPIFY_CLIENT_SECRET')
      const hmac = request.header('X-Shopify-Hmac-Sha256')
      const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf-8').digest('base64')

      if (!hmac) {
        Logger.warn('No HMAC signature found in webhook request')
        return false
      }

      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmac))
    } catch (error) {
      Logger.error('Error verifying webhook:', error)
      return false
    }
  }
}
