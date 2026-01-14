import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import ExtensionShopifyProductPublisherRequestValidator from 'App/Validators/ExtensionShopifyProductPublisherRequestValidator'
import ShopifyProductPublisher from 'App/Services/ShopifyProductPublisher'
import ProductPublisher from 'App/Services/ChatGPT/ProductPublisher'
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
      const openAI = new ProductPublisher()
      const shopify = new Shopify()

      // Process all images (mockups + main artwork)
      const processedImageUrls = await productPublisher.processAllImages()

      // Get main artwork URL (first image with type: "original")
      const originalImageIndex = productPublisher.getOriginalImageIndex()
      const mainArtworkUrl = processedImageUrls[originalImageIndex]

      // Get collection context and product type for AI
      const collectionTitle = productPublisher.getCollectionTitle()
      const productType = productPublisher.getProductType()

      // Process AI operations on main artwork concurrently
      const [descriptionHtml, likesCount] = await Promise.all([
        openAI.generateHtmlDescription(mainArtworkUrl, collectionTitle, productType),
        productPublisher.getLikesCount(),
      ])

      // Fetch tags in a single optimized call
      const { tags } = await shopify.product.getTagsAndProductTypes()

      // Process AI operations concurrently
      const [
        suggestedTags,
        { alt: mainArtworkAlt, filename: mainArtworkFilename },
        { title, metaTitle, metaDescription },
      ] = await Promise.all([
        openAI.suggestTags(tags, mainArtworkUrl, collectionTitle, productType),
        openAI.generateAlt(mainArtworkUrl, collectionTitle, productType),
        openAI.generateTitleAndSeo(descriptionHtml),
      ])

      // Extract pure artwork description for mockup alts
      const artworkDescription = this.extractArtworkDescription(mainArtworkAlt, title)

      // Build media array with intelligent alt text generation
      product.media = await Promise.all(
        processedImageUrls.map(async (url, index) => {
          // Original artwork: use AI-generated alt
          if (index === originalImageIndex) {
            return {
              src: await productPublisher!.replaceSrcName(url, mainArtworkFilename),
              alt: mainArtworkAlt,
            }
          }

          // Mockups: combine mockupContext with artwork description programmatically
          const mockupContext = productPublisher!.getMockupContext(index)
          const { alt, filename } = openAI.generateMockupAlt(mockupContext, artworkDescription)

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

      const productCreated = await shopify.product.create(product)
      await shopify.publications.publishProductOnAll(productCreated.id)

      return {
        success: true,
        data: {
          link: productCreated.onlineStoreUrl,
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

  /**
   * Extract pure artwork description from main alt text
   */
  private extractArtworkDescription(mainAlt: string, fallbackTitle: string): string {
    return mainAlt || fallbackTitle
  }
}
