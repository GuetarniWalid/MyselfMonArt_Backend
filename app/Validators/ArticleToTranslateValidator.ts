import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class ArticleToTranslateValidator {
  public schema = schema.create({
    body: schema.string.optional(),
    handle: schema.string.optional(),
    image: schema.object.optional().members({
      id: schema.string(),
      altText: schema.string(),
    }),
    seo: schema.object.optional().members({
      title: schema.string.optional(),
      description: schema.string.optional(),
    }),
    summary: schema.string.optional(),
    title: schema.string.optional(),
  })

  public messages: CustomMessages = {}
}
