import { BaseCommand } from '@adonisjs/core/build/standalone'
import { logTaskBoundary } from 'App/Utils/Logs'
import Shopify from 'App/Services/Shopify'
import ChatGPT from 'App/Services/ChatGPT'

export default class ThemeAttribution extends BaseCommand {
  public static commandName = 'theme:attribution'
  public static description = 'Run theme detection on all painting products'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Theme Attribution')

    // ====================================================================
    // CONFIGURATION
    // ====================================================================
    // Set to true to see what would be processed without actually running theme detection
    const DRY_RUN = false

    // Maximum number of products to process (safety limit)
    // Set to null to process ALL products (use with caution!)
    const MAX_PRODUCTS: number | null = 20

    // Skip products that already have themes set
    const SKIP_EXISTING_THEMES = true
    // ====================================================================

    console.info(`🏷️  Theme Attribution - Batch Processing`)
    console.info(`${'='.repeat(60)}`)
    console.info(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '✅ LIVE (will update products)'}`)
    console.info(`Skip existing themes: ${SKIP_EXISTING_THEMES ? 'Yes' : 'No'}`)
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

      // Step 2: Filter for paintings that can be processed
      console.info(`🔍 Filtering for painting products...`)
      const paintingProducts = allProducts.filter((product) => {
        // Must be a painting or personalized template
        if (product.templateSuffix !== 'painting' && product.templateSuffix !== 'personalized') {
          return false
        }

        // Must not be a model product
        const isModel = product.tags.some((tag) =>
          [
            'portrait model',
            'paysage model',
            'square model',
            'personalized portrait model',
          ].includes(tag)
        )
        if (isModel) {
          return false
        }

        // Must have at least 2 media items
        if (!product.media?.nodes || product.media.nodes.length < 2) {
          return false
        }

        return true
      })

      console.info(`✅ Found ${paintingProducts.length} painting products eligible for processing`)

      // Step 3: Apply safety limit if configured
      const productsToProcess =
        MAX_PRODUCTS && MAX_PRODUCTS > 0
          ? paintingProducts.slice(0, MAX_PRODUCTS)
          : paintingProducts

      if (MAX_PRODUCTS && MAX_PRODUCTS > 0 && paintingProducts.length > MAX_PRODUCTS) {
        console.warn(
          `⚠️  SAFETY LIMIT: Only processing first ${MAX_PRODUCTS} of ${paintingProducts.length} products`
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
        logTaskBoundary(false, 'Theme Attribution')
        return
      }

      // Step 4: Process each product
      console.info(`\n${'═'.repeat(60)}`)
      console.info(`🚀 Starting theme detection...`)
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
        console.info(`${'─'.repeat(60)}`)

        try {
          // Fetch full product details (with metafields)
          const fullProduct = await shopify.product.getProductById(product.id)

          // Initialize ChatGPT service
          const chatGPT = new ChatGPT()

          // Check if should skip (themes already set)
          if (SKIP_EXISTING_THEMES) {
            // This check will be done inside detectAndSetThemes, but we can log it here
            const hasThemes = fullProduct.metafields?.edges.find(
              (edge) => edge.node.namespace === 'shopify' && edge.node.key === 'theme'
            )
            if (hasThemes) {
              console.info(`⏭️  Skipped: Themes already set`)
              results.skipped++
              continue
            }
          }

          // Run theme detection
          await chatGPT.theme.detectAndSetThemes(fullProduct)

          console.info(`✅ Success`)
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
      console.info(`Total products:        ${results.total}`)
      console.info(`✅ Successfully processed: ${results.processed}`)
      console.info(`⏭️  Skipped (has themes):  ${results.skipped}`)
      console.info(`❌ Failed:                ${results.failed}`)
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
        console.info(`\n🎉 Theme attribution completed successfully!`)
      }
    } catch (error: any) {
      console.error(`\n❌ Fatal error during batch processing:`, error.message)
      console.error(error.stack)
    }

    logTaskBoundary(false, 'Theme Attribution')
  }
}
