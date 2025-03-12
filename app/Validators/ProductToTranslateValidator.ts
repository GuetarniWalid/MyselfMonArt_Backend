import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class ProductToTranslateValidator {
  public schema = schema.create({
    title: schema.string.optional(),
    descriptionHtml: schema.string.optional(),
    handle: schema.string.optional(),
    productType: schema.string.optional(),
    options: schema.array.optional().members(
      schema.object().members({
        id: schema.string.optional(),
        name: schema.string.optional(),
        optionValues: schema.array.optional().members(
          schema.object().members({
            id: schema.string(),
            name: schema.string(),
          })
        ),
      })
    ),
    seo: schema.object.optional().members({
      title: schema.string.optional(),
      description: schema.string.optional(),
    }),
    media: schema.object.optional().members({
      id: schema.string(),
      alts: schema.array().members(schema.string()),
    }),
  })

  public messages: CustomMessages = {}
}
