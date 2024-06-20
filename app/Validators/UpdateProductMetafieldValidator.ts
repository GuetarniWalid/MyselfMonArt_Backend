import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class UpdateProductMetafieldValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    productId: schema.number(),
    action: schema.enum(['increment', 'decrement'] as const),
  })

  public messages: CustomMessages = {}
}
