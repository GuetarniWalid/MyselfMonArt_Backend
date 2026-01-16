import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class MigrateArtworkTypeMetafield extends BaseCommand {
  public static commandName = 'migrate:artwork-type'
  public static description =
    'Migrate existing products: add artwork.type metafield based on templateSuffix'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  // Configuration
  private readonly DRY_RUN = false // Set to true to preview without making changes
  private readonly MAX_PRODUCTS = 0 // 0 = process all products, set number to limit
  private readonly BATCH_DELAY = 100 // Delay between updates in ms to avoid rate limits
  private readonly FORCE_OVERWRITE = false // Set to true to overwrite existing artwork.type metafields (useful for fixing errors)

  public async run() {
    const startTime = Date.now()
    this.logger.info('🚀 Starting artwork.type metafield migration...\n')

    try {
      // Step 1: Fetch all products
      this.logger.info('📦 Fetching all products from Shopify...')
      const shopify = new Shopify()
      const allProducts = await shopify.product.getAll(true) // Include unpublished
      this.logger.info(`✅ Fetched ${allProducts.length} total products\n`)

      // Step 2: Filter products that need migration
      this.logger.info(`🔍 Filtering products that need migration...`)
      const productsToMigrate = allProducts.filter((product) => {
        // Must have a templateSuffix
        if (!product.templateSuffix) return false

        // Must be one of our artwork types
        if (!['painting', 'poster', 'tapestry'].includes(product.templateSuffix)) return false

        // Check if artwork.type metafield already exists
        const hasArtworkTypeMetafield = product.artworkTypeMetafield?.value
        if (hasArtworkTypeMetafield && !this.FORCE_OVERWRITE) return false // Already migrated (skip unless FORCE_OVERWRITE)

        return true
      })

      const migrationMode = this.FORCE_OVERWRITE
        ? 'ALL products (FORCE_OVERWRITE enabled)'
        : 'products missing artwork.type metafield'
      this.logger.info(
        `✅ Found ${productsToMigrate.length} products to migrate (${migrationMode})\n`
      )

      if (productsToMigrate.length === 0) {
        this.logger.success('🎉 All products already have artwork.type metafield. Nothing to do!')
        return
      }

      // Show preview of products to migrate
      console.info(`\n${'─'.repeat(60)}`)
      console.info(`Products that will be migrated:`)
      console.info(`${'─'.repeat(60)}`)
      productsToMigrate.forEach((p, index) => {
        const uniqueIdentifier = `"${p.title}" + templateSuffix="${p.templateSuffix}"`
        const currentValue = p.artworkTypeMetafield?.value
        const action = currentValue
          ? `Change "${currentValue}" → "${p.templateSuffix}"`
          : `Set to "${p.templateSuffix}"`

        console.info(`${index + 1}. ${uniqueIdentifier}`)
        console.info(`   Product ID: ${p.id}`)
        console.info(`   Action: ${action}`)
      })
      console.info(`${'─'.repeat(60)}\n`)

      // Step 3: Limit products if MAX_PRODUCTS is set
      const productsToProcess =
        this.MAX_PRODUCTS > 0 ? productsToMigrate.slice(0, this.MAX_PRODUCTS) : productsToMigrate

      if (this.MAX_PRODUCTS > 0 && productsToMigrate.length > this.MAX_PRODUCTS) {
        this.logger.info(`⚠️  Processing only ${this.MAX_PRODUCTS} products (MAX_PRODUCTS limit)\n`)
      }

      // Step 4: Show mode warnings
      if (this.DRY_RUN) {
        this.logger.warning('⚠️  DRY RUN MODE - No changes will be made\n')
      }

      if (this.FORCE_OVERWRITE) {
        this.logger.warning(
          '⚠️  FORCE_OVERWRITE MODE - Will overwrite existing artwork.type metafields\n'
        )
      }

      // Step 5: Process products
      const results = {
        success: 0,
        failed: 0,
        skipped: 0,
        overwritten: 0, // Count of products where we overwrote existing metafield
        errors: [] as { productId: string; title: string; error: string }[],
      }

      this.logger.info(`🔄 Processing ${productsToProcess.length} products...\n`)
      this.logger.info(`${'='.repeat(60)}\n`)

      for (let i = 0; i < productsToProcess.length; i++) {
        const product = productsToProcess[i]
        const progress = `[${i + 1}/${productsToProcess.length}]`

        console.info(`\n${'━'.repeat(60)}`)
        console.info(
          `${progress} UNIQUE IDENTIFIER: "${product.title}" + templateSuffix="${product.templateSuffix}"`
        )
        console.info(`${progress} Product ID: ${product.id}`)
        console.info(`${'─'.repeat(60)}`)

        try {
          // SAFETY CHECK: Re-fetch the product to ensure we have the latest templateSuffix
          console.info(`${progress} 🔍 Re-fetching product to verify current state...`)
          const freshProduct = await shopify.product.getProductById(product.id)

          console.info(`${progress} ✅ Fresh data retrieved`)
          console.info(`${progress}    Title: "${freshProduct.title}"`)
          console.info(`${progress}    Current templateSuffix: "${freshProduct.templateSuffix}"`)
          console.info(
            `${progress}    Current artwork.type: ${freshProduct.artworkTypeMetafield?.value || 'NONE'}`
          )
          console.info(`${progress}    Tags: ${freshProduct.tags.join(', ')}`)

          // Double-check: Skip if metafield already exists (unless FORCE_OVERWRITE is enabled)
          if (freshProduct.artworkTypeMetafield?.value && !this.FORCE_OVERWRITE) {
            console.info(
              `${progress} ⏭️  SKIPPED - artwork.type already set to "${freshProduct.artworkTypeMetafield.value}"`
            )
            results.skipped++
            continue
          }

          // Check if we're overwriting an existing value
          const isOverwrite = !!freshProduct.artworkTypeMetafield?.value
          const oldValue = freshProduct.artworkTypeMetafield?.value

          if (isOverwrite && this.FORCE_OVERWRITE) {
            console.info(
              `${progress} 🔄 FORCE_OVERWRITE: Will change "${oldValue}" → "${freshProduct.templateSuffix}"`
            )
          }

          // Use templateSuffix as the source of truth for artwork.type
          const artworkType = freshProduct.templateSuffix

          if (!artworkType) {
            throw new Error('Product has no templateSuffix - cannot determine artwork.type')
          }

          console.info(
            `${progress} 🎯 Will set: artwork.type = "${artworkType}" (from templateSuffix)`
          )

          if (this.DRY_RUN) {
            console.info(
              `${progress} [DRY RUN] Would ${isOverwrite ? 'overwrite' : 'add'} metafield: artwork.type = "${artworkType}"`
            )
            results.success++
            if (isOverwrite) results.overwritten++
          } else {
            // Add/update artwork.type metafield
            console.info(`${progress} 📝 ${isOverwrite ? 'Overwriting' : 'Adding'} metafield...`)

            await shopify.metafield.update(freshProduct.id, 'artwork', 'type', artworkType)

            const action = isOverwrite ? 'OVERWROTE' : 'SET'
            console.info(
              `${progress} ✅ SUCCESS - ${action} artwork.type = "${artworkType}" for "${freshProduct.title}" (templateSuffix="${freshProduct.templateSuffix}")`
            )
            results.success++
            if (isOverwrite) results.overwritten++
          }
        } catch (error) {
          const uniqueId = `"${product.title}" + templateSuffix="${product.templateSuffix}"`
          console.error(`${progress} ❌ FAILED: ${uniqueId}`)
          console.error(`${progress}    Error: ${error.message}`)
          results.failed++
          results.errors.push({
            productId: product.id,
            title: `${product.title} (templateSuffix: ${product.templateSuffix})`,
            error: error.message,
          })
        }

        // Add delay between updates to avoid rate limits
        if (!this.DRY_RUN && i < productsToProcess.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, this.BATCH_DELAY))
        }
      }

      // Step 6: Summary
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      this.logger.info(`\n${'='.repeat(60)}`)
      this.logger.info(`\n📊 Migration Summary:`)
      this.logger.info(`${'─'.repeat(60)}`)
      this.logger.info(`✅ Success: ${results.success}`)
      if (results.overwritten > 0) {
        this.logger.info(`🔄 Overwritten: ${results.overwritten} (existing metafields updated)`)
      }
      this.logger.info(`❌ Failed: ${results.failed}`)
      this.logger.info(`⏭️  Skipped: ${results.skipped}`)
      this.logger.info(`⏱️  Duration: ${duration}s`)
      this.logger.info(`${'─'.repeat(60)}\n`)

      if (results.errors.length > 0) {
        this.logger.error(`\n❌ Errors encountered (${results.errors.length}):`)
        results.errors.forEach((error, index) => {
          this.logger.error(`${index + 1}. ${error.title} (${error.productId})`)
          this.logger.error(`   Error: ${error.error}`)
        })
      }

      if (this.DRY_RUN) {
        this.logger.warning('\n⚠️  DRY RUN MODE - No changes were made')
        this.logger.info('Set DRY_RUN = false in the command file to apply changes')
      } else {
        this.logger.success('\n🎉 Migration completed successfully!')
      }
    } catch (error) {
      this.logger.error(`\n❌ Migration failed: ${error.message}`)
      throw error
    }
  }
}
