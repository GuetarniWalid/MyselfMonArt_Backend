import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import crypto from 'crypto'
import Env from '@ioc:Adonis/Core/Env'
import Shopify from 'App/Services/Shopify'

export default class WebhooksController {
  public async handle({ request, response }: HttpContextContract) {
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

      console.info(`Processing webhook: ${topic} from ${shop} (ID: ${webhookId})`)

      const { id } = request.body()
      if (!id) {
        console.warn('No ID found in webhook request')
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
          console.warn(`Unhandled webhook topic: ${topic}`)
      }

      return response.status(200).send({ message: 'Webhook received' })
    } catch (error) {
      console.error('Error processing webhook:', error)
      return response.status(200).send({ message: 'Webhook received' })
    }
  }

  private async handleProductCreate(id: string) {
    console.info(`🚀 Handling painting create: ${id}`)
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

    await this.handlePaintingCreate(id)
    await this.updateRelatedProductsFromModel(id)
  }

  private async updateRelatedProductsFromModel(id: string) {
    const shopify = new Shopify()
    const product = await shopify.product.getProductById(id)
    const isModel = shopify.product.modelCopier.isModelProduct(product)
    if (!isModel) return

    console.info(`🚀 Updating related products from model: ${id}`)
    const tag = shopify.product.modelCopier.getTagFromModel(product)

    const products = await shopify.product.getAll()
    const relatedProducts = products.filter((p) => {
      if (p.templateSuffix !== 'painting') return false

      const pSecondImage = p.media.nodes[1]
      if (!pSecondImage?.image) return false

      const isModel = shopify.product.modelCopier.isModelProduct(p)
      if (isModel) return false

      const pTag = shopify.product.modelCopier.getTagFromProduct(p)
      return pTag === tag
    })

    for (const relatedProduct of relatedProducts) {
      await this.handlePaintingCreate(relatedProduct.id)
    }
    console.info(`🚀 Related products updated: ${relatedProducts.length}`)
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
