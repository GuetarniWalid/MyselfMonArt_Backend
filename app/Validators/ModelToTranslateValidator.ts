import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class ModelToTranslateValidator {
  public schema = schema.create({
    id: schema.string(),
    key: schema.string(),
    value: schema.string(),
  })

  public messages: CustomMessages = {}
}
