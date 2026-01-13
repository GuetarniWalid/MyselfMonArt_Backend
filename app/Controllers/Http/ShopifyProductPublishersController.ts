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
      productPublisher = new ShopifyProductPublisher(checkedRequest.base64Image)
      const openAI = new ProductPublisher()
      const shopify = new Shopify()

      const ratio = productPublisher.getAspectRatio(checkedRequest)
      const optimizedImage = await productPublisher.getOptimizedImage(ratio)

      // Process non-Shopify operations concurrently
      const [descriptionHtml, parentCollection, mainImage, likesCount] = await Promise.all([
        openAI.generateHtmlDescription(optimizedImage),
        productPublisher.getParentCollection(optimizedImage),
        productPublisher.getMainImage(ratio),
        productPublisher.getLikesCount(),
      ])

      // Fetch tags and product types in a single optimized call
      const { tags, productTypes } = await shopify.product.getTagsAndProductTypes()

      const imagesWithBackground = await productPublisher.getImagesWithBackground(
        optimizedImage,
        ratio,
        descriptionHtml
      )

      // Process AI operations concurrently
      const [
        suggestedTags,
        suggestedProductType,
        altImagesWithBackground,
        { alt: altMainImage, filename: filenameMainImage },
        { title, metaTitle, metaDescription },
      ] = await Promise.all([
        openAI.suggestTags(tags, optimizedImage),
        openAI.suggestProductType(productTypes, optimizedImage),
        Promise.all(imagesWithBackground.map(async (image) => await openAI.generateAlt(image))),
        openAI.generateAlt(optimizedImage),
        await openAI.generateTitleAndSeo(descriptionHtml),
      ])

      product.title = title
      product.descriptionHtml = descriptionHtml
      product.seo = {
        title: metaTitle,
        description: metaDescription,
      }
      product.media = await Promise.all(
        imagesWithBackground.map(async (image, index) => ({
          src: await productPublisher!.replaceSrcName(
            image,
            altImagesWithBackground[index].filename
          ),
          alt: altImagesWithBackground[index].alt,
        }))
      )
      product.media.splice(1, 0, {
        src: await productPublisher!.replaceSrcName(mainImage, filenameMainImage),
        alt: altMainImage,
      })
      product.tags = suggestedTags
      product.productType = suggestedProductType
      product.templateSuffix = 'painting'

      product.metafields = [
        {
          namespace: 'link',
          key: 'mother_collection',
          value: parentCollection.id,
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
}
