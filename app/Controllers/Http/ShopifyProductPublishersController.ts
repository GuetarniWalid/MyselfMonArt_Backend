import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import ExtensionShopifyProductPublisherRequestValidator from 'App/Validators/ExtensionShopifyProductPublisherRequestValidator'
import ShopifyProductPublisher from 'App/Services/ShopifyProductPublisher'
import ProductPublisher from 'App/Services/Claude/ProductPublisher'
import { CreateProduct } from 'Types/Product'
import Shopify from 'App/Services/Shopify'

export default class ShopifyProductPublishersController {
  public async publishOnShopify({ request, response }: HttpContextContract) {
    let productPublisher: ShopifyProductPublisher | null = null

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

      product.metafields = [
        {
          namespace: 'link',
          key: 'mother_collection',
          value: productPublisher.getParentCollectionID(),
          type: 'collection_reference',
        },
      ]
      product.metafields.push({
        namespace: 'likes',
        key: 'number',
        value: likesCount.toString(),
        type: 'number_integer',
      })
      product.metafields.push({
        namespace: 'title',
        key: 'short',
        value: shortTitle,
        type: 'single_line_text_field',
      })

      const productCreated = await shopify.product.create(product)
      await shopify.publications.publishProductOnAll(productCreated.id)

      // Poll media status until all images are processed (Shopify recommendation)
      const { allReady, failedMedia } = await shopify.product.waitForMediaProcessing(
        productCreated.id,
        30, // Max 30 attempts
        2000 // Poll every 2 seconds
      )

      if (!allReady) {
        console.warn('[Product Publisher] Some media may still be processing after timeout')
      }

      if (failedMedia.length > 0) {
        console.error(`[Product Publisher] ${failedMedia.length} media failed to process`)
      }

      return {
        success: true,
        data: {
          link: productCreated.onlineStoreUrl,
          mediaStatus: {
            allReady,
            failedCount: failedMedia.length,
          },
        },
      }
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
      if (productPublisher) {
        await productPublisher.cleanupSavedImages()
      }
    }
  }
}
