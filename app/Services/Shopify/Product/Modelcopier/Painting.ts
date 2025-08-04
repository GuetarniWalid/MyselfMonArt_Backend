import { Product, ProductById, ProductByTag } from 'Types/Product'
import Shopify from '../..'
import ModelCopier from './index'

export default class PaintingCopier extends ModelCopier {
  public async copyModelDataOnProduct(product: ProductById, model: ProductByTag) {
    await this.deleteProductOptions(product)
    await this.copyModelOptions(product, model)
    await this.copyModelVariants(product, model)
    await this.copyModelMetafields(product, model)
    await this.translateProductOptionsInAllLanguages(product)
  }

  private async copyModelMetafields(product: ProductById, model: ProductByTag) {
    const shopify = new Shopify()

    for (const metafield of model.paintingOptionsMetafields.nodes) {
      await shopify.metafield.update(
        product.id,
        metafield.namespace,
        metafield.key,
        JSON.stringify(metafield.references.edges.map((edge) => edge.node.id))
      )
    }
  }

  public isModelProduct(product: ProductById | Product): boolean {
    return product.tags.some((tag) =>
      ['portrait model', 'paysage model', 'square model', 'personalized portrait model'].includes(
        tag
      )
    )
  }

  public canProcessProductCreate(product: ProductById | Product): boolean {
    if (!product) return false
    if (this.isModelProduct(product)) return false
    if (product.templateSuffix !== 'painting' && product.templateSuffix !== 'personalized')
      return false
    if (product.media.nodes.length < 1) return false
    if (!product.media.nodes[1].image) return false
    return true
  }

  public async waitForMediaImages(
    product: ProductById | Product,
    maxRetries: number = 5,
    delayMs: number = 2000
  ): Promise<boolean> {
    console.info(`🔄 Waiting for media images to load for product ${product.id}`)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Check if media images are loaded
      const hasImages = product.media.nodes.length > 0 && product.media.nodes[1]?.image !== null

      if (hasImages) {
        console.info(
          `✅ Media images loaded successfully for product ${product.id} on attempt ${attempt}`
        )
        return true
      }

      console.info(
        `⏳ Media images not ready for product ${product.id}, attempt ${attempt}/${maxRetries}`
      )

      if (attempt < maxRetries) {
        console.info(`⏳ Waiting ${delayMs}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))

        // Refresh product data to get updated media
        try {
          const shopify = new Shopify()
          const refreshedProduct = await shopify.product.getProductById(product.id)
          Object.assign(product, refreshedProduct)
        } catch (error) {
          console.warn(`⚠️ Failed to refresh product data on attempt ${attempt}:`, error.message)
        }
      }
    }

    console.warn(
      `❌ Media images failed to load after ${maxRetries} attempts for product ${product.id}`
    )
    return false
  }

  public async areMediaImagesLoaded(product: ProductById | Product): Promise<boolean> {
    if (!product) return false
    if (this.isModelProduct(product)) return false
    if (product.templateSuffix !== 'painting' && product.templateSuffix !== 'personalized')
      return false
    if (product.media.nodes.length < 1) return false

    // Wait for media images to be loaded
    const mediaLoaded = await this.waitForMediaImages(product)
    if (!mediaLoaded) {
      console.warn(`⚠️ Cannot process product ${product.id} - media images not available`)
      return false
    }

    if (!product.media.nodes[1].image) return false
    return true
  }

  public async copyModelDataFromImageRatio(product: ProductById) {
    const model = await this.getModelFromProduct(product)
    if (!model) return
    await this.copyModelDataOnProduct(product, model)
  }

  public async getModelFromProduct(product: ProductById) {
    const image = product.media.nodes[1]?.image
    if (!image) return

    const imageWidth = image.width
    const imageHeight = image.height
    const ratio = imageWidth / imageHeight

    const isPersonalized = product.tags.includes('personnalisé')

    const shopify = new Shopify()
    const tag = shopify.product.getTagByRatio(ratio, isPersonalized)
    const model = await shopify.product.getProductByTag(tag)
    return model
  }

  public getTagFromModel(product: ProductById | Product) {
    const tag = product.tags.find((tag) =>
      ['portrait model', 'paysage model', 'square model', 'personalized portrait model'].includes(
        tag
      )
    )
    if (!tag) throw new Error('Model tag not found')

    return tag
  }

  public getTagFromProduct(product: ProductById | Product) {
    const shopify = new Shopify()
    const image = product.media.nodes[1]?.image
    if (!image) {
      console.log(`No image found for product ${product.id}`)
      return null
    }

    const ratio = image.width / image.height
    const isPersonalized = product.tags.includes('personnalisé')
    const tag = shopify.product.getTagByRatio(ratio, isPersonalized)
    return tag
  }

  public areMetafieldsSimilar(product: ProductById, model: ProductByTag): boolean {
    if (!product.paintingOptionsMetafields?.nodes || !model.paintingOptionsMetafields?.nodes)
      return false
    if (
      product.paintingOptionsMetafields.nodes.length !==
      model.paintingOptionsMetafields.nodes.length
    )
      return false

    return product.paintingOptionsMetafields.nodes.every((productMetafield) => {
      const matchingModelMetafield = model.paintingOptionsMetafields.nodes.find(
        (modelMetafield) => {
          if (productMetafield.namespace !== modelMetafield.namespace) return false
          if (productMetafield.key !== modelMetafield.key) return false

          const productReferences = productMetafield.references.edges.map((edge) => edge.node.id)
          const modelReferences = modelMetafield.references.edges.map((edge) => edge.node.id)

          if (productReferences.length !== modelReferences.length) return false

          return productReferences.every((id) => modelReferences.includes(id))
        }
      )

      return !!matchingModelMetafield
    })
  }

  public getRelatedProducts(product: ProductById, products: Product[]) {
    const tag = this.getTagFromModel(product)

    return products.filter((p) => {
      if (p.templateSuffix !== 'painting' && p.templateSuffix !== 'personalized') return false

      const pSecondImage = p.media.nodes[1]
      if (!pSecondImage?.image) return false

      const isModel = this.isModelProduct(p)
      if (isModel) return false

      const pTag = this.getTagFromProduct(p)
      return pTag === tag
    })
  }
}
