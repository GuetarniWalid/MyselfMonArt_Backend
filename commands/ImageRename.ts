import { BaseCommand } from '@adonisjs/core/build/standalone'
import { logTaskBoundary } from 'App/Utils/Logs'
import Shopify from 'App/Services/Shopify'
import Mockup from 'App/Services/ChatGPT/Mockup'

export default class ImageRename extends BaseCommand {
  public static commandName = 'image:rename'
  public static description =
    'Batch rename product images containing "mockup" with AI-generated SEO filenames'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  public async run() {
    logTaskBoundary(true, 'Image Rename')

    // ====================================================================
    // CONFIGURATION
    // ====================================================================
    // Set to true to see what would be processed without actually renaming
    const DRY_RUN = false

    // Maximum number of products to process (safety limit)
    // Set to null to process ALL products (use with caution!)
    const MAX_PRODUCTS: number | null = null

    // Which image to process (1 = first image, 2 = second image, etc.)
    const IMAGE_INDEX = 4

    // Skip products where target image doesn't contain "mockup"
    const SKIP_NON_MOCKUP = true

    // MODE: Choose how to generate alt/filename
    // - 'VIERGE': Artwork only, no additional context
    // - 'CUSTOM_CONTEXT': Use a custom prompt to control how filenames are generated
    const MODE: 'VIERGE' | 'CUSTOM_CONTEXT' = 'CUSTOM_CONTEXT' as 'VIERGE' | 'CUSTOM_CONTEXT'

    // Custom AI prompt for CUSTOM_CONTEXT mode
    // Customize this prompt to control how the AI generates alt text and filenames from product data
    const CUSTOM_PROMPT: string = `Tu es un expert SEO pour MyselfMonart (décoration murale haut de gamme).
Ta mission : générer une balise ALT et un nom de fichier SEO pour un produit.

DONNÉES REÇUES :
- productTitle : titre du produit
- productDescription : description du produit
- tags : mots-clés associés

CONTEXTE :
L'image montre le coin d'un tableau toile, où l'on perçoit bien la texture et la bonne qualité de la toile.
Tu dois générer une description SEO qui met en valeur ce contexte visuel.

TÂCHE 1 - BALISE ALT (champ "alt") :
- Longueur : 5 à 10 mots (50-125 caractères)
- Structure : [Type de produit] + [Sujet] + [mention texture/qualité si pertinent]
- Langue : Français naturel et fluide
- Exemples :
  * "Tableau lion noir et blanc détail texture toile"
  * "Toile abstraite géométrique grain canvas apparent"
  * "Reproduction fleurs cerisier qualité toile visible"

TÂCHE 2 - NOM DE FICHIER (champ "filename") :
- Format : slug SEO (lowercase, hyphens, max 50 chars sans .jpg)
- Structure : [produit]-[sujet]-[detail-texture]
- Exemples :
  * "tableau-lion-noir-blanc-detail-toile"
  * "toile-abstraite-geometrique-grain-canvas"
  * "reproduction-fleurs-cerisier-texture-visible"

RÈGLES STRICTES :
✅ Extrais le sujet du titre/description
✅ Intègre le contexte de texture/qualité dans la description
✅ Si couleurs mentionnées, les inclure
✅ Privilégie la lisibilité et la pertinence SEO
⛔ PAS de mots comme "image de", "photo de"
⛔ PAS d'accents ni caractères spéciaux dans filename
⛔ PAS de mots de liaison inutiles (le, la, un, une)
⛔ NE PAS inventer de détails sur le sujet de l'œuvre (se baser uniquement sur titre/description)`
    // ====================================================================

    console.info(`🏷️  Image Rename - Batch Processing`)
    console.info(`${'='.repeat(60)}`)
    console.info(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '✅ LIVE (will update filenames)'}`)
    console.info(`Image to process: #${IMAGE_INDEX}`)
    console.info(`Generation Mode: ${MODE}${MODE === 'CUSTOM_CONTEXT' ? ' (Custom Prompt)' : ''}`)
    console.info(`Skip non-mockup images: ${SKIP_NON_MOCKUP ? 'Yes' : 'No'}`)
    if (MAX_PRODUCTS) {
      console.warn(`⚠️  Safety limit: Max ${MAX_PRODUCTS} products`)
    }
    console.info(`${'='.repeat(60)}\n`)

    // Validate IMAGE_INDEX
    if (IMAGE_INDEX < 1) {
      console.error(`❌ ERROR: IMAGE_INDEX must be >= 1 (got ${IMAGE_INDEX})`)
      return
    }
    const targetImageIndex = IMAGE_INDEX - 1 // Convert to 0-based index

    try {
      // Step 1: Fetch all products
      console.info(`📦 Fetching all products from Shopify...`)
      const shopify = new Shopify()
      const allProducts = await shopify.product.getAll()
      console.info(`✅ Fetched ${allProducts.length} total products\n`)

      // Step 2: Filter for eligible products
      console.info(`🔍 Filtering for eligible products...`)
      const eligibleProducts = allProducts.filter((product) => {
        // Must be painting or poster
        if (product.templateSuffix !== 'painting' && product.templateSuffix !== 'poster') {
          return false
        }

        // Must not be a model
        const isModel = product.tags.some((tag) =>
          ['portrait model', 'paysage model', 'square model'].includes(tag)
        )
        if (isModel) {
          return false
        }

        // Must have enough media items for the target index
        if (!product.media?.nodes || product.media.nodes.length <= targetImageIndex) {
          return false
        }

        // Target media must be an image
        const targetMedia = product.media.nodes[targetImageIndex]
        if (targetMedia.mediaContentType !== 'IMAGE') {
          return false
        }

        // Check if filename contains "mockup" (case-insensitive)
        const imageUrl = targetMedia.image?.url
        if (!imageUrl) {
          return false
        }

        // Extract filename from URL (remove query params)
        const urlPath = imageUrl.split('?')[0]
        const filename = urlPath.split('/').pop() || ''
        if (SKIP_NON_MOCKUP && !filename.toLowerCase().includes('mockup')) {
          return false
        }

        return true
      })

      console.info(`✅ Found ${eligibleProducts.length} eligible products`)

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

      // Step 4: Process each product
      console.info(`\n${'═'.repeat(60)}`)
      console.info(`${DRY_RUN ? '🔍 DRY RUN - Simulating' : '🚀 Starting'} image rename...`)
      console.info(`${'═'.repeat(60)}\n`)

      const results = {
        total: productsToProcess.length,
        processed: 0,
        skipped: 0,
        failed: 0,
        errors: [] as Array<{ productId: string; productTitle: string; error: string }>,
      }

      const mockupService = new Mockup()

      for (let i = 0; i < productsToProcess.length; i++) {
        const product = productsToProcess[i]
        const progress = `[${i + 1}/${productsToProcess.length}]`

        console.info(`\n${'─'.repeat(60)}`)
        console.info(`${progress} Processing: ${product.title}`)
        console.info(`${progress} Product ID: ${product.id}`)
        console.info(`${'─'.repeat(60)}`)

        try {
          // Get full product details
          const fullProduct = await shopify.product.getProductById(product.id)

          // Validate the product has enough images
          if (!fullProduct.media?.nodes || fullProduct.media.nodes.length <= targetImageIndex) {
            throw new Error(
              `Product does not have image at index ${IMAGE_INDEX} (has ${fullProduct.media?.nodes?.length || 0} images)`
            )
          }

          const targetMedia = fullProduct.media.nodes[targetImageIndex]

          if (!targetMedia.image) {
            throw new Error(`Image at index ${IMAGE_INDEX} has no image data`)
          }

          const oldImageUrl = targetMedia.image.url
          const oldMediaId = targetMedia.id

          // Extract filename from URL and remove query parameters
          const urlPath = oldImageUrl.split('?')[0] // Remove query params
          const oldFilename = urlPath.split('/').pop() || 'unknown'

          // Extract current extension from filename
          const extensionMatch = oldFilename.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          if (!extensionMatch) {
            throw new Error(`Could not determine file extension from: ${oldFilename}`)
          }
          const extension = extensionMatch[1].toLowerCase()

          console.info(`${progress} 📄 Current: ${oldFilename}`)

          // Generate AI-based filename
          console.info(`${progress} 🤖 Generating AI-based filename...`)
          const productContext = {
            title: fullProduct.title,
            description: fullProduct.description,
            templateSuffix: fullProduct.templateSuffix,
            tags: fullProduct.tags,
            // Include customPrompt if MODE is CUSTOM_CONTEXT
            ...(MODE === 'CUSTOM_CONTEXT' ? { customPrompt: CUSTOM_PROMPT } : {}),
          }

          const altResult = await mockupService.generateMockupAlt(productContext)

          // Validate filename
          if (!this.validateFilename(altResult.filename)) {
            throw new Error(`Invalid AI filename: ${altResult.filename}`)
          }

          // Create full filename with extension
          const newFilename = `${altResult.filename}.${extension}`
          console.info(`${progress} 🏷️  New:     ${newFilename}`)

          // Check if filename is already good (same as AI-generated)
          if (oldFilename.toLowerCase() === newFilename.toLowerCase()) {
            console.info(
              `${progress} ⏭️  ${DRY_RUN ? 'Would skip' : 'Skipped'} - Filename already optimal`
            )
            console.info(``)
            results.skipped++
            continue
          }

          // Update filename directly via Shopify fileUpdate mutation
          if (DRY_RUN) {
            console.info(`${progress} 🔍 Would update filename via Shopify API`)
            console.info(`${progress} ✅ DRY RUN - No changes made`)
          } else {
            console.info(`${progress} 📝 Updating filename via Shopify API...`)
            await shopify.file.update(oldMediaId, {
              filename: newFilename,
            })
            console.info(`${progress} ✅ Success - Filename updated`)
          }
          console.info(``)
          results.processed++
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`${progress} ❌ Failed: ${errorMessage}`)
          console.info(``)

          results.failed++
          results.errors.push({
            productId: product.id,
            productTitle: product.title,
            error: errorMessage,
          })
        }
      }

      // Step 5: Display final summary
      console.info(`\n${'═'.repeat(60)}`)
      console.info(`📊 FINAL SUMMARY ${DRY_RUN ? '(DRY RUN)' : ''}`)
      console.info(`${'═'.repeat(60)}`)
      console.info(`Total products:                    ${results.total}`)
      console.info(
        `${DRY_RUN ? '🔍 Would rename:' : '✅ Successfully renamed:'}  ${results.processed}`
      )
      console.info(`⏭️  Skipped (already optimal):     ${results.skipped}`)
      console.info(`❌ Failed:                         ${results.failed}`)
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

      if (DRY_RUN) {
        console.info(`\n✅ Dry run complete. Set DRY_RUN = false to apply changes.`)
      } else if (results.processed > 0) {
        console.info(`\n🎉 Image rename completed successfully!`)
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`\n❌ Fatal error during batch processing:`, errorMessage)
      console.error(error.stack)
    }

    logTaskBoundary(false, 'Image Rename')
  }

  /**
   * Validate and sanitize AI-generated filename
   */
  private validateFilename(filename: string): boolean {
    // Check length (without extension)
    if (!filename || filename.length === 0 || filename.length > 50) {
      return false
    }

    // Check format: lowercase, hyphens, letters, numbers only
    const validPattern = /^[a-z0-9-]+$/
    return validPattern.test(filename)
  }
}
