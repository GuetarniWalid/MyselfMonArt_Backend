import Logger from '@ioc:Adonis/Core/Logger'
import Authentication from 'App/Services/Shopify/Authentication'
import { isBlockedFirstName } from './blocklist'

/**
 * Recette de génération GÉNÉRIQUE d'un produit studio — metafield produit `studio.recipe`
 * (+ `studio.references`, images de style résolues en URLs CDN). Contrat signé :
 * growth/STUDIO-GENERATION-RECIPE-CONTRACT.md (§3 routage, §4 schéma + clamps, §6 validation).
 *
 * SÉCURITÉ (contrat §2) : la recette ne transite JAMAIS côté client — ce module est lu par
 * le contrôleur (routage/validation) et le worker (assemblage) uniquement. Ne jamais mettre
 * un objet recette (ni ses fragments) dans une réponse API ou un message d'erreur client.
 *
 * Cache mémoire TTL 5 min clé productId (contrat §3) : une édition admin du metafield se
 * propage en quelques minutes, y compris l'état « absent » (rollback produit = vider la
 * recette) et l'état « invalide » (produit mal configuré -> 422 propre à la création).
 */

// -- Schéma §4 : bornes serveur (le risque = la faute de frappe admin, pas le visiteur) --
const SUPPORTED_VERSION = 1
const DEFAULT_MODEL = 'gemini-3-pro-image'
const DEFAULT_ASPECT = '3:4'
const DEFAULT_CANDIDATES = 3
const DEFAULT_MAX_ATTEMPTS = 2
const DEFAULT_TOKENS_MAX = 6
const CANDIDATES_RANGE: [number, number] = [1, 4]
const MAX_ATTEMPTS_RANGE: [number, number] = [1, 3]
const TOKENS_MAX_RANGE: [number, number] = [1, 8]
const FRAGMENT_MAX_LEN = 2000
const SLOTS_MAX = 12
const SLOT_MAX_LEN = 40
const REFERENCES_MAX = 8

// IDs *-preview morts depuis le 25/06/2026 (bench M1) : mappés vers l'ID stable, avec warn —
// une recette copiée d'un vieux doc ne doit pas casser en silence.
const DEPRECATED_MODEL_ALIASES: Record<string, string> = {
  'gemini-3-pro-image-preview': 'gemini-3-pro-image',
  'gemini-3.1-flash-image-preview': 'gemini-3.1-flash-image',
  'gemini-2.5-flash-image-preview': 'gemini-2.5-flash-image',
}

// Ratios acceptés par l'API Gemini image — contrôlés à la validation (fail-fast recette).
const SUPPORTED_ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']

// -- Champs sources du payload (amendement B.5) : nom borné + liste réservée (une recette
// `{email}` interpolerait une donnée personnelle/technique dans un prompt) --
const FIELD_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,30}$/
const RESERVED_FIELDS = new Set([
  'photo',
  'variantId',
  'consent',
  'email',
  'sessionToken',
  'website',
  'productType',
  'format',
  'frame',
])

// -- Validation des valeurs client (§6) --
// Guillemets/backticks STRIPPÉS avant contrôle : ils servent de délimiteurs dans les
// fragments (défense injection de prompt). Typographiques inclus par prudence.
const STRIP_QUOTES_RE = /[«»"“”`]/g
const TOKEN_CHARSET_RE = /^[\p{L}\p{M}\p{N}'’ .\-]+$/u
const TOKEN_MAX_LEN = 24
const TITLE_FIELD_MAX_LEN = 30
const PLACEHOLDER_RE = /\{([^{}]+)\}/g

export class RecipeError extends Error {
  constructor(public reasons: string[]) {
    super(`Recette studio invalide : ${reasons.join(' ; ')}`)
  }
}

export interface StudioRecipe {
  version: number
  engine: 'gemini'
  /** ID modèle stable (alias -preview déjà mappés) */
  model: string
  aspect: string
  candidates: number
  maxAttempts: number
  /** Spéc des textes par personne, null si la recette n'en consomme pas */
  tokens: { from: string; split: boolean; max: number } | null
  /** Spéc du titre assemblé, null si non configuré */
  title: { template: string; required: boolean; fields: string[] } | null
  /** Ce qui est ÉCRIT dans l'image de référence (source des substitutions §5) */
  referenceTexts: { title: string | null; slots: string[] }
  /** Fragments de prompt : base obligatoire, le reste surcharge les défauts du worker */
  prompt: {
    base: string
    imageRoles?: string
    countLine?: string
    perPerson?: string
    addExtra?: string
    removeExtra?: string
    replaceTitle?: string
    footer?: string
  }
  judge: { text: boolean; figureCount: boolean }
}

export interface LoadedRecipe {
  recipe: StudioRecipe
  /** URLs CDN des images de `studio.references`, dans l'ordre admin */
  referenceUrls: string[]
}

/** Entrées client validées/sanitizées — persistées sur le job (colonne `inputs`). */
export interface SanitizedGenericInputs {
  tokens: string[]
  values: Record<string, string>
  title: string | null
}

type CacheEntry =
  | { kind: 'absent' }
  | { kind: 'ok'; loaded: LoadedRecipe }
  | { kind: 'invalid'; reasons: string[] }

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { entry: CacheEntry; at: number }>()

export default class RecipeService extends Authentication {
  /**
   * Recette (validée) + URLs de référence d'un produit. `null` = pas de recette (le
   * contrôleur route alors vers le chemin legacy). Throw RecipeError si la recette
   * existe mais est invalide (produit mal configuré -> 422 propre, jamais de fallback
   * foot silencieux). Cache 5 min, états absent/invalide compris.
   */
  public static async forProduct(productId: string): Promise<LoadedRecipe | null> {
    const hit = cache.get(productId)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return RecipeService.unwrap(hit.entry)
    }

    const entry = await new RecipeService().fetchEntry(productId)
    cache.set(productId, { entry, at: Date.now() })
    return RecipeService.unwrap(entry)
  }

  private static unwrap(entry: CacheEntry): LoadedRecipe | null {
    if (entry.kind === 'absent') return null
    if (entry.kind === 'invalid') throw new RecipeError(entry.reasons)
    return entry.loaded
  }

  /** Requête unique : metafield recette + références résolues en URLs (MediaImage/GenericFile). */
  private async fetchEntry(productId: string): Promise<CacheEntry> {
    const query = `query StudioRecipe($id: ID!) {
      product(id: $id) {
        recipe: metafield(namespace: "studio", key: "recipe") { value }
        references: metafield(namespace: "studio", key: "references") {
          references(first: ${REFERENCES_MAX}) {
            nodes {
              ... on MediaImage { image { url } }
              ... on GenericFile { url }
            }
          }
        }
      }
    }`
    const data = await this.fetchGraphQL(query, { id: productId })
    const raw = data?.product?.recipe?.value
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      return { kind: 'absent' }
    }

    const nodes: any[] = data?.product?.references?.references?.nodes || []
    const referenceUrls = nodes
      .map((n) => n?.image?.url || n?.url || null)
      .filter((u): u is string => Boolean(u))

    try {
      const recipe = RecipeService.parseRecipe(raw)
      if (referenceUrls.length === 0) {
        // La technique validée (substitution sur image de référence) exige >= 1 réf :
        // fail-fast à la création plutôt qu'un job qui échoue au traitement.
        throw new RecipeError(['studio.references est vide (au moins 1 image de style requise)'])
      }
      Logger.info(
        'custom-art recipe chargée product=%s model=%s candidates=%s refs=%s',
        productId,
        recipe.model,
        recipe.candidates,
        referenceUrls.length
      )
      return { kind: 'ok', loaded: { recipe, referenceUrls } }
    } catch (error) {
      const reasons =
        error instanceof RecipeError ? error.reasons : [(error as Error)?.message || String(error)]
      // Les raisons restent côté serveur (logs/telemetry) — jamais dans une réponse client.
      Logger.error('custom-art recipe INVALIDE product=%s : %s', productId, reasons.join(' ; '))
      return { kind: 'invalid', reasons }
    }
  }

  // --------------------------------------------------------------------------
  // Validation de la RECETTE (schéma §4 + clamps + amendements B.4-B.6)
  // --------------------------------------------------------------------------

  public static parseRecipe(raw: string): StudioRecipe {
    let json: any
    try {
      json = JSON.parse(raw)
    } catch {
      throw new RecipeError(['JSON invalide'])
    }
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new RecipeError(['la recette doit être un objet JSON'])
    }

    const reasons: string[] = []

    const version = Number(json.version)
    if (!Number.isInteger(version) || version < 1) {
      reasons.push('version manquante ou invalide')
    } else if (version > SUPPORTED_VERSION) {
      reasons.push(`version ${version} non supportée (max ${SUPPORTED_VERSION})`)
    }

    const engine = json.engine === undefined ? 'gemini' : String(json.engine)
    if (engine !== 'gemini') {
      reasons.push(`engine "${engine}" non supporté (v1 : gemini)`)
    }

    let model = json.model === undefined ? DEFAULT_MODEL : String(json.model).trim()
    if (DEPRECATED_MODEL_ALIASES[model]) {
      Logger.warn(
        'custom-art recipe: modèle deprecated "%s" mappé vers "%s"',
        model,
        DEPRECATED_MODEL_ALIASES[model]
      )
      model = DEPRECATED_MODEL_ALIASES[model]
    }
    if (!/^gemini-[a-z0-9.\-]+$/i.test(model)) {
      reasons.push(`model "${model}" invalide (attendu un ID gemini-*)`)
    }

    const aspect = json.aspect === undefined ? DEFAULT_ASPECT : String(json.aspect).trim()
    if (!SUPPORTED_ASPECTS.includes(aspect)) {
      reasons.push(`aspect "${aspect}" non supporté (${SUPPORTED_ASPECTS.join(', ')})`)
    }

    const candidates = RecipeService.clampInt(json.candidates, DEFAULT_CANDIDATES, CANDIDATES_RANGE)
    const maxAttempts = RecipeService.clampInt(
      json.maxAttempts,
      DEFAULT_MAX_ATTEMPTS,
      MAX_ATTEMPTS_RANGE
    )

    // inputs.tokens
    let tokens: StudioRecipe['tokens'] = null
    const rawTokens = json.inputs?.tokens
    if (rawTokens !== undefined && rawTokens !== null) {
      const from = String(rawTokens.from || '').trim()
      if (!FIELD_NAME_RE.test(from)) {
        reasons.push(`inputs.tokens.from "${from}" invalide`)
      } else if (RESERVED_FIELDS.has(from)) {
        reasons.push(`inputs.tokens.from "${from}" est un champ réservé`)
      }
      tokens = {
        from,
        split: rawTokens.split === undefined ? true : Boolean(rawTokens.split),
        max: RecipeService.clampInt(rawTokens.max, DEFAULT_TOKENS_MAX, TOKENS_MAX_RANGE),
      }
    }

    // inputs.title (placeholders = champs du payload, whitelistés)
    let title: StudioRecipe['title'] = null
    const rawTitle = json.inputs?.title
    if (rawTitle !== undefined && rawTitle !== null) {
      const template = String(rawTitle.template || '').trim()
      if (!template || template.length > 200) {
        reasons.push('inputs.title.template manquant ou trop long (200 max)')
      }
      const fields: string[] = []
      for (const match of template.matchAll(PLACEHOLDER_RE)) {
        const field = match[1]
        if (!FIELD_NAME_RE.test(field)) {
          reasons.push(`placeholder de titre "{${field}}" invalide`)
        } else if (RESERVED_FIELDS.has(field)) {
          reasons.push(`placeholder de titre "{${field}}" est un champ réservé`)
        } else if (!fields.includes(field)) {
          fields.push(field)
        }
      }
      title = {
        template,
        required: rawTitle.required === undefined ? true : Boolean(rawTitle.required),
        fields,
      }
    }

    // reference.texts (source des substitutions)
    const rawRefTexts = json.reference?.texts || {}
    const refTitle =
      rawRefTexts.title === undefined || rawRefTexts.title === null
        ? null
        : String(rawRefTexts.title).trim().slice(0, 60) || null
    const slots: string[] = Array.isArray(rawRefTexts.slots)
      ? rawRefTexts.slots
          .slice(0, SLOTS_MAX)
          .map((s: any) => String(s).trim().slice(0, SLOT_MAX_LEN))
          .filter((s: string) => s.length > 0)
      : []
    if (Array.isArray(rawRefTexts.slots) && rawRefTexts.slots.length > SLOTS_MAX) {
      reasons.push(`reference.texts.slots dépasse ${SLOTS_MAX} entrées`)
    }
    // Cohérence titre (amendement B.6) : la substitution exige un texte source dans la réf.
    if (title && !refTitle) {
      reasons.push(
        'inputs.title configuré mais reference.texts.title est null (substitution impossible)'
      )
    }

    // prompt : base OBLIGATOIRE, fragments bornés
    const rawPrompt = json.prompt || {}
    const base = String(rawPrompt.base || '').trim()
    if (!base) reasons.push('prompt.base est obligatoire')
    const fragmentKeys = [
      'base',
      'imageRoles',
      'countLine',
      'perPerson',
      'addExtra',
      'removeExtra',
      'replaceTitle',
      'footer',
    ] as const
    const prompt: any = { base }
    for (const key of fragmentKeys) {
      const value = rawPrompt[key]
      if (value === undefined || value === null) continue
      const str = String(value)
      if (str.length > FRAGMENT_MAX_LEN) {
        reasons.push(`prompt.${key} dépasse ${FRAGMENT_MAX_LEN} caractères`)
        continue
      }
      if (key !== 'base' && str.trim()) prompt[key] = str.trim()
    }

    const judge = {
      text: json.judge?.text === undefined ? Boolean(tokens) : Boolean(json.judge.text),
      figureCount:
        json.judge?.figureCount === undefined ? Boolean(tokens) : Boolean(json.judge.figureCount),
    }

    if (reasons.length > 0) throw new RecipeError(reasons)

    return {
      version,
      engine: 'gemini',
      model,
      aspect,
      candidates,
      maxAttempts,
      tokens,
      title,
      referenceTexts: { title: refTitle, slots },
      prompt,
      judge,
    }
  }

  // --------------------------------------------------------------------------
  // Validation du PAYLOAD client (§6) — dynamique (pilotée par la recette), donc
  // hors validateurs Adonis statiques. Retourne le set sanitizé ou un message 422.
  // --------------------------------------------------------------------------

  public static validateGenericPayload(
    recipe: StudioRecipe,
    getField: (name: string) => unknown
  ): { ok: true; inputs: SanitizedGenericInputs } | { ok: false; message: string } {
    // 1) Tokens (textes par personne)
    let tokens: string[] = []
    if (recipe.tokens) {
      const spec = recipe.tokens
      const raw = getField(spec.from)
      let parts: string[]
      if (Array.isArray(raw)) {
        // v2 (liste répétable) : tableau pris tel quel
        parts = raw.map((v) => String(v))
      } else if (typeof raw === 'string' && raw.trim().startsWith('[')) {
        // tableau JSON sérialisé dans un champ multipart
        try {
          const parsed = JSON.parse(raw)
          parts = Array.isArray(parsed) ? parsed.map((v) => String(v)) : [String(raw)]
        } catch {
          parts = [String(raw)]
        }
      } else if (raw !== undefined && raw !== null && String(raw).trim()) {
        parts = spec.split ? String(raw).split(/[,;\n\r]+/) : [String(raw)]
      } else {
        parts = []
      }

      tokens = parts.map((p) => RecipeService.sanitizeValue(p)).filter((p) => p.length > 0)

      if (tokens.length < 1 || tokens.length > spec.max) {
        return {
          ok: false,
          message: `Indiquez entre 1 et ${spec.max} prénoms, séparés par des virgules.`,
        }
      }
      for (const token of tokens) {
        if (token.length > TOKEN_MAX_LEN || !TOKEN_CHARSET_RE.test(token)) {
          return {
            ok: false,
            message: `« ${token.slice(0, 30)} » contient des caractères non imprimables ou est trop long (${TOKEN_MAX_LEN} max).`,
          }
        }
        // Les textes sont PEINTS sur l'œuvre : même blocklist que le prénom foot (M10),
        // même message neutre (on ne répète pas le terme, on ne moralise pas).
        if (isBlockedFirstName(token)) {
          return { ok: false, message: 'Un des textes demandés ne peut pas être imprimé.' }
        }
      }
    }

    // 2) Champs du titre (placeholders du template)
    const values: Record<string, string> = {}
    let title: string | null = null
    if (recipe.title) {
      let missing = false
      for (const field of recipe.title.fields) {
        const raw = getField(field)
        if (raw === undefined || raw === null || !String(raw).trim()) {
          missing = true
          if (recipe.title.required) {
            return { ok: false, message: `Le champ « ${field} » est requis.` }
          }
          continue
        }
        const value = RecipeService.sanitizeValue(String(raw))
        if (
          value.length < 1 ||
          value.length > TITLE_FIELD_MAX_LEN ||
          !TOKEN_CHARSET_RE.test(value)
        ) {
          return {
            ok: false,
            message: `Le champ « ${field} » est invalide (lettres, chiffres, espaces et tirets, ${TITLE_FIELD_MAX_LEN} caractères max).`,
          }
        }
        if (isBlockedFirstName(value)) {
          return { ok: false, message: 'Un des textes demandés ne peut pas être imprimé.' }
        }
        values[field] = value
      }
      if (!missing) {
        title = recipe.title.template.replace(PLACEHOLDER_RE, (whole, field) =>
          values[field] !== undefined ? values[field] : whole
        )
      }
    }

    return { ok: true, inputs: { tokens, values, title } }
  }

  /** Nettoyage d'une valeur client : strip guillemets/backticks, trim, espaces internes repliés. */
  private static sanitizeValue(raw: string): string {
    return raw.replace(STRIP_QUOTES_RE, '').replace(/\s+/g, ' ').trim()
  }

  private static clampInt(raw: any, fallback: number, [min, max]: [number, number]): number {
    const n = Number(raw)
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, Math.trunc(n)))
  }
}
