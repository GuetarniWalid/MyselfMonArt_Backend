import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class ExtensionMidjourneyRequestValidator {
  public schema = schema.create({
    aspectRatio: schema.string.optional(),
    base64Image: schema.string(),
    prompt: schema.string(),
  })

  public messages: CustomMessages = {}
}
