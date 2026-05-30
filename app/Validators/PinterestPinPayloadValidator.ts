import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'

/**
 * Validates the fields common to every pin format. `media_source` shapes differ
 * per format (image_base64 / video_id / multiple_image_base64) and are
 * guaranteed by construction in PinFormatter, so here we only assert the common
 * envelope and that a known source_type is present.
 */
export default class PinterestPinPayloadValidator {
  public schema = schema.create({
    board_id: schema.string(),
    title: schema.string(),
    description: schema.string(),
    link: schema.string(),
    alt_text: schema.string(),
    media_source: schema.object().members({
      source_type: schema.enum(['image_base64', 'video_id', 'multiple_image_base64'] as const),
    }),
  })

  public messages: CustomMessages = {}
}
