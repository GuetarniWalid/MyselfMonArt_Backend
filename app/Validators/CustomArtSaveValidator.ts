import { schema, rules, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

/** POST /api/custom-art/jobs/:uuid/save — « Sauvegarder ma création » par email. */
export default class CustomArtSaveValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    email: schema.string({ trim: true }, [rules.email(), rules.maxLength(191)]),
    // Version REGARDÉE au moment du save (navigateur de versions du studio) : RANG 1-based,
    // même sémantique que `_version_rank` du panier. Optionnel (anciens fronts / compat) ;
    // un rang hors bornes / non validé / forgé est rabattu sur le meilleur validé côté
    // contrôleur (chosenCandidate). Permet à la reprise de ramener CETTE version.
    version_rank: schema.number.optional([rules.unsigned()]),
  })

  public messages: CustomMessages = {
    'email.required': "L'email est requis.",
    'email.email': "L'email n'est pas valide.",
    'version_rank.number': 'Version invalide.',
  }
}
