import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class CreateProductValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    ratio: schema.enum(['square', 'portrait', 'landscape'] as const),
    title: schema.string(),
    body_html: schema.string.optional(),
    vendor: schema.string.optional(),
    product_type: schema.string.optional(),
    status: schema.enum(['draft', 'active', 'archived'] as const),
    tags: schema.string.optional(),
    handle: schema.string.optional(),
    published_scope: schema.enum.optional(['global', 'web'] as const),
    variants: schema.array().members(
      schema.object().members({
        title: schema.string(),
        price: schema.string.optional(),
      })
    ),
    images: schema.array().members(
      schema.object().members({
        src: schema.string(),
        filename: schema.string(),
        alt: schema.string(),
        position: schema.number(),
        product_id: schema.number.optional(),
      })
    ),
  })

  public messages: CustomMessages = {}
}
