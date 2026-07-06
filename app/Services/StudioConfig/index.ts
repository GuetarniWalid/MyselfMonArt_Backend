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

    // --- 4) productType (slug) : OPTIONNEL — absent/vide = généré automatiquement à la
    // publication depuis le titre IA (contrôleur). S'il est fourni, il doit être conforme
    // (unicité vérifiée par le contrôleur).
    const pt = studioConfig.productType
    if (pt !== undefined && pt !== null && pt !== '') {
      if (typeof pt !== 'string' || !PRODUCT_TYPE_RE.test(pt))
        errors.push({
          where: 'config.productType',
          message:
            'productType invalide (minuscules/chiffres/tirets, commence par une lettre) — ou omets-le (généré automatiquement).',
        })
    }
  }

  // --- 5) Recette : clamps/contraintes de RecipeService (réutilisés, pas dupliqués) ---
  let parsedRecipe: any = null
  try {
    parsedRecipe = RecipeService.parseRecipe(JSON.stringify(studioRecipe ?? {}))
  } catch (e) {
    const reasons = e instanceof RecipeError ? e.reasons : [(e as Error)?.message || String(e)]
    for (const r of reasons) errors.push({ where: 'recipe', message: r })
  }

  // --- 6) Cohérence recette↔config ---
  if (parsedRecipe && studioConfig && Array.isArray(studioConfig.steps)) {
    // Clés d'entrée disponibles = payloadKey (ou name) des étapes NON-format.
    const inputKeys = new Set(
      studioConfig.steps
        .filter((s: any) => s && s.type !== 'format' && (s.payloadKey || s.name))
        .map((s: any) => String(s.payloadKey || s.name))
    )

    // a) tokens.max === photoPolicy.people.max si les deux existent.
    if (parsedRecipe.tokens) {
      const photo = studioConfig.steps.find((s: any) => s && s.type === 'photo')
      const peopleMax = photo?.photoPolicy?.people?.max
      if (typeof peopleMax === 'number' && parsedRecipe.tokens.max !== peopleMax) {
        errors.push({
          where: 'recipe.inputs.tokens.max',
          message: `inputs.tokens.max (${parsedRecipe.tokens.max}) doit égaler photoPolicy.people.max (${peopleMax}) — sinon le juge photo laisse passer plus de personnes que la recette ne peut nommer.`,
        })
      }
      // b) tokens.from DOIT résoudre vers une clé d'étape existante (sinon découpage prénoms cassé
      //    à la commande : un renommage de payloadKey laisse la recette pendante).
      if (parsedRecipe.tokens.from && !inputKeys.has(parsedRecipe.tokens.from)) {
        errors.push({
          where: 'recipe.inputs.tokens.from',
          message: `inputs.tokens.from « ${parsedRecipe.tokens.from} » ne correspond à aucune étape (payloadKey) de la config — la génération échouerait à la commande.`,
        })
      }
    }

    // c) chaque {champ} du template de titre DOIT résoudre vers une clé d'étape existante.
    if (parsedRecipe.title && Array.isArray(parsedRecipe.title.fields)) {
      for (const field of parsedRecipe.title.fields) {
        if (!inputKeys.has(field)) {
          errors.push({
            where: 'recipe.inputs.title.template',
            message: `Le champ « {${field}} » du titre ne correspond à aucune étape (payloadKey) de la config.`,
          })
        }
      }
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
