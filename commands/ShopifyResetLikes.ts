import { BaseCommand } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

export default class ShopifyResetLikes extends BaseCommand {
  public static commandName = 'shopify:reset-likes'
  public static description = 'Reset likes.number metafield to zero on all artwork products'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  private readonly DRY_RUN = false // Set to false to apply changes
  private readonly BATCH_DELAY = 100 // Delay between updates in ms

  public async run() {
    const startTime = Date.now()
    this.logger.info('Starting likes.number reset...\n')

    try {
      // Step 1: Fetch all products
      this.logger.info('Fetching all products from Shopify...')
      const shopify = new Shopify()
      const allProducts = await shopify.product.getAll(true)
      this.logger.info(`Fetched ${allProducts.length} total products\n`)

      // Step 2: Filter artwork products only (painting, poster, tapestry)
      this.logger.info('Filtering artwork products...')
      const artworkProducts = allProducts.filter((product) => {
        const artworkType = product.artworkTypeMetafield?.value
        return artworkType && ['painting', 'poster', 'tapestry'].includes(artworkType)
      })
      this.logger.info(`Found ${artworkProducts.length} artwork products\n`)

      if (artworkProducts.length === 0) {
        this.logger.success('No artwork products found. Nothing to do!')
        return
      }

      // Step 3: Show mode
      if (this.DRY_RUN) {
        this.logger.warning('DRY RUN MODE - No changes will be made\n')
      }

      // Step 4: Process each product
      const results = {
        success: 0,
        failed: 0,
        errors: [] as { productId: string; title: string; error: string }[],
      }

      this.logger.info(`Processing ${artworkProducts.length} products...\n`)
      console.info(`${'='.repeat(60)}\n`)

      for (let i = 0; i < artworkProducts.length; i++) {
        const product = artworkProducts[i]
        const progress = `[${i + 1}/${artworkProducts.length}]`

        console.info(`${progress} ${product.title}`)

        try {
          if (this.DRY_RUN) {
            console.info(`${progress} [DRY RUN] Would reset likes.number to 0`)
          } else {
            await shopify.metafield.update(product.id, 'likes', 'number', '0')
            console.info(`${progress} Reset likes.number to 0`)
          }
          results.success++
        } catch (error) {
          console.error(`${progress} FAILED: ${error.message}`)
          results.failed++
          results.errors.push({
            productId: product.id,
            title: product.title,
            error: error.message,
          })
        }

        // Add delay between updates
        if (!this.DRY_RUN && i < artworkProducts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, this.BATCH_DELAY))
        }
      }

      // Step 5: Summary
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      console.info(`\n${'='.repeat(60)}`)
      this.logger.info('\nSummary:')
      this.logger.info(`${'─'.repeat(40)}`)
      this.logger.info(`Success: ${results.success}`)
      this.logger.info(`Failed: ${results.failed}`)
      this.logger.info(`Duration: ${duration}s`)
      this.logger.info(`${'─'.repeat(40)}\n`)

      if (results.errors.length > 0) {
        this.logger.error(`\nErrors (${results.errors.length}):`)
        results.errors.forEach((error, index) => {
          this.logger.error(`${index + 1}. ${error.title} (${error.productId})`)
          this.logger.error(`   ${error.error}`)
        })
      }

      if (this.DRY_RUN) {
        this.logger.warning('\nDRY RUN MODE - No changes were made')
        this.logger.info('Set DRY_RUN = false in the command file to apply changes')
      } else {
        this.logger.success('\nLikes reset completed!')
      }
    } catch (error) {
      this.logger.error(`\nFailed: ${error.message}`)
      throw error
    }
  }
}
