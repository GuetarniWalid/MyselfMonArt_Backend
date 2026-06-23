import { schema, rules, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

/**
 * Champs texte du POST /api/custom-art/jobs (la photo multipart est validée à part
 * via request.file + sharp dans le contrôleur).
 * Règles plan §4/§7 : prénom <=12 caractères lettres/tirets/espaces, numéro 1-99.
 *
 * variantId (contrat front, revue J1) = SOURCE DE VÉRITÉ pour format/finition (la
 * correspondance est dérivée des options de la variante côté back). format/frame
 * restent acceptés en secours : le contrôleur exige variantId OU (format ET frame).
 */
export default class CustomArtJobValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    teamId: schema.number([rules.unsigned()]),
    playerName: schema.string({ trim: true }, [
      rules.minLength(1),
      rules.maxLength(12),
      // Lettres (accents compris), tirets et espaces uniquement ; commence par une lettre
      rules.regex(/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\- ]*$/),
      // Le prénom est PEINT sur l'œuvre : blocklist injures FR/EN (M10), message neutre
      rules.printableFirstName(),
    ]),
    playerNumber: schema.number([rules.range(1, 99)]),
    // Variante Shopify choisie : id numérique ou gid complet
    variantId: schema.string.optional({ trim: true }, [
      rules.maxLength(60),
      rules.regex(/^(?:gid:\/\/shopify\/ProductVariant\/)?\d{1,20}$/),
    ]),
    format: schema.enum.optional(['30x40', '60x80'] as const),
    // Finition cadre : slug ('none' + finitions définies côté produit Shopify)
    frame: schema.string.optional({ trim: true }, [
      rules.maxLength(30),
      rules.regex(/^[a-z0-9-]+$/),
    ]),
    // E-mail facultatif : le front le joint dès qu'il le connaît (cap « 3e essai+ =
    // e-mail requis ») — associé à la session AVANT le contrôle des caps.
    email: schema.string.optional({ trim: true }, [rules.email(), rules.maxLength(191)]),
    // Type de produit (purement indicatif, même contrat que le photo-check) : segmente
    // l'estimation glissante renvoyée dans `estimatedMs`. Absent => bucket 'default'.
    productType: schema.string.optional({ trim: true }, [rules.maxLength(40)]),
  })

  public messages: CustomMessages = {
    'teamId.required': 'Choisis une équipe.',
    'teamId.number': 'Équipe invalide.',
    'playerName.required': 'Le prénom est requis.',
    'playerName.maxLength': 'Le prénom est limité à 12 caractères.',
    'playerName.regex': 'Le prénom ne peut contenir que des lettres, tirets et espaces.',
    'playerName.printableFirstName': 'Ce prénom ne peut pas être imprimé.',
    'playerNumber.required': 'Le numéro est requis.',
    'playerNumber.range': 'Le numéro doit être compris entre 1 et 99.',
    'variantId.regex': 'Variante invalide.',
    'format.enum': 'Format invalide (30x40 ou 60x80).',
    'frame.regex': 'Finition invalide.',
    'email.email': "L'email n'est pas valide.",
  }
}
