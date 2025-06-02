import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class ModelToTranslateValidator {
  public schema = schema.create({
    id: schema.string(),
    key: schema.string(),
    value: schema.string.optional(),
    file: schema.object.optional().members({
      alt: schema.string(),
      fileName: schema.string(),
      oldUrl: schema.string(),
      url: schema.string(),
    }),
  })

  public messages: CustomMessages = {}
}
