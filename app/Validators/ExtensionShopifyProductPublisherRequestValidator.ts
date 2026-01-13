import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class ExtensionShopifyProductPublisherRequestValidator {
  public schema = schema.create({
    aspectRatio: schema.string.optional(),
    base64Image: schema.string(),
    prompt: schema.string(),
  })

  public messages: CustomMessages = {}
}
