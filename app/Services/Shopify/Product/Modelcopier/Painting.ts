import { Product, ProductById, ProductByTag } from 'Types/Product'
import Shopify from '../..'
import ModelCopier from './index'
import { DiffResult, MetafieldsDiff, CategoryDiff } from './types'

export default class PaintingCopier extends ModelCopier {
  /**
   * Main entry point - uses differential update system
   * Replaces legacy full recreation approach
   */
  public async copyModelDataOnProduct(product: ProductById, model: ProductByTag) {
    await this.updateProductDifferentially(product, model)
  }

  /**
   * Override compareProducts to add metafield comparison for paintings
   */
  protected compareProducts(product: ProductById, model: ProductByTag): DiffResult {
    const baseDiff = super.compareProducts(product, model)
    baseDiff.metafieldsDiff = this.compareMetafields(product, model)
    baseDiff.hasAnyChanges = baseDiff.hasAnyChanges || baseDiff.metafieldsDiff.needsUpdate
    return baseDiff
  }

  /**
   * Compare painting metafields between model and product
   * Identifies specific metafields that need updating
   */
  private compareMetafields(product: ProductById, model: ProductByTag): MetafieldsDiff {
    const diff: MetafieldsDiff = {
      needsUpdate: false,
      metafieldsToUpdate: [],
      metafieldsToDelete: [],
    }

    // Quick check using existing method
    if (this.areMetafieldsSimilar(product, model)) {
      return diff
    }

    const productMetafields = product.paintingOptionsMetafields?.nodes || []
    const modelMetafields = model.paintingOptionsMetafields?.nodes || []

    // Create a map of product metafields for quick lookup
    const productMetafieldsMap = new Map<string, (typeof productMetafields)[0]>()
    productMetafields.forEach((metafield) => {
      const key = `${metafield.namespace}:${metafield.key}`
      productMetafieldsMap.set(key, metafield)
    })

    // Check each model metafield
    modelMetafields.forEach((modelMetafield) => {
      const key = `${modelMetafield.namespace}:${modelMetafield.key}`
      const productMetafield = productMetafieldsMap.get(key)

      const modelValue = JSON.stringify(modelMetafield.references.edges.map((edge) => edge.node.id))

      if (!productMetafield) {
        // Metafield exists in model but not in product - add it
        diff.metafieldsToUpdate.push({
          namespace: modelMetafield.namespace,
          key: modelMetafield.key,
          value: modelValue,
        })
        diff.needsUpdate = true
      } else {
        // Check if value is different
        const productValue = JSON.stringify(
          productMetafield.references.edges.map((edge) => edge.node.id)
        )

        if (productValue !== modelValue) {
          diff.metafieldsToUpdate.push({
            namespace: modelMetafield.namespace,
            key: modelMetafield.key,
            value: modelValue,
          })
          diff.needsUpdate = true
        }
      }
    })

    // Find metafields to delete (in product but not in model)
    productMetafields.forEach((productMetafield) => {
      const key = `${productMetafield.namespace}:${productMetafield.key}`
      const hasMatchingModelMetafield = modelMetafields.some(
        (m) => `${m.namespace}:${m.key}` === key
      )

      if (!hasMatchingModelMetafield) {
        diff.metafieldsToDelete.push({
          namespace: productMetafield.namespace,
          key: productMetafield.key,
        })
        diff.needsUpdate = true
      }
    })

    // Compare painting.layout metafield (single metaobject reference)
    // This is a category-specific metafield available after setting the paintings category
    const productLayoutId = product.paintingLayoutMetafield?.reference?.id
    const modelLayoutId = model.paintingLayoutMetafield?.reference?.id

    if (modelLayoutId && productLayoutId !== modelLayoutId) {
      // Model has layout and it's different from product's layout (or product has no layout)
      diff.metafieldsToUpdate.push({
        namespace: 'painting',
        key: 'layout',
        value: modelLayoutId, // Single reference: use GID directly (not JSON.stringify)
      })
      diff.needsUpdate = true
    }

    // Note: If model doesn't have layout, we skip (don't modify product's layout)
    // This matches the behavior of other optional metafields

    return diff
  }

  /**
   * Update metafields selectively - only changed fields
   * More efficient than updating all metafields
   */
  protected async updateMetafieldsSelectively(product: ProductById, diff: MetafieldsDiff) {
    if (!diff.needsUpdate) return

    const shopify = new Shopify()

    // Update changed metafields
    for (const metafield of diff.metafieldsToUpdate) {
      try {
        await shopify.metafield.update(
          product.id,
          metafield.namespace,
          metafield.key,
          metafield.value
        )
      } catch (error) {
        console.error(
          `⚠️  Failed to update metafield ${metafield.namespace}.${metafield.key}:`,
          error.message
        )
      }
    }

    // Note: Metafield deletion not implemented yet as it requires different API
    // For now, we only update existing or add new metafields
    if (diff.metafieldsToDelete.length > 0) {
      console.warn(
        `⚠️  ${diff.metafieldsToDelete.length} metafields should be deleted but deletion not implemented`
      )
    }
  }

  /**
   * Override to add metafield update logic specific to paintings
   * Called by base class orchestrator after options/variants are updated
   */
  protected async updateMetafieldsIfNeeded(product: ProductById, diff: DiffResult): Promise<void> {
    if (!diff.metafieldsDiff?.needsUpdate) {
      return
    }

    console.info(`🏷️  Updating metafields`)

    // Enhanced logging to distinguish between different metafield types
    const paintingOptionsCount = diff.metafieldsDiff.metafieldsToUpdate.filter(
      (m) => m.namespace === 'painting_options'
    ).length
    const layoutCount = diff.metafieldsDiff.metafieldsToUpdate.filter(
      (m) => m.namespace === 'painting' && m.key === 'layout'
    ).length

    if (paintingOptionsCount > 0) {
      console.info(`   - Metafields: ${paintingOptionsCount} painting_options to update`)
    }
    if (layoutCount > 0) {
      console.info(`   - Metafields: painting.layout to update`)
    }

    if (diff.metafieldsDiff.metafieldsToDelete.length > 0) {
      console.warn(
        `     ⚠️  Note: ${diff.metafieldsDiff.metafieldsToDelete.length} metafield(s) should be deleted but automatic deletion is not yet implemented. Manual cleanup may be required.`
      )
    }

    try {
      await this.updateMetafieldsSelectively(product, diff.metafieldsDiff)
    } catch (error) {
      console.warn(`⚠️  Metafield update failed for ${product.id}: ${error.message}`)
      // Don't throw - metafield failures shouldn't stop translation
    }
  }

  /**
   * Compare category between product and model
   * Returns needsUpdate: true if product's category differs from model's category
   * Only applies to regular paintings (templateSuffix === 'painting')
   */
  protected compareCategory(product: ProductById, model: ProductByTag): CategoryDiff | undefined {
    // Only set category for regular paintings (not personalized, not models)
    if (product.templateSuffix !== 'painting') {
      return undefined
    }

    // Get category from model (source of truth)
    const modelCategoryGid = model.category?.id

    // If model doesn't have a category, skip (nothing to copy)
    if (!modelCategoryGid) {
      return undefined
    }

    const currentCategoryGid = product.category?.id

    // Check if category needs to be copied from model
    const needsUpdate = currentCategoryGid !== modelCategoryGid

    return {
      needsUpdate,
      categoryGid: modelCategoryGid, // Copy from model
    }
  }

  /**
   * Set product category for paintings
   * Copies category from model to product
   * Called by base class orchestrator when categoryDiff.needsUpdate is true
   */
  protected async updateCategoryIfNeeded(product: ProductById, diff: DiffResult): Promise<void> {
    if (!diff.categoryDiff?.needsUpdate) {
      return
    }

    const shopify = new Shopify()

    try {
      console.info(`🏷️  Copying category from model`)
      await shopify.category.setProductCategory(product.id, diff.categoryDiff.categoryGid)
      console.info(`✅ Category copied successfully`)
    } catch (error) {
      console.error(`❌ Failed to copy category: ${error.message}`)
      // Don't throw - category failure shouldn't block other updates
      // Product remains functional, category can be set manually if needed
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

    // Validate image dimensions before calculating ratio
    if (!imageWidth || !imageHeight || imageWidth <= 0 || imageHeight <= 0) {
      console.warn(
        `⚠️  Invalid image dimensions for product ${product.id}: width=${imageWidth}, height=${imageHeight}. Cannot determine model.`
      )
      return
    }

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

    // Validate image dimensions before calculating ratio
    if (!image.width || !image.height || image.width <= 0 || image.height <= 0) {
      console.warn(
        `⚠️  Invalid image dimensions for product ${product.id}: width=${image.width}, height=${image.height}. Cannot determine tag.`
      )
      return null
    }

    const ratio = image.width / image.height
    const isPersonalized = product.tags.includes('personnalisé')
    const tag = shopify.product.getTagByRatio(ratio, isPersonalized)
    return tag
  }

  public areMetafieldsSimilar(product: ProductById, model: ProductByTag): boolean {
    // Check painting_options metafields
    if (!product.paintingOptionsMetafields?.nodes || !model.paintingOptionsMetafields?.nodes)
      return false
    if (
      product.paintingOptionsMetafields.nodes.length !==
      model.paintingOptionsMetafields.nodes.length
    )
      return false

    const paintingOptionsMatch = product.paintingOptionsMetafields.nodes.every(
      (productMetafield) => {
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
      }
    )

    if (!paintingOptionsMatch) return false

    // Also check painting.layout metafield
    const productLayoutId = product.paintingLayoutMetafield?.reference?.id
    const modelLayoutId = model.paintingLayoutMetafield?.reference?.id

    // Layouts match if both are undefined/null OR if both have the same GID
    return productLayoutId === modelLayoutId
  }

  public getRelatedProducts(products: Product[], product: ProductById) {
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
