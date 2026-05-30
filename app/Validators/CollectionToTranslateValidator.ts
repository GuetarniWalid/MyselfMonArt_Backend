import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class CollectionToTranslateValidator {
  public schema = schema.create({
    title: schema.string.optional(),
    descriptionHtml: schema.string.optional(),
    handle: schema.string.optional(),
    intro: schema.object.optional().members({
      id: schema.string(),
      value: schema.string(),
    }),
    seo: schema.object.optional().members({
      title: schema.string.optional(),
      description: schema.string.optional(),
    }),
    image: schema.object.optional().members({
      id: schema.string(),
      altText: schema.string(),
    }),
  })

  public messages: CustomMessages = {}
}
