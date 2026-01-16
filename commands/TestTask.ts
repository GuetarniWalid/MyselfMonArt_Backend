import { BaseCommand } from '@adonisjs/core/build/standalone'
import { logTaskBoundary } from 'App/Utils/Logs'
import Shopify from 'App/Services/Shopify'
import ChatGPT from 'App/Services/ChatGPT'

export default class TestTask extends BaseCommand {
  public static commandName = 'test:task'
  public static description = 'Test differential update system'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Test Differential Update')

    // ====================================================================
    // CONFIGURE YOUR TEST HERE
    // ====================================================================
    // Add your test product IDs here (Shopify GIDs format: gid://shopify/Product/123456789)
    const TEST_PRODUCT_IDS: string[] = [
      'gid://shopify/Product/9667258319195',
      //'gid://shopify/Product/10260536263003',
      //'gid://shopify/Product/10257951195483',
      //'gid://shopify/Product/9918679744859', // square model
      //'gid://shopify/Product/10195703628123', // boheme square
    ]

    // Set to 'create' or 'update' to test specific webhook type
    const TEST_TYPE = 'create' as 'create' | 'update'

    // SAFETY LIMIT: Maximum number of related products to update (for 'update' mode)
    // Set to a small number (e.g., 2-3) for safe testing
    // Set to 0 or null to process ALL related products (use with caution!)
    const MAX_RELATED_PRODUCTS: number | null = null
    // ====================================================================

    if (TEST_PRODUCT_IDS.length === 0) {
      console.error('❌ No test product IDs configured!')
      console.info('Please add product IDs to the TEST_PRODUCT_IDS array in commands/TestTask.ts')
      console.info('Format: gid://shopify/Product/YOUR_PRODUCT_ID')
      return
    }

    console.info(`🧪 Testing differential update system`)
    console.info(`📋 Test type: ${TEST_TYPE}`)
    console.info(`📦 Products to test: ${TEST_PRODUCT_IDS.length}`)
    console.info(`${'='.repeat(60)}\n`)

    for (const productId of TEST_PRODUCT_IDS) {
      console.info(`\n${'━'.repeat(60)}`)
      console.info(`🔍 Testing product: ${productId}`)
      console.info(`${'━'.repeat(60)}`)

      try {
        if (TEST_TYPE === 'create') {
          await this.testProductCreate(productId)
        } else if (TEST_TYPE === 'update') {
          await this.testProductUpdate(productId, MAX_RELATED_PRODUCTS)
        }
        console.info(`✅ Test completed for ${productId}`)
      } catch (error) {
        console.error(`❌ Test failed for ${productId}:`, error.message)
        console.error(error.stack)
      }
    }

    console.info(`\n${'='.repeat(60)}`)
    console.info(`🎉 All tests completed`)
    console.info(`${'='.repeat(60)}`)

    logTaskBoundary(false, 'Test Differential Update')
  }

  /**
   * Test product create flow (same as handleProductCreate in WebhooksController)
   */
  private async testProductCreate(productId: string) {
    console.info(`\n🚀 Testing product create flow for: ${productId}`)
    await this.testPaintingCreate(productId)
    await this.testTapestryCreate(productId)
  }

  /**
   * Test painting create logic
   */
  private async testPaintingCreate(productId: string) {
    const shopify = new Shopify()
    const product = await shopify.product.getProductById(productId)

    console.info(`📄 Product title: ${product.title}`)
    console.info(`🏷️  Template: ${product.templateSuffix}`)
    console.info(`🏷️  Tags: ${product.tags.join(', ')}`)

    const areMediaLoaded = await shopify.product.artworkCopier.areMediaImagesLoaded(product)
    if (!areMediaLoaded) {
      console.info(`⏭️  Skipping: Media images not loaded`)
      return
    }

    const canProcess = shopify.product.artworkCopier.canProcessProductCreate(product)
    if (!canProcess) {
      console.info(
        `⏭️  Skipping: Cannot process product create (might be a model or wrong template)`
      )
      return
    }

    console.info(`🎨 Processing artwork product...`)
    await shopify.product.artworkCopier.copyModelDataFromImageRatio(product)
    console.info(`✅ Artwork data successfully copied`)

    // Test color detection (same as webhook handler)
    console.info(`\n🎨 Testing color detection...`)
    const chatGPT = new ChatGPT()
    await chatGPT.colorPattern.detectAndSetColors(product)
    console.info(`✅ Color detection completed`)

    // Test theme detection (same as webhook handler)
    console.info(`\n🏷️  Testing theme detection...`)
    await chatGPT.theme.detectAndSetThemes(product)
    console.info(`✅ Theme detection completed`)
  }

  /**
   * Test tapestry create logic
   */
  private async testTapestryCreate(productId: string) {
    const shopify = new Shopify()
    const product = await shopify.product.getProductById(productId)

    const canProcess = shopify.product.tapestryCopier.canProcessProductCreate(product)
    if (!canProcess) {
      console.info(`⏭️  Skipping: Cannot process as tapestry`)
      return
    }

    console.info(`🧵 Processing tapestry product...`)
    await shopify.product.tapestryCopier.copyModelDataOnProduct(product)
    console.info(`✅ Tapestry data successfully copied`)
  }

  /**
   * Test product update flow (same as handleProductUpdate in WebhooksController)
   * This tests updating related products when a model is updated
   */
  private async testProductUpdate(productId: string, maxRelatedProducts: number | null = null) {
    console.info(`\n🔄 Testing product update flow for: ${productId}`)
    await this.testUpdateRelatedProductsFromModel(productId, maxRelatedProducts)
  }

  /**
   * Test updating related products from model
   */
  private async testUpdateRelatedProductsFromModel(
    productId: string,
    maxRelatedProducts: number | null = null
  ) {
    const shopify = new Shopify()
    const product = await shopify.product.getProductById(productId)
    const copier = shopify.product.getModelCopier(product)

    console.info(`📄 Product title: ${product.title}`)
    console.info(`🏷️  Template: ${product.templateSuffix}`)
    console.info(`🏷️  Tags: ${product.tags.join(', ')}`)

    const isModel = copier.isModelProduct(product)
    if (!isModel) {
      console.info(`⏭️  Skipping: Not a model product`)
      return
    }

    console.info(`✅ Confirmed: This is a model product`)
    console.info(`\n🔍 Finding related products...`)

    const products = await shopify.product.getAll()
    const allRelatedProducts = copier.getRelatedProducts(products, product)

    console.info(`📊 Found ${allRelatedProducts.length} related products`)

    if (allRelatedProducts.length === 0) {
      console.info(`⏭️  No related products to update`)
      return
    }

    // Apply safety limit
    const relatedProducts =
      maxRelatedProducts && maxRelatedProducts > 0
        ? allRelatedProducts.slice(0, maxRelatedProducts)
        : allRelatedProducts

    if (
      maxRelatedProducts &&
      maxRelatedProducts > 0 &&
      allRelatedProducts.length > maxRelatedProducts
    ) {
      console.warn(
        `⚠️  SAFETY LIMIT: Only processing first ${maxRelatedProducts} of ${allRelatedProducts.length} related products`
      )
      console.warn(`   To process all products, set MAX_RELATED_PRODUCTS to null in the test file`)
    }

    // Show list of related products that will be updated
    console.info(`\n${'─'.repeat(60)}`)
    console.info(`Related products that will be updated:`)
    console.info(`${'─'.repeat(60)}`)
    relatedProducts.forEach((p, index) => {
      console.info(`${index + 1}. ${p.title} (${p.id})`)
    })
    console.info(`${'─'.repeat(60)}\n`)

    const failures: Array<{
      productId: string
      productTitle: string
      error: string
    }> = []

    // Process each related product
    for (const relatedProduct of relatedProducts) {
      console.info(`\n${'┄'.repeat(60)}`)
      console.info(`Processing: ${relatedProduct.title}`)
      console.info(`${'┄'.repeat(60)}`)

      try {
        await this.testProductCreate(relatedProduct.id)
      } catch (error) {
        failures.push({
          productId: relatedProduct.id,
          productTitle: relatedProduct.title,
          error: error.message || String(error),
        })
        console.error(`❌ Failed: ${error.message}`)
        // Continue with other products
      }
    }

    // Display summary
    const successCount = relatedProducts.length - failures.length
    console.info(`\n${'='.repeat(60)}`)
    console.info(`📊 UPDATE SUMMARY`)
    console.info(`${'='.repeat(60)}`)
    console.info(`✅ Successfully updated: ${successCount}/${relatedProducts.length} products`)

    if (failures.length > 0) {
      console.error(`❌ Failed to update: ${failures.length} products`)
      console.error(`\n${'━'.repeat(60)}`)
      console.error(`FAILED PRODUCTS:`)
      console.error(`${'━'.repeat(60)}`)
      failures.forEach((f, index) => {
        console.error(`\n${index + 1}. ${f.productTitle}`)
        console.error(`   Product ID: ${f.productId}`)
        console.error(`   Error: ${f.error}`)
      })
      console.error(`${'━'.repeat(60)}`)
    } else {
      console.info(`🎉 All related products updated successfully!`)
    }
    console.info(`${'='.repeat(60)}`)
  }
}
