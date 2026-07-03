import { validateConfig } from './validateStudioConfig'
import RecipeService, { RecipeError } from 'App/Services/CustomArt/RecipeService'

/**
 * Validation « poster personnalisé » — étage serveur (plan §5.2), défense en profondeur.
 *
 * Réutilise EXACTEMENT :
 *   - le validateur du moteur studio (copie thème diff-null, validateStudioConfig.ts) ;
 *   - les clamps/contraintes recette de RecipeService.parseRecipe (candidates [1,4],
 *     maxAttempts [1,3], prompt.base obligatoire, inputs.title -> reference.texts.title,
 *     tokens.max [1,8]…).
 *
 * AJOUTE par-dessus les règles builder (non couvertes par le moteur) :
 *   - 5 langues obligatoires sur toute map i18n présente ;
 *   - payload.extra.consent = "1" si une étape photo existe ;
 *   - productType présent + regex ^[a-z][a-z0-9-]*$ (unicité vérifiée côté contrôleur, async) ;
 *   - cohérence recette↔config : inputs.tokens.max === photoPolicy.people.max si les deux existent.
 *
 * La RECETTE n'est jamais renvoyée au client (contrat §2) : seuls des messages d'erreur neutres.
 */

const STUDIO_LANGS = ['fr', 'en', 'de', 'nl', 'es']
const PRODUCT_TYPE_RE = /^[a-z][a-z0-9-]*$/
// Chemins de maps i18n considérés par étape (miroir de personalized.js:existingI18nMaps).
const I18N_PATHS = [
  'title',
  'checkpointLabel',
  'label',
  'placeholder',
  'help',
  'cartProperty.label',
  'examples.good.alt',
  'examples.bad.alt',
  'examples.bad.caption',
  'photoPolicy.messages.warn_angle',
  'photoPolicy.messages.reject_framing',
]

export interface PersonalizedError {
  where: string
  message: string
}

function getAtPath(root: any, dotPath: string): any {
  let node = root
  for (const p of dotPath.split('.')) {
    if (!node || typeof node !== 'object') return undefined
    node = node[p]
  }
  return node
}

function isI18nMap(v: any): boolean {
  return v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Valide config + recette (SYNCHRONE, pur). Renvoie la liste des erreurs (vide = OK).
 * L'unicité de productType (lookup Shopify) est ajoutée par le contrôleur.
 */
export function validatePersonalized(studioConfig: any, studioRecipe: any): PersonalizedError[] {
  const errors: PersonalizedError[] = []

  // --- 1) Config : validateur du moteur (mêmes règles que le thème) ---
  if (!studioConfig || typeof studioConfig !== 'object') {
    errors.push({ where: 'config', message: 'studioConfig manquant ou invalide.' })
  } else {
    const base = validateConfig(studioConfig)
    for (const m of base.errors) errors.push({ where: 'config', message: m })

    // --- 2) Règle builder : 5 langues sur toute map i18n présente ---
    for (const step of Array.isArray(studioConfig.steps) ? studioConfig.steps : []) {
      for (const path of I18N_PATHS) {
        const map = getAtPath(step, path)
        if (!isI18nMap(map)) continue
        const missing = STUDIO_LANGS.filter((l) => !(typeof map[l] === 'string' && map[l].trim()))
        if (missing.length)
          errors.push({
            where: `config.${step.name}.${path}`,
            message: `Langue(s) manquante(s) : ${missing.join(', ')} (les 5 langues sont obligatoires).`,
          })
      }
    }

    // --- 3) consent si étape photo ---
    const hasPhoto = (studioConfig.steps || []).some((s: any) => s && s.type === 'photo')
    if (hasPhoto && studioConfig.payload?.extra?.consent !== '1')
      errors.push({
        where: 'config.payload.extra.consent',
        message: 'payload.extra.consent = "1" obligatoire dès qu’une étape photo existe.',
      })

    // --- 4) productType (slug) présent + regex (unicité = contrôleur) ---
    const pt = studioConfig.productType
    if (typeof pt !== 'string' || !PRODUCT_TYPE_RE.test(pt))
      errors.push({
        where: 'config.productType',
        message:
          'productType manquant ou invalide (minuscules/chiffres/tirets, commence par une lettre).',
      })
  }

  // --- 5) Recette : clamps/contraintes de RecipeService (réutilisés, pas dupliqués) ---
  let parsedRecipe: any = null
  try {
    parsedRecipe = RecipeService.parseRecipe(JSON.stringify(studioRecipe ?? {}))
  } catch (e) {
    const reasons = e instanceof RecipeError ? e.reasons : [(e as Error)?.message || String(e)]
    for (const r of reasons) errors.push({ where: 'recipe', message: r })
  }

  // --- 6) Cohérence recette↔config : tokens.max === photoPolicy.people.max si les deux existent ---
  if (parsedRecipe && parsedRecipe.tokens && studioConfig && Array.isArray(studioConfig.steps)) {
    const photo = studioConfig.steps.find((s: any) => s && s.type === 'photo')
    const peopleMax = photo?.photoPolicy?.people?.max
    if (typeof peopleMax === 'number' && parsedRecipe.tokens.max !== peopleMax) {
      errors.push({
        where: 'recipe.inputs.tokens.max',
        message: `inputs.tokens.max (${parsedRecipe.tokens.max}) doit égaler photoPolicy.people.max (${peopleMax}) — sinon le juge photo laisse passer plus de personnes que la recette ne peut nommer.`,
      })
    }
  }

  return errors
}

/**
 * Extrait le productType (slug) d'un metafield studio.config (valeur JSON brute).
 * Utilisé par le contrôleur pour la vérif d'unicité. null si absent/illisible.
 */
export function extractProductType(configJsonValue: string): string | null {
  try {
    const parsed = JSON.parse(configJsonValue)
    return typeof parsed?.productType === 'string' ? parsed.productType : null
  } catch {
    return null
  }
}
