import { schema, rules, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { FACE_ANGLES } from 'App/Services/CustomArt/PhotoCheck'

/**
 * Champs texte du POST /api/custom-art/photo-check (la photo multipart est validée à part
 * via request.file + sharp dans le contrôleur).
 *
 * `faceAngle` est REQUIS (angle du visage attendu par l'œuvre). `hash` (SHA-256 de la photo
 * originale, clé de cache) est OPTIONNEL ici à dessein : un hash absent/malformé ne doit pas
 * faire échouer la validation (et donc déclencher le fail-open du front) — le service tourne
 * quand même, simplement sans mémoriser le verdict. `productType` est purement indicatif.
 */
export default class CustomArtPhotoCheckValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    faceAngle: schema.enum(FACE_ANGLES),
    hash: schema.string.optional({ trim: true }, [rules.maxLength(80)]),
    productType: schema.string.optional({ trim: true }, [rules.maxLength(40)]),
  })

  public messages: CustomMessages = {
    'faceAngle.required': "L'angle du visage attendu est requis.",
    'faceAngle.enum': 'Angle de visage invalide.',
  }
}
