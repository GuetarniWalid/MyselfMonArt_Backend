import { BaseCommand } from '@adonisjs/core/build/standalone'
import { logTaskBoundary } from 'App/Utils/Logs'
import Shopify from 'App/Services/Shopify'

export default class RemoveGlbFiles extends BaseCommand {
  public static commandName = 'shopify:remove-glb-files'
  public static description = 'Permanently delete GLB (3D model) files from artwork products'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Remove GLB Files')

    // ====================================================================
    // CONFIGURATION
    // ====================================================================
    // Set to true to see what would be processed without actually deleting files
    const DRY_RUN = false

    // Maximum number of products to process (safety limit)
    // Set to null to process ALL products (use with caution!)
    const MAX_PRODUCTS: number | null = null
    // ====================================================================

    console.info(`🗑️  Remove GLB Files - Batch Processing`)
    console.info(`${'='.repeat(60)}`)
    console.info(
      `Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚠️  LIVE (will DELETE files permanently)'}`
    )
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

      // Step 2: Filter for eligible artwork products (paintings, posters, tapestries)
      console.info(`🔍 Filtering for artwork products with GLB files...`)
      const productsWithGlb = allProducts.filter((product) => {
        // Must be one of the three target artwork types
        const artworkType = product.artworkTypeMetafield?.value || ''
        if (!['painting', 'poster', 'tapestry'].includes(artworkType)) {
          return false
        }

        // Must not be a model product
        const isModel = product.tags.some((tag) =>
          ['portrait model', 'paysage model', 'square model', 'tapestry model'].includes(tag)
        )
        if (isModel) {
          return false
        }

        // Must have at least one MODEL_3D media (GLB file)
        const hasGlb = product.media?.nodes?.some((media) => media.mediaContentType === 'MODEL_3D')
        if (!hasGlb) {
          return false
        }

        return true
      })

      console.info(`✅ Found ${productsWithGlb.length} artwork products with GLB files`)

      // Step 3: Apply safety limit if configured
      const productsToProcess =
        MAX_PRODUCTS && MAX_PRODUCTS > 0 ? productsWithGlb.slice(0, MAX_PRODUCTS) : productsWithGlb

      if (MAX_PRODUCTS && MAX_PRODUCTS > 0 && productsWithGlb.length > MAX_PRODUCTS) {
        console.warn(
          `⚠️  SAFETY LIMIT: Only processing first ${MAX_PRODUCTS} of ${productsWithGlb.length} products`
        )
      }

      console.info(`\n📊 Will process ${productsToProcess.length} products`)

      if (productsToProcess.length === 0) {
        console.info(`\n✅ No products with GLB files found. Nothing to do.`)
        logTaskBoundary(false, 'Remove GLB Files')
        return
      }

      // Count total GLB files
      let totalGlbFiles = 0
      productsToProcess.forEach((product) => {
        const glbCount =
          product.media?.nodes?.filter((media) => media.mediaContentType === 'MODEL_3D').length || 0
        totalGlbFiles += glbCount
      })

      console.info(`📁 Total GLB files to delete: ${totalGlbFiles}`)

      if (DRY_RUN) {
        console.info(`\n${'─'.repeat(60)}`)
        console.info(`🔍 DRY RUN - Products that would be processed:`)
        console.info(`${'─'.repeat(60)}`)
        productsToProcess.forEach((product, index) => {
          const glbFiles =
            product.media?.nodes?.filter((media) => media.mediaContentType === 'MODEL_3D') || []
          console.info(`${index + 1}. ${product.title}`)
          console.info(`   ID: ${product.id}`)
          console.info(`   GLB files: ${glbFiles.length}`)
          glbFiles.forEach((glb) => {
            console.info(`   - ${glb.id}`)
          })
        })
        console.info(`${'─'.repeat(60)}\n`)
        console.info(`✅ Dry run complete. Set DRY_RUN = false to delete files.`)
        logTaskBoundary(false, 'Remove GLB Files')
        return
      }

      // Step 4: Process each product and delete GLB files
      console.info(`\n${'═'.repeat(60)}`)
      console.info(`🚀 Starting GLB file deletion...`)
      console.info(`${'═'.repeat(60)}\n`)

      const results = {
        totalProducts: productsToProcess.length,
        productsProcessed: 0,
        filesDeleted: 0,
        productsFailed: 0,
        errors: [] as Array<{ productId: string; productTitle: string; error: string }>,
      }

      for (let i = 0; i < productsToProcess.length; i++) {
        const product = productsToProcess[i]
        const progress = `[${i + 1}/${productsToProcess.length}]`

        console.info(`\n${'─'.repeat(60)}`)
        console.info(`${progress} Processing: ${product.title}`)
        console.info(`${progress} Product ID: ${product.id}`)

        try {
          // Get GLB file IDs for this product
          const glbMediaIds =
            product.media?.nodes
              ?.filter((media) => media.mediaContentType === 'MODEL_3D')
              .map((media) => media.id) || []

          if (glbMediaIds.length === 0) {
            console.info(`${progress} No GLB files found, skipping`)
            continue
          }

          console.info(`${progress} Found ${glbMediaIds.length} GLB file(s) to delete`)

          // Delete the GLB files
          const deletedIds = await shopify.product.deleteMedia(product.id, glbMediaIds)

          console.info(`✅ Deleted ${deletedIds.length} GLB file(s)`)
          results.productsProcessed++
          results.filesDeleted += deletedIds.length
        } catch (error: any) {
          console.error(`❌ Failed: ${error.message}`)
          results.productsFailed++
          results.errors.push({
            productId: product.id,
            productTitle: product.title,
            error: error.message || String(error),
          })
        }
      }

      // Step 5: Display final summary
      console.info(`\n${'═'.repeat(60)}`)
      console.info(`📊 FINAL SUMMARY`)
      console.info(`${'═'.repeat(60)}`)
      console.info(`Total products:            ${results.totalProducts}`)
      console.info(`✅ Successfully processed: ${results.productsProcessed}`)
      console.info(`🗑️  Files deleted:          ${results.filesDeleted}`)
      console.info(`❌ Failed:                 ${results.productsFailed}`)
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

      if (results.filesDeleted > 0) {
        console.info(`\n🎉 GLB file removal completed successfully!`)
      }
    } catch (error: any) {
      console.error(`\n❌ Fatal error during batch processing:`, error.message)
      console.error(error.stack)
    }

    logTaskBoundary(false, 'Remove GLB Files')
  }
}
