import { schema, rules, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

/**
 * Champs texte du POST /api/custom-art/photo-check (la photo multipart est validée à part
 * via request.file + sharp dans le contrôleur).
 *
 * `faceAngle` est REQUIS (angle du visage attendu par l'œuvre) mais validé comme STRING libre,
 * PAS comme enum : une valeur hors enum (ex. un nouveau cran thème, ou `three_quarter` à
 * underscore) ne doit PAS faire échouer la validation. Un 422 ici déclencherait le fail-open du
 * front et ferait perdre TOUS les contrôles (nsfw, flou…), pas seulement l'angle. La valeur est
 * normalisée par normalizeFaceAngle() côté service : cran inconnu → contrainte d'angle ignorée.
 *
 * `hash` (SHA-256 de la photo originale, clé de cache) est OPTIONNEL à dessein : un hash
 * absent/malformé ne doit pas faire échouer la validation — le service tourne quand même,
 * simplement sans mémoriser le verdict. `productType` est purement indicatif.
 */
export default class CustomArtPhotoCheckValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    faceAngle: schema.string({ trim: true }, [rules.maxLength(40)]),
    hash: schema.string.optional({ trim: true }, [rules.maxLength(80)]),
    productType: schema.string.optional({ trim: true }, [rules.maxLength(40)]),
  })

  public messages: CustomMessages = {
    'faceAngle.required': "L'angle du visage attendu est requis.",
  }
}
