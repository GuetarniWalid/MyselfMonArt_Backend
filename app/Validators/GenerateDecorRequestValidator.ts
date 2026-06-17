import { schema, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class GenerateDecorRequestValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    image: schema.string.optional(), // l'oeuvre (data URI/base64) ; en pratique ignorée par le décor (cadre VIDE)
    target: schema.enum(['portrait', 'square', 'landscape'] as const),
    product: schema.enum.optional(['canvas', 'poster', 'tapestry'] as const), // défaut canvas (toile)
    roomType: schema.string.optional(), // ex: living room, bedroom, kitchen
    theme: schema.string.optional(), // override manuel du thème ; sinon dérivé de l'oeuvre
    scene: schema.string.optional(), // brief art-director déjà composé -> rejoué tel quel (familles de ratios)
  })

  public messages: CustomMessages = {
    'image.required': 'image (base64) is required',
    'target.required': 'target orientation is required',
    'target.enum': 'target must be portrait, square or landscape',
  }
}
