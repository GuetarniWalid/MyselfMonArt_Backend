import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import ExtensionMidjourneyRequestValidator from 'App/Validators/ExtensionMidjourneyRequestValidator'
import Midjourney from 'App/Services/Midjourney'
import OpenAI from 'App/Services/ChatGPT/Midjourney'
import { CreateProduct } from 'Types/Product'
import Shopify from 'App/Services/Shopify'
import WebhooksController from './WebhooksController'

export default class MidjourneysController {
  public async publishOnShopify({ request, response }: HttpContextContract) {
    let midjourney: Midjourney | null = null

    try {
      const checkedRequest = await request.validate(ExtensionMidjourneyRequestValidator)
      const product = {} as CreateProduct
      midjourney = new Midjourney(checkedRequest.base64Image)
      const openAI = new OpenAI()
      const shopify = new Shopify()

      const ratio = midjourney.getAspectRatio(checkedRequest)
      const optimizedImage = await midjourney.getOptimizedImage(ratio)

      const [descriptionHtml, parentCollection, mainImage, likesCount, tags, productTypes] =
        await Promise.all([
          openAI.generateHtmlDescription(optimizedImage, checkedRequest.prompt),
          midjourney.getParentCollection(optimizedImage),
          midjourney.getMainImage(ratio),
          midjourney.getLikesCount(),
          shopify.product.getAllTags(),
          shopify.product.getAllProductTypes(),
        ])

      const imagesWithBackground = await midjourney.getImagesWithBackground(
        optimizedImage,
        ratio,
        parentCollection
      )

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
        await openAI.generateTitleAndSeo(optimizedImage, descriptionHtml),
      ])

      product.title = title
      product.descriptionHtml = descriptionHtml
      product.seo = {
        title: metaTitle,
        description: metaDescription,
      }
      product.media = await Promise.all(
        imagesWithBackground.map(async (image, index) => ({
          src: await midjourney!.replaceSrcName(image, altImagesWithBackground[index].filename),
          alt: altImagesWithBackground[index].alt,
        }))
      )
      product.media.splice(1, 0, {
        src: await midjourney!.replaceSrcName(mainImage, filenameMainImage),
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

      const webhooksController = new WebhooksController()
      await webhooksController.handlePaintingCreate(productCreated.id)

      return {
        success: true,
        data: {
          link: productCreated.onlineStoreUrl,
        },
      }
    } catch (error) {
      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.status(422).json({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
        })
      }

      console.error('Midjourney error:', error)
      return response.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message || 'An unexpected error occurred',
      })
    } finally {
      if (midjourney) {
        await midjourney.cleanupSavedImages()
      }
    }
  }
}
