import { schema, CustomMessages, rules } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class ExtensionShopifyProductPublisherRequestValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    images: schema.array([rules.minLength(2)]).members(
      schema.object().members({
        base64Image: schema.string(),
        mockupContext: schema.string.optional({}, [rules.minLength(5), rules.maxLength(200)]),
        type: schema.enum(['mockup', 'original'] as const),
      })
    ),
    ratio: schema.enum(['portrait', 'landscape', 'square'] as const),
    productType: schema.enum(['painting', 'poster', 'tapestry'] as const),
    parentCollection: schema.object().members({
      id: schema.string({}, [rules.regex(/^gid:\/\/shopify\/Collection\/\d+$/)]),
      title: schema.string({}, [rules.minLength(1), rules.maxLength(255)]),
    }),
  })

  public messages: CustomMessages = {
    'images.required': 'Images array is required',
    'images.minLength': 'At least 2 images are required (mockup + main artwork)',
    'images.*.base64Image.required': 'Each image must have a base64Image',
    'images.*.mockupContext.minLength': 'mockupContext must be at least 5 characters',
    'images.*.mockupContext.maxLength': 'mockupContext must not exceed 200 characters',
    'images.*.type.required': 'Each image must have a type',
    'images.*.type.enum': 'Image type must be either mockup or original',
    'ratio.required': 'Ratio is required',
    'ratio.enum': 'Ratio must be portrait, landscape, or square',
    'productType.required': 'Product type is required',
    'productType.enum': 'Product type must be painting, poster, or tapestry',
    'parentCollection.required': 'Parent collection is required',
    'parentCollection.id.required': 'Parent collection ID is required',
    'parentCollection.id.regex': 'Parent collection ID must be a valid Shopify GID',
    'parentCollection.title.required': 'Parent collection title is required',
    'parentCollection.title.minLength': 'Parent collection title must be at least 1 character',
    'parentCollection.title.maxLength': 'Parent collection title must not exceed 255 characters',
  }

  /**
   * Custom validation after schema validation
   */
  public async afterValidation() {
    const images = this.ctx.request.input('images')

    // Validation 1: At least one image must have type "original"
    const hasOriginal = images.some((image: any) => image.type === 'original')
    if (!hasOriginal) {
      this.ctx.response.badRequest({
        success: false,
        message: 'Validation failed',
        errors: {
          images: ['At least one image must have type "original"'],
        },
      })
      return
    }

    // Validation 2: Mockup images must have mockupContext
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      if (image.type === 'mockup' && !image.mockupContext) {
        this.ctx.response.badRequest({
          success: false,
          message: 'Validation failed',
          errors: {
            images: [`Image at index ${i} with type "mockup" must have a mockupContext`],
          },
        })
        return
      }
    }
  }
}
