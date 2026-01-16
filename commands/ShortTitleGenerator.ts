import { BaseCommand } from '@adonisjs/core/build/standalone'
import { logTaskBoundary } from 'App/Utils/Logs'
import Shopify from 'App/Services/Shopify'
import ProductPublisher from 'App/Services/Claude/ProductPublisher'

export default class ShortTitleGenerator extends BaseCommand {
  public static commandName = 'product:generate-short-titles'
  public static description =
    'Generate and set short titles for painting, poster, and tapestry products'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Short Title Generation')

    // ====================================================================
    // CONFIGURATION
    // ====================================================================
    // Set to true to see what would be processed without actually generating titles
    const DRY_RUN = false

    // Maximum number of products to process (safety limit)
    // Set to null to process ALL products (use with caution!)
    const MAX_PRODUCTS: number | null = null

    // Skip products that already have a short title metafield
    const SKIP_EXISTING_SHORT_TITLES = true
    // ====================================================================

    console.info(`📝 Short Title Generation - Batch Processing`)
    console.info(`${'='.repeat(60)}`)
    console.info(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '✅ LIVE (will update products)'}`)
    console.info(`Skip existing short titles: ${SKIP_EXISTING_SHORT_TITLES ? 'Yes' : 'No'}`)
    if (MAX_PRODUCTS) {
      console.warn(`⚠️  Safety limit: Max ${MAX_PRODUCTS} products`)
    }
    console.info(`${'='.repeat(60)}\n`)

    try {
      // Step 1: Fetch all products
      console.info(`📦 Fetching all products from Shopify...`)
      const shopify = new Shopify()
      const allProducts = await shopify.product.getAll()
      console.info(`✅ Fetched ${allProducts.length} total products\n`)

      // Step 2: Filter for eligible products
      console.info(`🔍 Filtering for painting, poster, and tapestry products...`)
      const eligibleProducts = allProducts.filter((product) => {
        // Must be one of the three target template types
        if (!['painting', 'poster', 'tapestry'].includes(product.templateSuffix || '')) {
          return false
        }

        // Must not be a model product
        const isModel = product.tags.some((tag) =>
          ['portrait model', 'paysage model', 'square model', 'tapestry model'].includes(tag)
        )
        if (isModel) {
          return false
        }

        // Must have a title
        if (!product.title || product.title.trim() === '') {
          return false
        }

        // Must have a description
        if (!product.description || product.description.trim() === '') {
          return false
        }

        return true
      })

      console.info(`✅ Found ${eligibleProducts.length} products eligible for processing`)

      // Step 3: Apply safety limit if configured
      const productsToProcess =
        MAX_PRODUCTS && MAX_PRODUCTS > 0
          ? eligibleProducts.slice(0, MAX_PRODUCTS)
          : eligibleProducts

      if (MAX_PRODUCTS && MAX_PRODUCTS > 0 && eligibleProducts.length > MAX_PRODUCTS) {
        console.warn(
          `⚠️  SAFETY LIMIT: Only processing first ${MAX_PRODUCTS} of ${eligibleProducts.length} products`
        )
      }

      console.info(`\n📊 Will process ${productsToProcess.length} products`)

      if (DRY_RUN) {
        console.info(`\n${'─'.repeat(60)}`)
        console.info(`🔍 DRY RUN - Products that would be processed:`)
        console.info(`${'─'.repeat(60)}`)
        productsToProcess.slice(0, 20).forEach((p, index) => {
          console.info(`${index + 1}. ${p.title} (${p.id})`)
        })
        if (productsToProcess.length > 20) {
          console.info(`... and ${productsToProcess.length - 20} more`)
        }
        console.info(`${'─'.repeat(60)}\n`)
        console.info(`✅ Dry run complete. Set DRY_RUN = false to process.`)
        logTaskBoundary(false, 'Short Title Generation')
        return
      }

      // Step 4: Process each product
      console.info(`\n${'═'.repeat(60)}`)
      console.info(`🚀 Starting short title generation...`)
      console.info(`${'═'.repeat(60)}\n`)

      const results = {
        total: productsToProcess.length,
        processed: 0,
        skipped: 0,
        failed: 0,
        errors: [] as Array<{ productId: string; productTitle: string; error: string }>,
      }

      for (let i = 0; i < productsToProcess.length; i++) {
        const product = productsToProcess[i]
        const progress = `[${i + 1}/${productsToProcess.length}]`

        console.info(`\n${'─'.repeat(60)}`)
        console.info(`${progress} Processing: ${product.title}`)
        console.info(`${progress} Product ID: ${product.id}`)
        console.info(`${progress} Template: ${product.templateSuffix}`)
        console.info(`${'─'.repeat(60)}`)

        try {
          // Fetch full product details (with metafields)
          const fullProduct = await shopify.product.getProductById(product.id)

          // Check if should skip (short title already exists)
          if (SKIP_EXISTING_SHORT_TITLES) {
            const existingShortTitle = fullProduct.metafields?.edges.find(
              (edge) => edge.node.namespace === 'title' && edge.node.key === 'short'
            )
            if (existingShortTitle) {
              console.info(`⏭️  Skipped: Short title already exists`)
              results.skipped++
              continue
            }
          }

          // Initialize ProductPublisher service
          const productPublisher = new ProductPublisher()

          // Generate short title using Claude
          const productType = fullProduct.templateSuffix as 'poster' | 'painting' | 'tapestry'
          const { shortTitle } = await productPublisher.generateTitleAndSeo(
            fullProduct.description, // HTML description
            '', // collectionTitle (empty for batch processing)
            productType
          )

          // Update metafield using Shopify service
          await shopify.metafield.update(fullProduct.id, 'title', 'short', shortTitle)

          console.info(`✅ Success - Short title: "${shortTitle}"`)
          results.processed++
        } catch (error: any) {
          console.error(`❌ Failed: ${error.message}`)
          results.failed++
          results.errors.push({
            productId: product.id,
            productTitle: product.title,
            error: error.message || String(error),
          })
          // Continue with next product
        }
      }

      // Step 5: Display final summary
      console.info(`\n${'═'.repeat(60)}`)
      console.info(`📊 FINAL SUMMARY`)
      console.info(`${'═'.repeat(60)}`)
      console.info(`Total products:            ${results.total}`)
      console.info(`✅ Successfully processed:     ${results.processed}`)
      console.info(`⏭️  Skipped:                   ${results.skipped}`)
      console.info(`❌ Failed:                     ${results.failed}`)
      console.info(`${'═'.repeat(60)}`)

      if (results.errors.length > 0) {
        console.error(`\n${'━'.repeat(60)}`)
        console.error(`❌ FAILED PRODUCTS:`)
        console.error(`${'━'.repeat(60)}`)
        results.errors.forEach((err, index) => {
          console.error(`\n${index + 1}. ${err.productTitle}`)
          console.error(`   Product ID: ${err.productId}`)
          console.error(`   Error: ${err.error}`)
        })
        console.error(`${'━'.repeat(60)}`)
      }

      if (results.processed > 0) {
        console.info(`\n🎉 Short title generation completed successfully!`)
      }
    } catch (error: any) {
      console.error(`\n❌ Fatal error during batch processing:`, error.message)
      console.error(error.stack)
    }

    logTaskBoundary(false, 'Short Title Generation')
  }
}
