import type { StudioRecipe, RecipeRefRole } from './RecipeService'

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

  // -- Annonce des images PAR RÔLE (parité foot) : utilisées SEULEMENT si des références à rôle
  // sont transmises. Sinon `imageRoles` ci-dessus reste seul, et rien ne change.
  // `{index}` = position de l'image dans l'envoi · `{label}` = libellé de l'option choisie.
  refStyle:
    "L'IMAGE {index} est une RÉFÉRENCE DE STYLE : reproduis exactement son style de trait, sa " +
    "composition, sa typographie et sa mise en page — n'en copie NI les personnes NI les textes.",
  refFront:
    "L'IMAGE {index} montre la vue de FACE de {label} : c'est la référence EXACTE du design de " +
    'face (motifs, col, blason, sponsor).',
  refBack:
    "L'IMAGE {index} montre la vue de DOS de {label} : c'est la référence EXACTE du design du " +
    'dos et de son lettrage.',
  refScene: "L'IMAGE {index} est une référence de SCÈNE et de POSE.",
  notesBlock:
    'CONSIGNES DE FIDÉLITÉ (non négociables — ce qui est décrit ci-dessous doit être reproduit ' +
    'EXACTEMENT) :',
} as const

type FragmentKey = keyof typeof DEFAULT_GENERIC_FRAGMENTS

/** Rôle d'image -> fragment qui l'annonce. */
const ROLE_FRAGMENT: Record<RecipeRefRole, FragmentKey> = {
  style: 'refStyle',
  front: 'refFront',
  back: 'refBack',
  scene: 'refScene',
}

/**
 * Position de la 1re image de référence dans l'envoi au modèle. L'image 1 est TOUJOURS la photo
 * du client (contrat partagé prompt <-> worker <-> juge, cf. en-tête de ce fichier).
 */
const FIRST_REF_IMAGE_INDEX = 2

/**
 * Placeholders : clés techniques ({n}, {tokens}, {from}, {to}, {index}) ET noms des champs
 * déclarés par la recette ({playerName}, {playerNumber}…), avec un modificateur de casse
 * optionnel — `{playerName:upper}` produit « WALID » (le chemin foot imprime le prénom en
 * capitales sur le maillot ; la valeur envoyée au modèle doit l'être aussi).
 */
const PLACEHOLDER_RE = /\{([a-zA-Z][a-zA-Z0-9_]{0,30})(?::(upper|lower))?\}/g

/**
 * Interpolation via callback (jamais de chaîne de remplacement brute : une valeur client
 * contenant `$&` serait interprétée par replace). Un placeholder sans valeur reste verbatim.
 *
 * `hasOwnProperty` est OBLIGATOIRE : sans lui, `{toString}` ou `{constructor}` résoudraient sur
 * Object.prototype et injecteraient du code JS dans le prompt.
 */
function interpolate(fragment: string, vars: Record<string, string>): string {
  return fragment.replace(PLACEHOLDER_RE, (whole, key: string, modifier?: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return whole
    const value = vars[key]
    if (typeof value !== 'string') return whole
    if (modifier === 'upper') return value.toUpperCase()
    if (modifier === 'lower') return value.toLowerCase()
    return value
  })
}

export interface GenericPromptInput {
  recipe: StudioRecipe
  /** Textes par personne, gauche -> droite (sanitizés) */
  tokens: string[]
  /** Titre assemblé (sanitizé), null si non configuré */
  title: string | null
  /**
   * Valeurs client des champs déclarés (`inputs.fields`), sanitizées. Exposées à TOUS les
   * fragments comme `{nomDuChamp}` — c'est ainsi qu'un prénom ou un numéro entre dans le prompt.
   * Absent (recette sans champs) => aucun placeholder supplémentaire, sortie inchangée.
   */
  fieldValues?: Record<string, string>
  /**
   * Rôles des images de référence, DANS L'ORDRE D'ENVOI au modèle (la photo client étant
   * l'image 1). Fournir ce tableau remplace le bloc `imageRoles` unique par une phrase par
   * image — c'est la parité avec le chemin foot, qui annonce FACE/DOS explicitement.
   * Une référence de scène/pose est simplement une entrée de rôle `scene` : si le modèle
   * n'en accepte pas, l'appelant ne la joint pas et la pose reste décrite en texte dans `base`.
   */
  references?: RecipeRefRole[]
  /** Libellé de l'option choisie (ex. « Paris »), exposé aux fragments comme `{label}`. */
  label?: string | null
  /** Consigne de fidélité de l'option choisie (backend-only), injectée dans le bloc de notes. */
  notes?: string | null
}

/** Construit le prompt assemblé (§5) : imageRoles, base, countLine, titre, boucle personnes, footer. */
export function buildGenericPrompt(input: GenericPromptInput): string {
  const { recipe, tokens, title } = input
  const slots = recipe.referenceTexts.slots
  const n = tokens.length
  const s = slots.length

  const frag = (key: FragmentKey): string => recipe.prompt[key] || DEFAULT_GENERIC_FRAGMENTS[key]

  // Variables offertes à tous les fragments : valeurs des champs déclarés + libellé de l'option.
  // Objet SANS prototype : `{toString}` ne peut rien résoudre même si la garde changeait un jour.
  const vars: Record<string, string> = Object.assign(Object.create(null), input.fieldValues || {})
  if (input.label) vars.label = input.label

  const lines: string[] = []
  // Annonce des images : une phrase PAR IMAGE quand les rôles sont connus (parité foot),
  // sinon le bloc unique historique.
  const roles = input.references || []
  if (roles.length > 0) {
    roles.forEach((role, i) => {
      lines.push(
        interpolate(frag(ROLE_FRAGMENT[role]), {
          ...vars,
          index: String(FIRST_REF_IMAGE_INDEX + i),
        })
      )
    })
  } else {
    lines.push(interpolate(frag('imageRoles'), vars))
  }
  // Consignes non négociables : note de l'option choisie, puis consignes communes au produit.
  const noteLines = [input.notes, recipe.prompt.commonNotes].filter(
    (l): l is string => typeof l === 'string' && l.trim().length > 0
  )
  // Exposées à l'interpolation sous `{notes}` : un prompt calibré peut ainsi les placer EXACTEMENT
  // où il les attend (le prompt foot les veut au milieu de sa liste d'exigences, pas à la fin).
  // Sans notes, la clé n'est pas posée et `{notes}` resterait verbatim — donc rien ne change.
  if (noteLines.length > 0) vars.notes = noteLines.join('\n')

  lines.push(interpolate(recipe.prompt.base, vars))

  // Bloc autonome UNIQUEMENT si le prompt ne les a pas déjà placées lui-même : sinon elles
  // apparaîtraient deux fois.
  const basePlacesNotes = /\{notes\}/.test(recipe.prompt.base)
  if (noteLines.length > 0 && !basePlacesNotes) {
    lines.push(interpolate(frag('notesBlock'), vars))
    noteLines.forEach((l) => lines.push(`  ${interpolate(l, vars)}`))
  }
  // Les fragments suivants voient AUSSI les champs déclarés (`...vars`), les clés techniques
  // restant prioritaires. Sans champs déclarés, `vars` est vide -> comportement inchangé.
  if (n > 0) {
    lines.push(interpolate(frag('countLine'), { ...vars, n: String(n), tokens: tokens.join(', ') }))
  }
  if (title && recipe.referenceTexts.title) {
    lines.push(
      interpolate(frag('replaceTitle'), { ...vars, from: recipe.referenceTexts.title, to: title })
    )
  }
  // Boucle personnes (§5) : substitutions 1..min(N,S), puis ajouts (N > S), puis retraits (N < S)
  for (let i = 1; i <= Math.min(n, s); i++) {
    lines.push(
      interpolate(frag('perPerson'), {
        ...vars,
        from: slots[i - 1],
        to: tokens[i - 1],
        index: String(i),
      })
    )
  }
  for (let i = s + 1; i <= n; i++) {
    lines.push(interpolate(frag('addExtra'), { ...vars, to: tokens[i - 1], index: String(i) }))
  }
  for (let i = n + 1; i <= s; i++) {
    lines.push(interpolate(frag('removeExtra'), { ...vars, from: slots[i - 1], index: String(i) }))
  }
  if (recipe.prompt.footer) lines.push(interpolate(recipe.prompt.footer, vars))

  return lines.filter((l) => l && l.trim().length > 0).join('\n')
}
