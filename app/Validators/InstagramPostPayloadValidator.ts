import { schema, CustomMessages, rules } from '@ioc:Adonis/Core/Validator'

export default class InstagramPostPayloadValidator {
  public schema = schema.create({
    caption: schema.string({ trim: false }, [rules.maxLength(2200)]),
    altText: schema.string({}, [rules.maxLength(125)]),
    shopifyProductId: schema.string(),
    link: schema.string(),
  })

  public messages: CustomMessages = {}
}
