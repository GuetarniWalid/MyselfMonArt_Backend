import type { StudioRecipe } from './RecipeService'

/**
 * Assemblage du prompt GÉNÉRIQUE (contrat growth/STUDIO-GENERATION-RECIPE-CONTRACT.md §5) —
 * déterministe, piloté par la recette produit. Chaque fragment est surchargeable par la
 * recette ; les défauts ci-dessous (FR — technique testée par Walid en FR) vivent ici.
 *
 * ANTI-INJECTION (§6) : les valeurs client ne sont interpolées QUE dans les placeholders
 * ({to}, {tokens}, titre assemblé), toujours encadrées de « » posées PAR LE FRAGMENT —
 * jamais concaténées libres dans `base`. Les guillemets/backticks ont été strippés des
 * valeurs à la validation (RecipeService), un client ne peut donc pas fermer un délimiteur.
 *
 * Ordre des images transmis au provider (contrat partagé avec le prompt) :
 *   image 1 = photo client · images 2..n = studio.references dans l'ordre admin.
 */

export const DEFAULT_GENERIC_FRAGMENTS = {
  imageRoles:
    "La première image jointe est la PHOTO DU CLIENT : c'est la SEULE source pour les " +
    'personnes (leur nombre, tailles relatives, poses, coiffures). La seconde image est la ' +
    'RÉFÉRENCE DE STYLE : reproduis exactement son style de trait, sa composition, sa ' +
    "typographie et sa mise en page — mais n'en copie NI les personnes NI les textes.",
  countLine:
    'La composition finale compte EXACTEMENT {n} personne(s), dans cet ordre de gauche à ' +
    'droite : {tokens}. Aucun autre texte que ceux demandés.',
  perPerson:
    'Remplace le texte « {from} » par « {to} » (orthographe EXACTE, même casse, même ' +
    'typographie que la référence).',
  addExtra:
    'Ajoute une figure supplémentaire dans le même style, cohérente avec la photo, avec le ' +
    'texte « {to} » sous elle, dans le même lettrage.',
  removeExtra: 'Supprime la figure associée au texte « {from} » et son texte.',
  replaceTitle: 'Remplace le titre « {from} » par « {to} » (orthographe exacte).',
} as const

type FragmentKey = keyof typeof DEFAULT_GENERIC_FRAGMENTS

/**
 * Interpolation bornée aux placeholders connus, via callback (jamais de chaîne de
 * remplacement brute : une valeur client contenant `$&` serait interprétée par replace).
 * Un placeholder inconnu d'un fragment surchargé reste verbatim (inoffensif).
 */
function interpolate(fragment: string, vars: Record<string, string>): string {
  return fragment.replace(/\{(n|tokens|from|to|index)\}/g, (whole, key) =>
    vars[key] !== undefined ? vars[key] : whole
  )
}

export interface GenericPromptInput {
  recipe: StudioRecipe
  /** Textes par personne, gauche -> droite (sanitizés) */
  tokens: string[]
  /** Titre assemblé (sanitizé), null si non configuré */
  title: string | null
}

/** Construit le prompt assemblé (§5) : imageRoles, base, countLine, titre, boucle personnes, footer. */
export function buildGenericPrompt(input: GenericPromptInput): string {
  const { recipe, tokens, title } = input
  const slots = recipe.referenceTexts.slots
  const n = tokens.length
  const s = slots.length

  const frag = (key: FragmentKey): string => recipe.prompt[key] || DEFAULT_GENERIC_FRAGMENTS[key]

  const lines: string[] = []
  lines.push(frag('imageRoles'))
  lines.push(recipe.prompt.base)
  if (n > 0) {
    lines.push(interpolate(frag('countLine'), { n: String(n), tokens: tokens.join(', ') }))
  }
  if (title && recipe.referenceTexts.title) {
    lines.push(interpolate(frag('replaceTitle'), { from: recipe.referenceTexts.title, to: title }))
  }
  // Boucle personnes (§5) : substitutions 1..min(N,S), puis ajouts (N > S), puis retraits (N < S)
  for (let i = 1; i <= Math.min(n, s); i++) {
    lines.push(
      interpolate(frag('perPerson'), { from: slots[i - 1], to: tokens[i - 1], index: String(i) })
    )
  }
  for (let i = s + 1; i <= n; i++) {
    lines.push(interpolate(frag('addExtra'), { to: tokens[i - 1], index: String(i) }))
  }
  for (let i = n + 1; i <= s; i++) {
    lines.push(interpolate(frag('removeExtra'), { from: slots[i - 1], index: String(i) }))
  }
  if (recipe.prompt.footer) lines.push(recipe.prompt.footer)

  return lines.filter((l) => l && l.trim().length > 0).join('\n')
}
