import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class UpdateProductValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    productId: schema.number(),
    ratio: schema.enum(['square', 'portrait', 'landscape', 'personalized portrait'] as const),
    variant: schema.object().members({
      title: schema.string(),
      price: schema.string.optional(),
    }),
  })

  public messages: CustomMessages = {}
}
