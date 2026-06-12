import { schema, rules, CustomMessages } from '@ioc:Adonis/Core/Validator'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/**
 * Corps JSON des POST/PUT /admin/custom-art/teams (création + édition, M4).
 * Les images de maillot sont uploadées à part (multipart, endpoint kit-images).
 * Couleurs = pastilles du studio (color pickers admin), format #rrggbb.
 */
export default class CustomArtTeamValidator {
  constructor(protected ctx: HttpContextContract) {}

  public schema = schema.create({
    name: schema.string({ trim: true }, [rules.minLength(2), rules.maxLength(100)]),
    slug: schema.string({ trim: true }, [
      rules.minLength(2),
      rules.maxLength(100),
      rules.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    ]),
    // Alias de recherche du studio (ex: ["om", "olympique de marseille"])
    aliases: schema.array
      .optional()
      .members(schema.string({ trim: true }, [rules.minLength(1), rules.maxLength(60)])),
    colors: schema.object.optional().members({
      primary: schema.string.optional({ trim: true }, [rules.regex(HEX_COLOR)]),
      secondary: schema.string.optional({ trim: true }, [rules.regex(HEX_COLOR)]),
      accent: schema.string.optional({ trim: true }, [rules.regex(HEX_COLOR)]),
    }),
    // Notes de fidélité maillot (décision grill §0.13) : injectées dans le prompt de
    // génération et fournies au juge. null = champ vidé depuis l'admin.
    fidelityNotes: schema.string.nullableAndOptional({ trim: true }, [rules.maxLength(2000)]),
    active: schema.boolean.optional(),
  })

  public messages: CustomMessages = {
    'name.required': 'Le nom est requis.',
    'name.minLength': 'Le nom doit faire au moins 2 caractères.',
    'name.maxLength': 'Le nom est limité à 100 caractères.',
    'slug.required': 'Le slug est requis.',
    'slug.regex': 'Slug invalide : minuscules, chiffres et tirets uniquement (ex: rc-lens).',
    'slug.maxLength': 'Le slug est limité à 100 caractères.',
    'aliases.*.maxLength': 'Un alias est limité à 60 caractères.',
    'colors.primary.regex': 'Couleur principale invalide (format #rrggbb).',
    'colors.secondary.regex': 'Couleur secondaire invalide (format #rrggbb).',
    'colors.accent.regex': 'Couleur d’accent invalide (format #rrggbb).',
    'fidelityNotes.maxLength': 'Les notes de fidélité sont limitées à 2000 caractères.',
  }
}
