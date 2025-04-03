import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class BlogToTranslateValidator {
  public schema = schema.create({
    id: schema.string(),
    title: schema.string.optional(),
    handle: schema.string.optional(),
  })

  public messages: CustomMessages = {}
}
