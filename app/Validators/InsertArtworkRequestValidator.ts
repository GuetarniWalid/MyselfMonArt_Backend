import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class InsertArtworkRequestValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    decor: schema.string(), // le décor validé (data URI, cadre vide)
    artwork: schema.string(), // l'oeuvre à insérer (data URI)
    target: schema.enum(['portrait', 'square', 'landscape'] as const),
    product: schema.enum.optional(['canvas', 'poster', 'tapestry'] as const),
    fidelity: schema.enum.optional(['standard', 'high'] as const), // high = Nano Banana Pro
  })

  public messages: CustomMessages = {
    'decor.required': 'decor (base64) is required',
    'artwork.required': 'artwork (base64) is required',
    'target.required': 'target orientation is required',
  }
}
