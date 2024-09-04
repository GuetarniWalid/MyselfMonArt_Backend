import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class UpdateProductTapestryValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    type: schema.enum(['tapestry'] as const),
    productId: schema.number(),
    variant: schema.object().members({
      title: schema.string(),
      price: schema.string.optional(),
    }),
    cm2: schema.number(),
  })

  public messages: CustomMessages = {}
}
