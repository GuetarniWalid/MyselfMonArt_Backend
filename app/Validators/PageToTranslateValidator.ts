import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class PageToTranslateValidator {
  public schema = schema.create({
    title: schema.string.optional(),
    descriptionHtml: schema.string.optional(),
    handle: schema.string.optional(),
    seo: schema.object.optional().members({
      title: schema.string.optional(),
      description: schema.string.optional(),
    }),
  })

  public messages: CustomMessages = {}
}
