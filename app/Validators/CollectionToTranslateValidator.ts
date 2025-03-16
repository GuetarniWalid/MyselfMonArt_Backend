import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class CollectionToTranslateValidator {
  public schema = schema.create({
    title: schema.string.optional(),
    descriptionHtml: schema.string.optional(),
    handle: schema.string.optional(),
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
