import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class UpdateProductPaintingValidator {
  public schema = schema.create({
    type: schema.enum(['painting'] as const),
    productId: schema.number(),
    ratio: schema.enum(['square', 'portrait', 'landscape', 'personalized portrait'] as const),
    variant: schema.object().members({
      title: schema.string(),
      price: schema.string.optional(),
    }),
  })

  public messages: CustomMessages = {}
}
