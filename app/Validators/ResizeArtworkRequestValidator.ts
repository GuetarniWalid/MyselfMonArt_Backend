import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class ResizeArtworkRequestValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    image: schema.string(), // data URI ou base64 brut de l'oeuvre à recadrer
    target: schema.enum(['portrait', 'square', 'landscape'] as const),
    quality: schema.enum.optional(['low', 'high'] as const), // défaut low (aperçu)
    // recompose (défaut) = recomposer l'original ; enhance = re-rendu fidèle de l'aperçu LOW validé
    mode: schema.enum.optional(['recompose', 'enhance'] as const),
  })

  public messages: CustomMessages = {
    'image.required': 'image (base64) is required',
    'target.required': 'target orientation is required',
    'target.enum': 'target must be portrait, square or landscape',
  }
}
