import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class GenerateDecorRequestValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    image: schema.string(), // l'oeuvre (data URI/base64) : sert à déduire le thème + le ratio
    target: schema.enum(['portrait', 'square', 'landscape'] as const),
    product: schema.enum.optional(['canvas', 'poster', 'tapestry'] as const), // défaut canvas (toile)
    roomType: schema.string.optional(), // ex: living room, bedroom, kitchen
    theme: schema.string.optional(), // override manuel du thème ; sinon dérivé de l'oeuvre
  })

  public messages: CustomMessages = {
    'image.required': 'image (base64) is required',
    'target.required': 'target orientation is required',
    'target.enum': 'target must be portrait, square or landscape',
  }
}
