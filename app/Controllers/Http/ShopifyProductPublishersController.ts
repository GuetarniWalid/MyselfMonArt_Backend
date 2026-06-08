import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import ExtensionShopifyProductPublisherRequestValidator from 'App/Validators/ExtensionShopifyProductPublisherRequestValidator'
import ShopifyProductPublisher from 'App/Services/ShopifyProductPublisher'
import ProductPublisher from 'App/Services/Claude/ProductPublisher'
import { CreateProduct } from 'Types/Product'
import Shopify from 'App/Services/Shopify'

export default class ShopifyProductPublishersController {
  // In-memory idempotency. A publish is slow (AI + Shopify) and can exceed the
  // proxy/CDN timeout (~100s → 524), so the browser sees a failure even though the
  // product was already created server-side. The user then re-clicks → duplicate
  // products. We dedup by a client-provided idempotency key: an in-flight key
  // returns "pending"; a completed key returns the already-created product instead
  // of creating a new one.
  private static readonly inFlightKeys = new Set<string>()
  private static readonly completedKeys = new Map<string, { result: any; at: number }>()
  private static readonly COMPLETED_TTL_MS = 10 * 60 * 1000

  private static rememberCompleted(key: string, result: any) {
    const now = Date.now()
    ShopifyProductPublishersController.completedKeys.set(key, { result, at: now })
    // Opportunistic cleanup of stale entries
    ShopifyProductPublishersController.completedKeys.forEach((v, k) => {
      if (now - v.at > ShopifyProductPublishersController.COMPLETED_TTL_MS) {
        ShopifyProductPublishersController.completedKeys.delete(k)
      }
    })
  }

  public async publishOnShopify({ request, response }: HttpContextContract) {
    const idempotencyKey: string | undefined = request.input('idempotencyKey')

    // Idempotency guard (synchronous check + add, before any await)
    if (idempotencyKey) {
      const done = ShopifyProductPublishersController.completedKeys.get(idempotencyKey)
      if (done) {
        return { ...done.result, deduped: true }
      }
      if (ShopifyProductPublishersController.inFlightKeys.has(idempotencyKey)) {
        return {
          success: true,
          pending: true,
          message: 'Publication déjà en cours, patiente un instant puis vérifie ta boutique.',
        }
      }
      ShopifyProductPublishersController.inFlightKeys.add(idempotencyKey)
    }

    let productPublisher: ShopifyProductPublisher | null = null
    let backgrounded = false

    try {
      const checkedRequest = await request.validate(
        ExtensionShopifyProductPublisherRequestValidator
      )
      const product = {} as CreateProduct
      productPublisher = new ShopifyProductPublisher(checkedRequest)
      const aiService = new ProductPublisher()
      const shopify = new Shopify()

      // Save all images as originals (for Shopify publication)
      const originalImageUrls = await productPublisher.processAllImages()

      // Get compressed main artwork as base64 data URI for AI calls (saves API token costs)
      const compressedMainArtworkDataUri = await productPublisher.getCompressedMainArtworkDataUri()

      // Get original image index
      const originalImageIndex = productPublisher.getOriginalImageIndex()

      // Get collection context and product type for AI
      const collectionTitle = productPublisher.getCollectionTitle()
      const productType = productPublisher.getProductType()

      // Process AI operations on main artwork concurrently (using compressed data URI to save API costs)
      const [descriptionHtml, likesCount] = await Promise.all([
        aiService.generateHtmlDescription(
          compressedMainArtworkDataUri,
          collectionTitle,
          productType
        ),
        productPublisher.getLikesCount(),
      ])

      // Fetch tags in a single optimized call
      const { tags } = await shopify.product.getTagsAndProductTypes()

      // Process AI operations concurrently (using compressed data URI to save API costs)
      const [
        suggestedTags,
        { alt: mainArtworkAlt, filename: mainArtworkFilename },
        { shortTitle, title, metaTitle, metaDescription },
      ] = await Promise.all([
        aiService.suggestTags(tags, compressedMainArtworkDataUri, collectionTitle, productType),
        aiService.generateAlt(compressedMainArtworkDataUri, collectionTitle, productType),
        aiService.generateTitleAndSeo(descriptionHtml, collectionTitle, productType),
      ])

      // Build mockup metadata
      const mockupMetadata = {
        mainAlt: mainArtworkAlt,
        description: descriptionHtml,
        title: title,
        tags: suggestedTags,
        collectionTitle: collectionTitle,
        productType: productType,
      }

      // Build media array with AI-powered alt text generation
      // Use original high-quality images for Shopify (not compressed)
      // All images are sent to Shopify in the same order as received from extension
      product.media = await Promise.all(
        originalImageUrls.map(async (url, index) => {
          // Original artwork: Uses its generated alt and filename
          if (index === originalImageIndex) {
            return {
              src: await productPublisher!.replaceSrcName(url, mainArtworkFilename),
              alt: mainArtworkAlt,
            }
          }

          // First mockup (index 0): White background mockup - uses original artwork's alt
          if (index === 0) {
            // Generate filename slug from alt text (not using mainArtworkFilename to avoid duplicates)
            const filenameSlug = mainArtworkAlt
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
              .substring(0, 80)

            return {
              src: await productPublisher!.replaceSrcName(url, filenameSlug),
              alt: mainArtworkAlt,
            }
          }

          // Other mockups: AI-powered contextual generation
          const mockupContext = productPublisher!.getMockupContext(index)
          const { alt, filename } = await aiService.generateMockupAlt(mockupContext, mockupMetadata)

          return {
            src: await productPublisher!.replaceSrcName(url, filename),
            alt: alt,
          }
        })
      )

      product.title = title
      product.descriptionHtml = descriptionHtml
      product.seo = {
        title: metaTitle,
        description: metaDescription,
      }
      product.tags = suggestedTags
      product.productType = productType
      product.templateSuffix = productType

      // Step 1: Create product WITHOUT category-dependent metafields
      product.metafields = [
        {
          namespace: 'link',
          key: 'mother_collection',
          value: productPublisher.getParentCollectionID(),
          type: 'collection_reference',
        },
        {
          namespace: 'likes',
          key: 'number',
          value: likesCount.toString(),
          type: 'number_integer',
        },
        {
          namespace: 'title',
          key: 'short',
          value: shortTitle,
          type: 'single_line_text_field',
        },
      ]

      const productCreated = await shopify.product.create(product)

      // Step 2: Get model product to copy category from
      const ratio = productPublisher.getRatio()
      // Convert ratio string to model tag
      const modelTag =
        ratio === 'landscape'
          ? 'paysage model'
          : ratio === 'portrait'
            ? 'portrait model'
            : 'square model'
      const modelProduct = await shopify.product.getProductByTag(modelTag, productType)

      // Step 3: Set category BEFORE setting artwork.type metafield
      // IMPORTANT: Category must be set first because artwork.type metafield
      // has constraints based on product category
      if (modelProduct.category?.id) {
        console.log(`🏷️  Setting category from model: ${modelProduct.category.id}`)
        await shopify.category.setProductCategory(productCreated.id, modelProduct.category.id)
      }

      // Step 4: Now set artwork.type metafield (requires category to be set first)
      await shopify.metafield.update(productCreated.id, 'artwork', 'type', productType)
      await shopify.publications.publishProductOnAll(productCreated.id)

      // The product is created and published — respond NOW. Previously we polled
      // Shopify media processing here (up to ~60s), which kept the request open long
      // enough to hit the proxy/CDN timeout (524). The browser then retried and
      // created duplicates. The poll is best-effort status only, so move it off the
      // request path.
      const result = {
        success: true,
        data: { link: productCreated.onlineStoreUrl },
      }
      if (idempotencyKey) {
        ShopifyProductPublishersController.rememberCompleted(idempotencyKey, result)
      }

      // Finish in the background: wait for Shopify to fetch + process the media, THEN
      // clean up the locally-saved source images. Cleaning up earlier would delete the
      // images while Shopify is still fetching them. The response is already sent.
      backgrounded = true
      const publisherRef = productPublisher
      const createdProductId = productCreated.id
      ;(async () => {
        try {
          const { allReady, failedMedia } = await shopify.product.waitForMediaProcessing(
            createdProductId,
            30,
            2000
          )
          if (!allReady) {
            console.warn('[Product Publisher] Some media may still be processing after timeout')
          }
          if (failedMedia.length > 0) {
            console.error(`[Product Publisher] ${failedMedia.length} media failed to process`)
          }
        } catch (bgError: any) {
          console.error('[Product Publisher] background media poll error:', bgError?.message)
        } finally {
          try {
            await publisherRef?.cleanupSavedImages()
          } catch (cleanupError: any) {
            console.error('[Product Publisher] background cleanup error:', cleanupError?.message)
          }
        }
      })()

      return result
    } catch (error) {
      console.error('Product publisher error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        name: error.name,
      })

      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      console.error('Product publisher error:', error)
      return response.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message || 'An unexpected error occurred',
      })
    } finally {
      if (idempotencyKey) {
        ShopifyProductPublishersController.inFlightKeys.delete(idempotencyKey)
      }
      // On success, cleanup is deferred to the background task (it must run after
      // Shopify has fetched the media). Only clean up here when we did NOT background,
      // i.e. an error happened before the product was published.
      if (!backgrounded && productPublisher) {
        await productPublisher.cleanupSavedImages()
      }
    }
  }
}
