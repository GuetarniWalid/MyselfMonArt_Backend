import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import ChatGPT from 'App/Services/ChatGPT'
import Shopify from 'App/Services/Shopify'
import { logTaskBoundary } from 'App/Utils/Logs'
import type { LanguageCode, RegionCode } from 'Types/Translation'

export default class TestProductTranslations extends BaseCommand {
  public static commandName = 'test:product_translations'
  public static description = 'Test product translations with a limited number of products'

  @args.string({ description: 'Target language code (en, es, de, nl)', required: false })
  public locale: LanguageCode

  @flags.string({ description: 'Region code (e.g., UK for en-UK)' })
  public region: RegionCode

  @flags.boolean({
    description: 'Dry run - show what would be translated without actually translating',
    alias: 'd',
  })
  public dryRun: boolean

  @flags.number({
    description: 'Limit number of products to translate (default: 10)',
    alias: 'l',
  })
  public limit: number

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Test Product Translations')

    const targetLocale = this.locale || 'en'
    const targetRegion = this.region
    const maxProducts = this.limit || 10

    console.info(`\n${'='.repeat(60)}`)
    console.info(`🧪 TEST PRODUCT TRANSLATIONS`)
    console.info(`${'='.repeat(60)}`)
    console.info(`Target Language: ${targetLocale}${targetRegion ? `-${targetRegion}` : ''}`)
    console.info(
      `Mode: ${this.dryRun ? '🔍 DRY RUN (no changes)' : '✅ LIVE (will push to Shopify)'}`
    )
    console.info(`Limit: ${maxProducts} products`)
    console.info(`${'='.repeat(60)}\n`)

    try {
      const shopify = new Shopify()
      const chatGPT = new ChatGPT()

      // Fetch outdated translations
      console.info(`📥 Fetching products with outdated translations...`)
      const allProductsToTranslate = await shopify
        .translator('product')
        .getOutdatedTranslations(targetLocale, targetRegion)

      console.info(`📊 Total products needing translation: ${allProductsToTranslate.length}`)

      if (allProductsToTranslate.length === 0) {
        console.info(`\n✨ No products need translation. All up to date!`)
        logTaskBoundary(false, 'Test Product Translations')
        return
      }

      // Apply limit
      const productsToTranslate = allProductsToTranslate.slice(0, maxProducts)
      console.info(`🔬 Testing on ${productsToTranslate.length} product(s)\n`)

      // Display what will be translated
      console.info(`${'─'.repeat(60)}`)
      console.info(`📋 Products to translate:`)
      console.info(`${'─'.repeat(60)}`)

      for (const [index, product] of productsToTranslate.entries()) {
        const fields = Object.keys(product).filter((k) => k !== 'id')
        const hasOptions = fields.includes('options')
        const optionValues = hasOptions
          ? (product as any).options
              ?.flatMap((opt: any) => opt.optionValues?.map((ov: any) => ov.name) || [])
              .filter(Boolean) || []
          : []

        console.info(`\n${index + 1}. Product: ${product.id}`)
        console.info(`   Fields to translate: ${fields.join(', ')}`)
        if (optionValues.length > 0) {
          console.info(`   Option values: ${optionValues.join(', ')}`)
        }
      }
      console.info(`\n${'─'.repeat(60)}\n`)

      if (this.dryRun) {
        console.info(`🔍 DRY RUN COMPLETE - No translations performed`)
        console.info(
          `Run without --dry-run flag to actually translate these ${productsToTranslate.length} product(s)\n`
        )
        logTaskBoundary(false, 'Test Product Translations')
        return
      }

      // Translate each product
      console.info(`${'═'.repeat(60)}`)
      console.info(`🚀 Starting translation...`)
      console.info(`${'═'.repeat(60)}\n`)

      const results = {
        total: productsToTranslate.length,
        success: 0,
        failed: 0,
        skippedEntries: 0,
        errors: [] as Array<{ productId: string; error: string }>,
      }

      for (let i = 0; i < productsToTranslate.length; i++) {
        const product = productsToTranslate[i]
        const progress = `[${i + 1}/${productsToTranslate.length}]`

        console.info(`\n${progress} ${'━'.repeat(50)}`)
        console.info(`${progress} Translating product: ${product.id}`)

        try {
          // Translate via ChatGPT (+ local dictionary for option values)
          const productTranslated = await chatGPT.translate(
            product,
            'product',
            targetLocale,
            targetRegion
          )
          console.info(`${progress} ✓ Translation completed`)

          // Push to Shopify
          const responses = await shopify.translator('product').updateTranslation({
            resourceToTranslate: product,
            resourceTranslated: productTranslated,
            isoCode: targetLocale,
            region: targetRegion,
          })

          // Check results
          let hasErrors = false
          for (const response of responses) {
            if (response.translationsRegister.userErrors.length > 0) {
              hasErrors = true
              for (const error of response.translationsRegister.userErrors) {
                console.error(`${progress} ❌ Shopify error: ${error.message}`)
                if (error.message.includes('Value cannot match original content')) {
                  results.skippedEntries++
                }
              }
            }
          }

          if (hasErrors) {
            results.failed++
            results.errors.push({
              productId: product.id!,
              error: 'Shopify rejected some translations',
            })
          } else {
            console.info(`${progress} ✅ Translation updated successfully`)
            results.success++
          }
        } catch (error: any) {
          console.error(`${progress} ❌ Error: ${error.message}`)
          results.failed++
          results.errors.push({
            productId: product.id!,
            error: error.message || String(error),
          })
        }
      }

      // Display summary
      console.info(`\n${'═'.repeat(60)}`)
      console.info(`📊 TRANSLATION SUMMARY`)
      console.info(`${'═'.repeat(60)}`)
      console.info(`Total processed:          ${results.total}`)
      console.info(`✅ Fully successful:       ${results.success}`)
      console.info(`❌ With errors:            ${results.failed}`)
      if (results.skippedEntries > 0) {
        console.info(
          `⚠️  "Value matches original": ${results.skippedEntries} (these should be 0 after the fix)`
        )
      }
      console.info(`${'═'.repeat(60)}`)

      if (results.errors.length > 0) {
        console.error(`\n${'━'.repeat(60)}`)
        console.error(`❌ ERRORS:`)
        console.error(`${'━'.repeat(60)}`)
        results.errors.forEach((err, index) => {
          console.error(`${index + 1}. ${err.productId} - ${err.error}`)
        })
        console.error(`${'━'.repeat(60)}`)
      }

      if (results.success > 0) {
        console.info(`\n🎉 Successfully translated ${results.success} product(s)!`)
      }

      if (results.skippedEntries === 0 && results.failed === 0) {
        console.info(`\n✨ No "Value cannot match original content" errors — the fix is working!`)
      }
    } catch (error: any) {
      console.error(`\n❌ Fatal error:`, error.message)
      console.error(error.stack)
    }

    logTaskBoundary(false, 'Test Product Translations')
  }
}
