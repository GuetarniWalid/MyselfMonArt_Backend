import { schema, rules, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

/** POST /api/custom-art/jobs/:uuid/save — « Sauvegarder ma création » par email. */
export default class CustomArtSaveValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    email: schema.string({ trim: true }, [rules.email(), rules.maxLength(191)]),
  })

  public messages: CustomMessages = {
    'email.required': "L'email est requis.",
    'email.email': "L'email n'est pas valide.",
  }
}
