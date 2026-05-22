import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

export default class PinterestPinPayloadValidator {
  public schema = schema.create({
    board_id: schema.string(),
    title: schema.string(),
    description: schema.string(),
    link: schema.string(),
    alt_text: schema.string(),
    media_source: schema.object().members({
      source_type: schema.enum(['image_base64']),
      content_type: schema.enum(['image/png', 'image/jpeg']),
      data: schema.string(),
    }),
  })

  public messages: CustomMessages = {}
}
