import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class ProductToTranslateValidator {
  public schema = schema.create({
    title: schema.string(),
    descriptionHtml: schema.string(),
    handle: schema.string(),
    productType: schema.string(),
    options: schema.array.optional().members(
      schema.object().members({
        optionValues: schema.array.optional().members(
          schema.object().members({
            id: schema.string(),
            name: schema.string(),
          })
        ),
      })
    ),
    seo: schema.object().members({
      title: schema.string(),
      description: schema.string(),
    }),
    media: schema.object().members({
      nodes: schema.array().members(
        schema.object().members({
          id: schema.string(),
          alt: schema.string(),
        })
      ),
    }),
  })

  public messages: CustomMessages = {}
}
