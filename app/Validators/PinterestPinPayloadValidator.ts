import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class PinterestPinPayloadValidator {
  public schema = schema.create({
    board_id: schema.string(),
    title: schema.string(),
    description: schema.string(),
    link: schema.string(),
    alt_text: schema.string(),
    media_source: schema.object().members({
      url: schema.string(),
      source_type: schema.enum(['image_url']),
    }),
  })

  public messages: CustomMessages = {}
}
