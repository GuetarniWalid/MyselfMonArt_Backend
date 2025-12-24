import { Product, ProductById, ProductByTag } from 'Types/Product'
import Shopify from '../..'
import ChatGPT from 'App/Services/ChatGPT'
import { LanguageCode, RegionCode } from 'Types/Translation'
import { DiffResult, OptionsDiff, VariantsDiff, BundleMetafieldDiff } from './types'

export default abstract class ModelCopier {
  public abstract isModelProduct(product: ProductById | Product): boolean
  public abstract canProcessProductCreate(product: ProductById | Product): boolean
  public abstract getTagFromProduct(product: ProductById | Product): string | null

  protected async deleteProductOptions(product: ProductById) {
    const shopify = new Shopify()
    await shopify.product.deleteAllOptions(product.id)
  }

  protected async copyModelOptions(product: ProductById, model: ProductByTag) {
    const shopify = new Shopify()
    await shopify.product.createOptions(
      product.id,
      model.options.map((option) => ({
        name: option.name,
        values: option.values,
      }))
    )
  }

  protected async copyModelVariants(product: ProductById, model: ProductByTag) {
    const shopify = new Shopify()

    const modelVariants = model.variants.nodes
    if (!modelVariants) return

    const defaultVariant = product.variants.nodes[0]
    const variants = modelVariants.map((variant) => ({
      price: variant.price,
      optionValues: variant.selectedOptions.map((option) => ({
        name: option.value,
        optionName: option.name,
      })),
    }))

    const [defaultModelVariant, ...variantsWithoutDefault] = variants
    await shopify.product.updateVariant(product.id, defaultVariant.id, {
      price: defaultModelVariant.price,
    })
    await shopify.product.createVariantsBulk(product.id, variantsWithoutDefault)
  }

  protected async translateProductOptionsInAllLanguages(product: ProductById) {
    await this.translateProductOptions(product, 'en')
    await this.translateProductOptions(product, 'en', 'UK')
  }

  private async translateProductOptions(
    product: ProductById,
    locale: LanguageCode,
    region?: RegionCode
  ) {
    console.info(
      `🚀 Translating product options: ${product.id} to ${locale}${region ? `-${region}` : ''}`
    )
    const shopify = new Shopify()
    const chatGPT = new ChatGPT()

    const updatedProduct = await shopify.product.getProductById(product.id)

    const productToTranslate = {
      id: updatedProduct.id,
      options: updatedProduct.options.map((option) => ({
        id: option.id,
        name: option.name,
        optionValues: option.optionValues.map((value) => ({
          id: value.id,
          name: value.name,
        })),
      })),
    }

    const productTranslated = await chatGPT.translate(productToTranslate, 'product', locale, region)

    const responses = await shopify.translator('product').updateTranslation({
      resourceToTranslate: productToTranslate,
      resourceTranslated: productTranslated,
      isoCode: locale,
      region,
    })

    responses.forEach((response) => {
      if (response.translationsRegister.userErrors.length > 0) {
        console.log('🚨 Error => ', response.translationsRegister.userErrors)
      } else {
        console.log('✅ Translation updated')
      }
    })
  }

  public areOptionsSimilar(product: ProductById, model: ProductByTag): boolean {
    if (!product.options || !model.options) return false
    if (product.options.length !== model.options.length) return false

    return product.options.every((productOption, index) => {
      const modelOption = model.options[index]

      if (productOption.name !== modelOption.name) return false
      if (productOption.optionValues.length !== modelOption.values.length) return false

      // Check that values match AND are in the same order (not just present)
      return productOption.optionValues.every((value, valueIndex) => {
        return value.name === modelOption.values[valueIndex]
      })
    })
  }

  public areVariantsSimilar(product: ProductById, model: ProductByTag): boolean {
    if (!product.variants?.nodes || !model.variants?.nodes) return false
    if (product.variants.nodes.length !== model.variants.nodes.length) return false

    return product.variants.nodes.every((productVariant) => {
      const matchingModelVariant = model.variants.nodes.find((modelVariant) => {
        if (productVariant.price !== modelVariant.price) return false

        const optionsMatch = productVariant.selectedOptions.every((productOption) => {
          const hasMatchingOption = modelVariant.selectedOptions.some(
            (modelOption) =>
              modelOption.name === productOption.name && modelOption.value === productOption.value
          )
          if (!hasMatchingOption) return false
          return hasMatchingOption
        })

        return optionsMatch
      })

      return !!matchingModelVariant
    })
  }

  /**
   * Compare model and product to detect all differences
   * Returns a unified diff result with all changes needed
   * @param skipVariants - Skip variant comparison (used when options will change and variants will be re-compared)
   */
  protected compareProducts(
    product: ProductById,
    model: ProductByTag,
    skipVariants: boolean = false
  ): DiffResult {
    const optionsDiff = this.compareOptions(product, model)

    // Skip variant comparison if options will change (optimization)
    // Variants will be re-compared after options are updated with fresh product data
    const variantsDiff = skipVariants
      ? { needsUpdate: false, variantsToUpdate: [], variantsToDelete: [], variantsToCreate: [] }
      : this.compareVariants(product, model)

    const bundleMetafieldDiff = this.compareBundleMetafield(product, model)

    return {
      optionsDiff,
      variantsDiff,
      bundleMetafieldDiff,
      hasAnyChanges:
        optionsDiff.needsUpdate ||
        variantsDiff.needsUpdate ||
        (bundleMetafieldDiff?.needsUpdate ?? false),
    }
  }

  /**
   * Compare options between model and product
   * Detects structural changes (options added/removed) and value changes
   */
  protected compareOptions(product: ProductById, model: ProductByTag): OptionsDiff {
    const diff: OptionsDiff = {
      needsUpdate: false,
      hasStructuralChanges: false,
      optionsToCreate: [],
      optionsToDelete: [],
      optionValuesToUpdate: {},
    }

    // Quick check using existing method
    if (this.areOptionsSimilar(product, model)) {
      return diff
    }

    const productOptions = product.options || []
    const modelOptions = model.options || []

    // Validation: Warn if model has 0 options but product has options
    if (modelOptions.length === 0 && productOptions.length > 0) {
      console.warn(
        `⚠️  Model has 0 options but product has ${productOptions.length} option(s). This will DELETE all product options and variants.`
      )
    }

    // Check for structural changes (options added/removed)
    if (productOptions.length !== modelOptions.length) {
      diff.hasStructuralChanges = true
      diff.needsUpdate = true

      // Find options to delete (in product but not in model)
      productOptions.forEach((productOption, index) => {
        const modelOption = modelOptions[index]
        if (!modelOption || productOption.name !== modelOption.name) {
          diff.optionsToDelete.push(productOption.id)
        }
      })

      // Find options to create (in model but not in product)
      modelOptions.forEach((modelOption, index) => {
        const productOption = productOptions[index]
        if (!productOption || productOption.name !== modelOption.name) {
          // Validation: Ensure option has values
          if (!modelOption.values || modelOption.values.length === 0) {
            console.warn(`⚠️  Model option '${modelOption.name}' has no values, skipping creation`)
            return
          }
          diff.optionsToCreate.push({
            name: modelOption.name,
            values: modelOption.values,
          })
        }
      })

      return diff
    }

    // No structural changes in count, check for value differences within existing options
    // Use for loop instead of forEach to allow proper early exit with break
    for (let index = 0; index < productOptions.length; index++) {
      const productOption = productOptions[index]
      const modelOption = modelOptions[index]

      // If option names don't match at same position, treat as structural change
      // This means option order changed or option renamed - trigger full recreation
      if (!modelOption || productOption.name !== modelOption.name) {
        if (modelOption) {
          console.info(
            `🔄 Option at position ${index} changed: '${productOption.name}' → '${modelOption.name}'. This will trigger full options recreation.`
          )
        }
        diff.hasStructuralChanges = true
        diff.needsUpdate = true
        // Don't process further - will use full recreation path
        break
      }

      const productValues = productOption.optionValues.map((v) => v.name)
      const modelValues = modelOption.values

      // Find values to add and remove (for logging)
      const valuesToAdd = modelValues.filter((v) => !productValues.includes(v))
      const valuesToRemove = productValues.filter((v) => !modelValues.includes(v))

      // If there are any differences, store the complete final state from model
      if (valuesToAdd.length > 0 || valuesToRemove.length > 0) {
        diff.optionValuesToUpdate[productOption.id] = {
          finalValues: modelValues, // Use model as source of truth for ordering
          currentValues: productValues,
          valuesToAdd,
          valuesToRemove,
        }
        diff.needsUpdate = true
      }
    }

    return diff
  }

  /**
   * Compare variants between model and product
   * Detects price changes and missing/extra variants
   */
  protected compareVariants(product: ProductById, model: ProductByTag): VariantsDiff {
    const diff: VariantsDiff = {
      needsUpdate: false,
      variantsToUpdate: [],
      variantsToDelete: [],
      variantsToCreate: [],
    }

    // Quick check using existing method
    if (this.areVariantsSimilar(product, model)) {
      return diff
    }

    const productVariants = product.variants?.nodes || []
    const modelVariants = model.variants?.nodes || []

    // Validation: Handle model with 0 variants
    if (modelVariants.length === 0) {
      if (productVariants.length > 0) {
        console.warn(
          `⚠️  Model has 0 variants but product has ${productVariants.length} variant(s). This will DELETE all product variants to match model.`
        )
        // Mark all product variants for deletion to match model
        diff.variantsToDelete = productVariants.map((v) => v.id)
        diff.needsUpdate = true
      }
      return diff
    }

    // Create a map of model variants by their option values for quick lookup
    const modelVariantsMap = new Map<string, (typeof modelVariants)[0]>()
    modelVariants.forEach((variant) => {
      // Validation: Skip variants without valid price (null, undefined, empty string)
      // Note: '0.00' is a valid price for free products
      if (variant.price === null || variant.price === undefined || variant.price === '') {
        console.warn(
          `⚠️  Model variant has invalid price (null/undefined/empty): ${JSON.stringify(variant.selectedOptions)}, skipping`
        )
        return
      }

      const key = variant.selectedOptions
        .map((opt) => `${opt.name}:${opt.value}`)
        .sort()
        .join('|')
      modelVariantsMap.set(key, variant)
    })

    // Check each product variant
    productVariants.forEach((productVariant) => {
      const key = productVariant.selectedOptions
        .map((opt) => `${opt.name}:${opt.value}`)
        .sort()
        .join('|')

      const matchingModelVariant = modelVariantsMap.get(key)

      if (!matchingModelVariant) {
        // Variant exists in product but not in model - mark for deletion
        diff.variantsToDelete.push(productVariant.id)
        diff.needsUpdate = true
      } else if (productVariant.price !== matchingModelVariant.price) {
        // Variant exists but price is different - mark for update
        // Validation: Ensure price is valid (not null/undefined/empty)
        if (
          matchingModelVariant.price !== null &&
          matchingModelVariant.price !== undefined &&
          matchingModelVariant.price !== ''
        ) {
          diff.variantsToUpdate.push({
            id: productVariant.id,
            price: matchingModelVariant.price,
            inventoryPolicy: productVariant.inventoryPolicy, // Preserve existing inventory policy
          })
          diff.needsUpdate = true
        }
      }
    })

    // Create a map of product variants for checking what's missing
    const productVariantsMap = new Map<string, (typeof productVariants)[0]>()
    productVariants.forEach((variant) => {
      const key = variant.selectedOptions
        .map((opt) => `${opt.name}:${opt.value}`)
        .sort()
        .join('|')
      productVariantsMap.set(key, variant)
    })

    // Find variants in model but not in product - mark for creation
    modelVariants.forEach((modelVariant) => {
      const key = modelVariant.selectedOptions
        .map((opt) => `${opt.name}:${opt.value}`)
        .sort()
        .join('|')

      if (!productVariantsMap.has(key)) {
        // Validation: Only create variants with valid price (not null/undefined/empty)
        if (
          modelVariant.price !== null &&
          modelVariant.price !== undefined &&
          modelVariant.price !== ''
        ) {
          diff.variantsToCreate.push({
            price: modelVariant.price,
            optionValues: modelVariant.selectedOptions.map((opt) => ({
              name: opt.value,
              optionName: opt.name,
            })),
            inventoryPolicy: modelVariant.inventoryPolicy, // Inherit from model
          })
          diff.needsUpdate = true
        }
      }
    })

    return diff
  }

  /**
   * Compare bundle.products metafield between model and product
   * This metafield contains product references that should match the model
   */
  protected compareBundleMetafield(
    product: ProductById,
    model: ProductByTag
  ): BundleMetafieldDiff | undefined {
    const productMetafield = product.bundleProductsMetafield
    const modelMetafield = model.bundleProductsMetafield

    // If neither has the metafield, no update needed
    if (!productMetafield && !modelMetafield) {
      return undefined
    }

    // If model doesn't have it but product does, clear it to align with model
    if (!modelMetafield && productMetafield) {
      return {
        needsUpdate: true,
        productReferences: [], // Empty array signals deletion/clearing
      }
    }

    // Get product references from model
    const modelReferences = modelMetafield?.references?.edges?.map((edge) => edge.node.id) || []

    // If product doesn't have the metafield but model does, we need to create it
    if (modelMetafield && !productMetafield) {
      return {
        needsUpdate: true,
        productReferences: modelReferences,
      }
    }

    // Compare references
    const productReferences = productMetafield?.references?.edges?.map((edge) => edge.node.id) || []

    // Check if references are different
    const referencesMatch =
      productReferences.length === modelReferences.length &&
      productReferences.every((ref) => modelReferences.includes(ref))

    if (!referencesMatch) {
      return {
        needsUpdate: true,
        productReferences: modelReferences,
      }
    }

    return undefined
  }

  /**
   * Determine if translation is needed based on changes
   * Translation only needed if options changed
   */
  protected shouldTranslate(diff: DiffResult): boolean {
    return diff.optionsDiff.needsUpdate
  }

  /**
   * Determine if full options recreation is needed
   * Only needed if options were added/removed (structural changes)
   */
  protected needsFullOptionsRecreation(diff: OptionsDiff): boolean {
    return diff.hasStructuralChanges
  }

  /**
   * Wait for Shopify to finish creating variants after option changes
   * Shopify creates variants asynchronously, so we need retry logic
   */
  protected async waitForVariantsAfterOptionChange(
    productId: string,
    maxRetries: number = 3,
    delayMs: number = 2000
  ): Promise<ProductById> {
    const shopify = new Shopify()

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const product = await shopify.product.getProductById(productId)

        // Check if variants exist (Shopify might still be creating them)
        if (!product.variants?.nodes || product.variants.nodes.length === 0) {
          if (attempt < maxRetries) {
            console.info(
              `⏳ Variants not ready yet, waiting ${delayMs}ms before retry (attempt ${attempt}/${maxRetries})`
            )
            await new Promise((resolve) => setTimeout(resolve, delayMs))
            continue
          } else {
            console.warn(
              `⚠️  No variants found after ${maxRetries} retries. Proceeding anyway - this may cause all model variants to be recreated.`
            )
          }
        }

        return product
      } catch (error) {
        if (attempt < maxRetries) {
          console.warn(
            `⚠️  Failed to fetch product (attempt ${attempt}/${maxRetries}): ${error.message}`
          )
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        } else {
          console.error(`❌ Failed to fetch product after ${maxRetries} retries`)
          throw new Error(`Failed to refetch product ${productId}: ${error.message}`)
        }
      }
    }

    throw new Error(`Failed to fetch product ${productId} after ${maxRetries} retries`)
  }

  /**
   * Update product options selectively without full recreation
   * Adds/removes values from existing options efficiently
   * Note: Orchestrator will refetch product after calling this method
   */
  protected async updateOptionsSelectively(product: ProductById, diff: OptionsDiff): Promise<void> {
    const shopify = new Shopify()

    // Delete removed options
    if (diff.optionsToDelete.length > 0) {
      await shopify.product.deleteOptions(product.id, diff.optionsToDelete)
    }

    // Create new options
    if (diff.optionsToCreate.length > 0) {
      await shopify.product.createOptions(product.id, diff.optionsToCreate)
    }

    // If we had structural changes (delete/create), we need to refetch to get fresh option IDs
    // before processing value changes
    let productForValueChanges = product
    if (diff.optionsToDelete.length > 0 || diff.optionsToCreate.length > 0) {
      console.info(`🔄 Refetching product to get updated option IDs after structural changes`)
      productForValueChanges = await shopify.product.getProductById(product.id)
    }

    // Update option values using complete final state from model
    // This preserves the model's ordering exactly
    const optionIdsToUpdate = Object.keys(diff.optionValuesToUpdate)
    const errors: string[] = []

    for (const optionId of optionIdsToUpdate) {
      const { finalValues, currentValues } = diff.optionValuesToUpdate[optionId]
      const option = productForValueChanges.options.find((opt) => opt.id === optionId)

      if (!option) {
        console.warn(`⚠️  Option ${optionId} not found in product, skipping value changes`)
        continue
      }

      // Validation: Ensure final values not empty
      if (finalValues.length === 0) {
        console.warn(`⚠️  Model has no values for option ${option.name}, skipping`)
        continue
      }

      // Validation: Check for duplicate values in model
      const uniqueValues = new Set(finalValues)
      if (uniqueValues.size !== finalValues.length) {
        const duplicates = finalValues.filter((v, i) => finalValues.indexOf(v) !== i)
        console.warn(
          `⚠️  Model has duplicate values for option ${option.name}: [${duplicates.join(', ')}]. This may cause issues.`
        )
      }

      // Use the complete final state from model (preserves ordering)
      try {
        await shopify.product.updateOptionValues(
          product.id,
          optionId,
          option.name,
          finalValues,
          currentValues
        )
      } catch (error) {
        const errorMsg = `Failed to update option ${option.name}: ${error.message}`
        errors.push(errorMsg)
        console.error(`⚠️  ${errorMsg}`)
      }
    }

    // If any option updates failed, throw with summary
    if (errors.length > 0) {
      throw new Error(
        `Partial option update failure for ${product.id}:\n${errors.join('\n')}\n` +
          `Product may be in inconsistent state. Manual review recommended.`
      )
    }
  }

  /**
   * Update only variant prices without recreating variants
   * Most efficient update path for price-only changes
   */
  protected async updateVariantsPricesOnly(product: ProductById, diff: VariantsDiff) {
    if (diff.variantsToUpdate.length === 0) return

    const shopify = new Shopify()
    await shopify.product.updateVariantsPricesBulk(product.id, diff.variantsToUpdate)
  }

  /**
   * Sync variants: create missing ones, update prices, delete extra ones
   * Used when variants need to be added/removed, not just price updates
   * Order is important: create first, then delete to ensure product always has variants
   */
  protected async syncVariants(product: ProductById, diff: VariantsDiff) {
    const shopify = new Shopify()
    const errors: string[] = []

    // Shopify limit validation: products can have max 100 variants
    const currentVariantCount = product.variants?.nodes?.length || 0
    const finalVariantCount =
      currentVariantCount + diff.variantsToCreate.length - diff.variantsToDelete.length

    if (finalVariantCount > 100) {
      throw new Error(
        `Variant limit exceeded: Product ${product.id} would have ${finalVariantCount} variants (Shopify max: 100). Current: ${currentVariantCount}, Creating: ${diff.variantsToCreate.length}, Deleting: ${diff.variantsToDelete.length}`
      )
    }

    // Create variants that exist in model but not in product (do this FIRST)
    if (diff.variantsToCreate.length > 0) {
      try {
        await this.createVariantsWithBatching(shopify, product.id, diff.variantsToCreate)
      } catch (error) {
        // Include first few variant combinations in error message for debugging
        const sampleVariants = diff.variantsToCreate
          .slice(0, 3)
          .map((v) => v.optionValues.map((opt) => `${opt.optionName}:${opt.name}`).join(', '))
          .join(' | ')
        const moreVariants =
          diff.variantsToCreate.length > 3 ? ` (+${diff.variantsToCreate.length - 3} more)` : ''
        const errorMsg = `Failed to create ${diff.variantsToCreate.length} variant(s) [${sampleVariants}${moreVariants}]: ${error.message}`
        errors.push(errorMsg)
        // Don't throw yet - try to complete other operations
        console.error(`⚠️  ${errorMsg}`)
      }
    }

    // Update prices on existing variants
    if (diff.variantsToUpdate.length > 0) {
      try {
        await shopify.product.updateVariantsPricesBulk(product.id, diff.variantsToUpdate)
      } catch (error) {
        const errorMsg = `Failed to update ${diff.variantsToUpdate.length} variant price(s): ${error.message}`
        errors.push(errorMsg)
        console.error(`⚠️  ${errorMsg}`)
      }
    }

    // Delete variants that don't exist in model (do this LAST)
    // This ensures the product always has at least one variant during the process
    if (diff.variantsToDelete.length > 0) {
      try {
        await shopify.product.deleteVariants(product.id, diff.variantsToDelete)
      } catch (error) {
        const errorMsg = `Failed to delete ${diff.variantsToDelete.length} variant(s): ${error.message}`
        errors.push(errorMsg)
        console.error(`⚠️  ${errorMsg}`)
      }
    }

    // If any operations failed, throw with summary
    if (errors.length > 0) {
      throw new Error(
        `Partial variant sync failure for ${product.id}:\n${errors.join('\n')}\n` +
          `Product may be in inconsistent state. Manual review recommended.`
      )
    }
  }

  /**
   * Create variants with batching for products with >100 variants
   * Shopify's productVariantsBulkCreate accepts max 100 variants per call
   * Daily limit: 1,000 variants/day after 50,000 total store variants
   * Includes retry logic with exponential backoff up to 24h for daily limit errors
   */
  protected async createVariantsWithBatching(
    shopify: Shopify,
    productId: string,
    variants: Array<{
      price: string
      optionValues: Array<{ name: string; optionName: string }>
      inventoryPolicy?: 'DENY' | 'CONTINUE'
    }>
  ): Promise<void> {
    const BATCH_SIZE = 100 // Shopify's maximum per API call
    const DELAY_BETWEEN_BATCHES = 1000 // 1 second between batches

    if (variants.length <= BATCH_SIZE) {
      // ≤100 variants - create all at once with retry logic
      await this.createVariantsBulkWithRetry(shopify, productId, variants)
      return
    }

    // Large number of variants - batch with delays
    console.info(`   Creating ${variants.length} variants in batches of ${BATCH_SIZE}...`)

    for (let i = 0; i < variants.length; i += BATCH_SIZE) {
      const batch = variants.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(variants.length / BATCH_SIZE)

      console.info(
        `   📦 Batch ${batchNumber}/${totalBatches}: Creating ${batch.length} variants...`
      )

      await this.createVariantsBulkWithRetry(shopify, productId, batch)
      console.info(`   ✅ Batch ${batchNumber}/${totalBatches} completed`)

      // Add delay between batches (except for the last batch)
      if (i + BATCH_SIZE < variants.length) {
        console.info(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`)
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
      }
    }

    console.info(`   ✅ All ${variants.length} variants created successfully`)
  }

  /**
   * Creates variants with special retry logic for daily limit errors
   *
   * Note: General API errors (throttling, network issues, etc.) are already
   * handled by Authentication.retryWithBackoff(). This method only adds
   * special handling for Shopify's "Daily variant creation limit" error,
   * which requires much longer retry delays (up to 24 hours).
   *
   * Retries up to 6 times with delays: 1min → 5min → 15min → 1h → 6h → 24h
   */
  protected async createVariantsBulkWithRetry(
    shopify: Shopify,
    productId: string,
    variants: Array<{
      price: string
      optionValues: Array<{ name: string; optionName: string }>
      inventoryPolicy?: 'DENY' | 'CONTINUE'
    }>
  ): Promise<void> {
    // Exponential backoff delays for daily limit (in milliseconds)
    // Much longer than Authentication.retryWithBackoff() delays since daily limit resets at midnight UTC
    const DAILY_LIMIT_RETRY_DELAYS = [
      1 * 60 * 1000, // 1 minute
      5 * 60 * 1000, // 5 minutes
      15 * 60 * 1000, // 15 minutes
      60 * 60 * 1000, // 1 hour
      6 * 60 * 60 * 1000, // 6 hours
      24 * 60 * 60 * 1000, // 24 hours
    ]

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= DAILY_LIMIT_RETRY_DELAYS.length; attempt++) {
      try {
        // Authentication layer will handle general retries (throttling, network errors, etc.)
        await shopify.product.createVariantsBulk(productId, variants)
        return // Success!
      } catch (error) {
        lastError = error

        // Check if it's specifically the daily variant limit error
        const isDailyLimitError = error.message?.includes('Daily variant creation limit')

        if (!isDailyLimitError) {
          // Not a daily limit error - let it bubble up
          // (Authentication layer already retried general errors)
          throw error
        }

        // Hit daily limit - check if we should retry
        if (attempt >= DAILY_LIMIT_RETRY_DELAYS.length) {
          console.error(`   ❌ Hit daily variant creation limit after ${attempt + 1} attempts`)
          console.error(
            `   💡 Shopify limits variant creation to 1,000/day after 50,000 total variants`
          )
          throw new Error(
            `Daily variant limit reached for ${variants.length} variants after ${attempt + 1} retry attempts. ` +
              `Manual intervention required.`
          )
        }

        // Calculate retry delay
        const delayMs = DAILY_LIMIT_RETRY_DELAYS[attempt]
        const delayMinutes = Math.floor(delayMs / 1000 / 60)
        const delayHours = delayMinutes >= 60 ? Math.floor(delayMinutes / 60) : 0
        const remainingMinutes = delayMinutes % 60

        let delayText = ''
        if (delayHours > 0) {
          delayText =
            remainingMinutes > 0 ? `${delayHours}h ${remainingMinutes}m` : `${delayHours}h`
        } else {
          delayText = `${delayMinutes}m`
        }

        const now = new Date()
        const retryTime = new Date(now.getTime() + delayMs)

        console.warn(
          `   ⚠️  Hit daily variant creation limit (attempt ${attempt + 1}/${DAILY_LIMIT_RETRY_DELAYS.length + 1})`
        )
        console.warn(`   ⏰ Will retry in ${delayText} at ${retryTime.toLocaleTimeString()}`)
        console.warn(`   💤 Waiting for daily limit to reset...`)

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delayMs))

        console.info(
          `   🔄 Retrying variant creation for ${productId} (attempt ${attempt + 2}/${DAILY_LIMIT_RETRY_DELAYS.length + 1})...`
        )
      }
    }

    throw lastError || new Error('Failed to create variants after all retry attempts')
  }

  /**
   * Main orchestrator method - updates product using differential approach
   * Only updates what has changed between model and product
   * Replaces the legacy full recreation approach
   */
  protected async updateProductDifferentially(product: ProductById, model: ProductByTag) {
    console.info(`🔍 Comparing product ${product.id} with model`)

    try {
      // Compare products to detect all differences
      // Note: compareProducts calls compareOptions internally, which is necessary
      // to determine if we should skip variant comparison
      const initialDiff = this.compareProducts(product, model)

      // Early return if nothing changed
      if (!initialDiff.hasAnyChanges) {
        console.info(`⏭️  No changes detected for ${product.id}, skipping`)
        return
      }

      console.info(`📝 Changes detected for ${product.id}:`)
      if (initialDiff.optionsDiff.needsUpdate) {
        this.logOptionChanges(initialDiff.optionsDiff, product)
      }
      if (initialDiff.variantsDiff.needsUpdate) {
        console.info(
          `   - Variants: ${initialDiff.variantsDiff.variantsToUpdate.length} to update, ${initialDiff.variantsDiff.variantsToCreate.length} to create, ${initialDiff.variantsDiff.variantsToDelete.length} to delete`
        )
      }
      if (initialDiff.bundleMetafieldDiff?.needsUpdate) {
        const refCount = initialDiff.bundleMetafieldDiff.productReferences.length
        if (refCount === 0) {
          console.info(`   - Bundle metafield: Will be cleared (model has no references)`)
        } else {
          console.info(`   - Bundle metafield: ${refCount} product reference(s) to update`)
        }
      }

      const diff = initialDiff

      // Update options if needed
      if (diff.optionsDiff.needsUpdate) {
        try {
          if (this.needsFullOptionsRecreation(diff.optionsDiff)) {
            console.info(`🔄 Recreating options (structural changes detected)`)
            await this.deleteProductOptions(product)
            await this.copyModelOptions(product, model)
          } else {
            console.info(`🔄 Updating options (smart merge)`)
            await this.updateOptionsSelectively(product, diff.optionsDiff)
          }

          // CRITICAL: Refetch product after option changes to get updated variants
          // Shopify auto-creates ALL variant combinations when options change
          // Add retry logic to handle async variant creation
          console.info(`🔄 Refetching product to get updated variants after option changes`)
          product = await this.waitForVariantsAfterOptionChange(product.id)

          // Re-compare variants with fresh product data
          const variantsDiff = this.compareVariants(product, model)

          // Sync variants based on fresh comparison
          if (variantsDiff.needsUpdate) {
            console.info(
              `🧹 Cleaning up variants: ${variantsDiff.variantsToUpdate.length} to update, ${variantsDiff.variantsToCreate.length} to create, ${variantsDiff.variantsToDelete.length} to delete`
            )
            await this.syncVariants(product, variantsDiff)
          }
        } catch (error) {
          throw new Error(`Options update failed for ${product.id}: ${error.message}`)
        }
      } else if (diff.variantsDiff.needsUpdate) {
        // Only update variants if options didn't change
        try {
          const onlyPriceChanges =
            diff.variantsDiff.variantsToUpdate.length > 0 &&
            diff.variantsDiff.variantsToCreate.length === 0 &&
            diff.variantsDiff.variantsToDelete.length === 0

          if (onlyPriceChanges) {
            console.info(`💰 Updating variant prices only`)
            await this.updateVariantsPricesOnly(product, diff.variantsDiff)
          } else {
            console.info(`🔧 Syncing variants (add/remove/update)`)
            await this.syncVariants(product, diff.variantsDiff)
          }
        } catch (error) {
          throw new Error(`Variants update failed for ${product.id}: ${error.message}`)
        }
      }

      // Update metafields if needed (hook for subclasses like PaintingCopier)
      await this.updateMetafieldsIfNeeded(product, diff)

      // Update bundle.products metafield if needed (shared across all products)
      if (diff.bundleMetafieldDiff?.needsUpdate) {
        console.info(`📦 Updating bundle.products metafield`)
        try {
          await this.updateBundleMetafield(product.id, diff.bundleMetafieldDiff)
        } catch (error) {
          console.warn(`⚠️  Bundle metafield update failed for ${product.id}: ${error.message}`)
          // Don't throw - metafield failure shouldn't fail entire update
        }
      }

      // Translate only if options changed
      if (this.shouldTranslate(diff)) {
        console.info(`🌐 Translating product options`)
        try {
          await this.translateProductOptionsInAllLanguages(product)
        } catch (error) {
          console.warn(`⚠️  Translation failed for ${product.id}: ${error.message}`)
          // Don't throw - translation failure shouldn't fail entire update
        }
      }

      console.info(`✅ Successfully updated product ${product.id}`)
    } catch (error) {
      console.error(`❌ Failed to update product ${product.id}: ${error.message || error}`)
      throw error // Re-throw to be caught by WebhooksController
    }
  }

  /**
   * Hook for subclasses to update metafields or other custom data
   * Override this in subclasses like PaintingCopier
   */
  protected async updateMetafieldsIfNeeded(
    _product: ProductById,
    _diff: DiffResult
  ): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override to add metafield update logic
  }

  /**
   * Update bundle.products metafield with product references from model
   * This metafield is shared across all product types (paintings and tapestries)
   * Sets to empty array if model doesn't have the metafield (aligns product with model)
   */
  protected async updateBundleMetafield(
    productId: string,
    diff: BundleMetafieldDiff
  ): Promise<void> {
    if (!diff.needsUpdate) return

    const shopify = new Shopify()
    const productReferencesJson = JSON.stringify(diff.productReferences)

    if (diff.productReferences.length === 0) {
      console.info(`   - Clearing bundle.products metafield (model has no references)`)
    } else {
      console.info(`   - Updating ${diff.productReferences.length} product reference(s)`)
    }

    await shopify.metafield.update(productId, 'bundle', 'products', productReferencesJson)
  }

  /**
   * Log detailed option changes for better debugging
   */
  private logOptionChanges(diff: OptionsDiff, product: ProductById) {
    if (diff.hasStructuralChanges) {
      console.info(`   - Options: Structural changes (full recreation)`)
      if (diff.optionsToCreate.length > 0) {
        console.info(`     • Creating: ${diff.optionsToCreate.map((o) => o.name).join(', ')}`)
      }
      if (diff.optionsToDelete.length > 0) {
        console.info(`     • Deleting: ${diff.optionsToDelete.length} option(s)`)
      }
    } else {
      console.info(`   - Options: Value changes`)
      const updateKeys = Object.keys(diff.optionValuesToUpdate)
      if (updateKeys.length > 0) {
        for (const optionId of updateKeys) {
          const { valuesToAdd, valuesToRemove, finalValues } = diff.optionValuesToUpdate[optionId]
          // Look up option name from product for better readability
          const option = product.options?.find((opt) => opt.id === optionId)
          const optionName = option ? option.name : optionId

          if (valuesToAdd.length > 0) {
            console.info(
              `     • Adding values: [${valuesToAdd.join(', ')}] to option '${optionName}'`
            )
          }
          if (valuesToRemove.length > 0) {
            console.info(
              `     • Removing values: [${valuesToRemove.join(', ')}] from option '${optionName}'`
            )
          }
          console.info(`     • Final state for '${optionName}': [${finalValues.join(', ')}]`)
        }
      }
    }
  }
}
