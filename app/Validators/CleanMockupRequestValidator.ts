import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class CleanMockupRequestValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    image: schema.string(), // la PHOTO de mockup importée (data URI/base64) à nettoyer
    target: schema.enum(['portrait', 'square', 'landscape'] as const), // ratio du support vidé = celui de l'œuvre en cours
    product: schema.enum.optional(['canvas', 'poster', 'tapestry'] as const), // type du support converti (défaut canvas)
  })

  public messages: CustomMessages = {
    'image.required': 'image (base64) is required',
    'target.required': 'target orientation is required',
    'target.enum': 'target must be portrait, square or landscape',
  }
}
