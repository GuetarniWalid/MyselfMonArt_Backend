import type {
  StudioRecipe,
  RecipeRefPick,
  RecipeRefRole,
  SanitizedFieldValue,
} from './RecipeService'

/**
 * Sélection des images de référence à joindre à UNE génération — fonction PURE.
 *
 * C'est la brique qui remplace, côté générique, ce que le chemin legacy foot fait en dur :
 * « le client a choisi Paris => joins le maillot de Paris (face + dos), puis la pose ».
 * Le legacy lit une table SQL (`custom_art_teams`) ; ici tout vient des metafields du produit
 * (`studio.references` pour les images, `studio.recipe` pour le lien option -> images).
 *
 * DEUX MODES
 * - HISTORIQUE (aucune sélection déclarée) : toutes les images de `studio.references` sont
 *   jointes, dans l'ordre de l'admin, sans rôle connu. C'est le comportement actuel, préservé
 *   à l'identique pour les produits existants.
 * - EXPLICITE (la recette déclare `references` et/ou des `options[].references`) : seules les
 *   images désignées sont jointes, chacune avec son rôle — le prompt peut alors les annoncer
 *   une par une (« IMAGE 3 montre la vue de DOS de Paris »).
 *
 * DÉSIGNATION PAR NOM, jamais par position : réordonner la liste dans l'admin Shopify ne doit
 * rien casser. La correspondance se fait sur le NOM DE FICHIER de l'URL CDN, sans la query
 * string, insensible à la casse.
 */

/**
 * Plafond d'images en mode HISTORIQUE (aucune sélection déclarée), où tout est envoyé au modèle.
 * C'est l'ancien cap de `studio.references` : il reste la limite de ce mode, pendant que le cap de
 * stockage, lui, a été relevé pour les produits qui déclarent leur sélection.
 */
const HISTORIC_REFERENCES_MAX = 8

export interface ResolvedReference {
  url: string
  role: RecipeRefRole
}

export interface ResolvedReferences {
  /** Images à joindre, DANS L'ORDRE D'ENVOI au modèle (après la photo client). */
  items: ResolvedReference[]
  /**
   * true = sélection explicite (rôles connus -> le prompt annonce chaque image).
   * false = mode historique (toutes les images, rôles inconnus -> bloc `imageRoles` unique).
   */
  explicit: boolean
}

/** Erreur de configuration produit : la recette désigne une image absente ou ambiguë. */
export class ReferenceResolutionError extends Error {
  constructor(public reasons: string[]) {
    super(`Références studio irrésolues : ${reasons.join(' ; ')}`)
  }
}

/** Nom de fichier d'une URL CDN, sans query string ni fragment, en minuscules. */
export function referenceFileName(url: string): string {
  const noQuery = String(url).split('?')[0].split('#')[0]
  const segment = noQuery.split('/').filter(Boolean).pop() || ''
  try {
    return decodeURIComponent(segment).toLowerCase()
  } catch {
    // Séquence d'échappement invalide dans l'URL : on garde le segment brut.
    return segment.toLowerCase()
  }
}

export interface ResolveReferencesInput {
  recipe: StudioRecipe
  /** Valeurs client validées (RecipeService.validateGenericPayload). */
  fields?: Record<string, SanitizedFieldValue>
  /** URLs de `studio.references`, dans l'ordre de l'admin. */
  available: string[]
}

/**
 * Construit la liste ordonnée des images à envoyer.
 *
 * ORDRE (contrat partagé avec le prompt et le juge) : d'abord les images de l'option choisie,
 * puis les images partagées. Le foot y retrouve exactement son contrat legacy — maillots
 * d'abord, référence de pose en dernier.
 *
 * @throws ReferenceResolutionError si une image désignée est introuvable ou ambiguë. C'est une
 * faute de CONFIGURATION produit : mieux vaut un échec net qu'une génération silencieusement
 * privée de son maillot.
 */
export function resolveGenericReferences(input: ResolveReferencesInput): ResolvedReferences {
  const { recipe, available } = input
  const fields = input.fields || {}

  // Images désignées par l'option choisie de chaque champ `choice`, dans l'ordre de la recette.
  const picks: RecipeRefPick[] = []
  for (const spec of recipe.fields || []) {
    if (spec.type !== 'choice') continue
    const chosen = fields[spec.name]
    if (!chosen) continue
    const option = spec.options.find((o) => o.key === chosen.value)
    if (option) picks.push(...option.references)
  }
  // Puis les images partagées (ex. la pose) — donc en DERNIER dans l'envoi.
  if (recipe.references) picks.push(...recipe.references)

  // Aucune sélection déclarée : comportement historique, tout est joint sans rôle connu.
  if (picks.length === 0) {
    // GARDE-FOU indissociable du relèvement de REFERENCES_MAX (8 -> 40) : en mode historique,
    // TOUTES les images partent au modèle. Au-delà de ce plafond, la configuration est forcément
    // une erreur — un produit qui range beaucoup d'images doit déclarer laquelle sert à quoi.
    // Mieux vaut un échec net qu'un envoi de 40 images avec un prompt qui n'en annonce qu'une.
    if (available.length > HISTORIC_REFERENCES_MAX) {
      throw new ReferenceResolutionError([
        `${available.length} images dans studio.references sans aucune sélection déclarée ` +
          `(maximum ${HISTORIC_REFERENCES_MAX}) — déclarer les images par option, ou en retirer`,
      ])
    }
    return {
      items: available.map((url) => ({ url, role: 'style' as RecipeRefRole })),
      explicit: false,
    }
  }

  // Index nom de fichier -> URLs (plusieurs = ambiguïté, refusée).
  const byName = new Map<string, string[]>()
  for (const url of available) {
    const name = referenceFileName(url)
    const list = byName.get(name)
    if (list) list.push(url)
    else byName.set(name, [url])
  }

  const reasons: string[] = []
  const items: ResolvedReference[] = []
  for (const pick of picks) {
    const matches = byName.get(pick.name.toLowerCase())
    if (!matches || matches.length === 0) {
      reasons.push(`image "${pick.name}" introuvable dans studio.references`)
      continue
    }
    if (matches.length > 1) {
      reasons.push(`image "${pick.name}" ambiguë (${matches.length} fichiers de ce nom)`)
      continue
    }
    items.push({ url: matches[0], role: pick.role })
  }

  if (reasons.length > 0) throw new ReferenceResolutionError(reasons)
  return { items, explicit: true }
}
