import Logger from '@ioc:Adonis/Core/Logger'
import Env from '@ioc:Adonis/Core/Env'
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
// Cap de `studio.references`. VOLONTAIREMENT MAINTENU À 8 pour l'instant.
// Le modèle « tout-en-références » (PLAN §0.1) demandera ~31 images pour le foot (15 équipes x 1-2
// maillots + la pose), donc un cap plus haut. Mais AUJOURD'HUI le worker envoie TOUTES les
// références chargées au modèle, sans aucun tri : Worker.ts (referenceUrls.map(fetchBuffer) ->
// kitRefBuffers) puis GeminiProvider (une inlineData par buffer). Relever le cap MAINTENANT ne
// servirait à rien (aucun produit n'a plus d'1 référence) et armerait un piège : le jour où un
// admin rangerait 15 maillots dans le metafield, le produit enverrait 16 images au modèle avec un
// prompt qui n'en annonce qu'une.
// => Le cap ne sera relevé qu'en P4, EN MÊME TEMPS que le branchement de la sélection par nom
//    (RecipeField.options[].references) dans le worker. Un seul changement, jamais l'un sans l'autre.
const REFERENCES_MAX = 8

// -- Champs déclarés par la recette (extension ADDITIVE de la v1 — le numéro de version du contrat
// ne bouge PAS, cf. PLAN §3 « discipline de version ») : le socle du choix discret (ex. l'équipe
// foot) qui sélectionne un SOUS-ENSEMBLE d'images de référence + sa consigne de fidélité.
// Absents d'une recette existante -> aucune de ces clés n'est produite, sortie inchangée. --
const FIELDS_MAX = 12
// Aligné sur REFERENCES_MAX : chaque option exige >= 1 image, donc plus d'options que d'images
// disponibles serait un contrat intenable. À relever avec REFERENCES_MAX (P4), pas avant.
const CHOICE_OPTIONS_MAX = 40
const CHOICE_REFS_MAX = 4
const REF_NAME_MAX_LEN = 120
const NOTES_MAX_LEN = 600
const TEXT_MAX_LENGTH_LIMIT = 200
const NUMBER_ABS_LIMIT = 1000000
// Rôle sémantique d'une image : annoncé au prompt (« IMAGE 2 = DOS du maillot ») et au juge.
// Remplace la déduction par suffixe de fichier du chemin legacy foot (kits.ts).
const REF_ROLES = new Set(['style', 'front', 'back', 'scene'])
// Slot de placement quand la valeur est PEINTE sur l'œuvre (ex. 'back-name', 'back-number').
const PRINT_SLOT_RE = /^[a-z][a-z0-9-]{0,30}$/
const OPTION_KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,40}$/

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
  // Membres d'Object.prototype : ces noms finissent en clés de `values: Record<string, string>`
  // (et de la map d'interpolation du titre). `__proto__` est déjà exclu par FIELD_NAME_RE (qui
  // impose une initiale alphabétique), mais ceux-ci passent la regex. Défense en profondeur.
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
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

/** Rôle sémantique d'une image de référence, annoncé au prompt ET au juge. */
export type RecipeRefRole = 'style' | 'front' | 'back' | 'scene'

/**
 * Une image de `studio.references` désignée PAR NOM — jamais par position (décision du 22/07,
 * PLAN §0.1) : réordonner la liste dans l'admin Shopify ne doit RIEN casser.
 */
export interface RecipeRefPick {
  /** nom de fichier (ou fragment distinctif) résolu dans studio.references */
  name: string
  role: RecipeRefRole
}

/**
 * Une option d'un champ `choice` (ex. une équipe de foot) : les images qu'elle joint à la
 * génération + sa consigne de fidélité. Remplace la table SQL `custom_art_teams` du chemin legacy
 * — tout vit désormais dans les metafields de la fiche produit.
 */
export interface RecipeChoiceOption {
  key: string
  /** Libellé lisible, facultatif : l'UI a le sien (i18n) dans studio.config. Sert aux logs/mails. */
  label: string | null
  references: RecipeRefPick[]
  /** Consigne de fidélité injectée au prompt et au juge. BACKEND-ONLY (secret métier). */
  notes: string | null
}

/**
 * Champ d'entrée déclaré par la recette, au-delà des `tokens`/`title` de la v1. Porte ce que le
 * moteur générique ne savait pas exprimer : un CHOIX discret qui change les images jointes, et un
 * NOMBRE borné peint sur l'œuvre.
 */
export interface RecipeField {
  name: string
  type: 'choice' | 'number' | 'text'
  required: boolean
  /** Slot de placement si la valeur est PEINTE sur l'œuvre (ex. 'back-name'), sinon null. */
  printOnArtwork: string | null
  /** number */
  min: number | null
  max: number | null
  integer: boolean
  /** text */
  maxLength: number | null
  /** choice — vide pour les autres types */
  options: RecipeChoiceOption[]
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
  /**
   * Champs déclarés (v1.1, additif). ABSENTE d'une recette v1 : la clé n'est même pas produite,
   * pour que la sortie d'une recette existante (famille LIVE) reste strictement identique.
   */
  fields?: RecipeField[]
  /**
   * Images PARTAGÉES : jointes à CHAQUE génération quel que soit le choix du client (ex. la
   * référence de pose du foot, commune à toutes les équipes). Les images propres à une option
   * vivent, elles, dans `fields[].options[].references`.
   *
   * ABSENTE => comportement historique conservé : toutes les images de `studio.references` sont
   * jointes, dans l'ordre de l'admin. Déclarer ce bloc fait passer le produit en sélection
   * explicite (partagées + celles de l'option choisie), et rien d'autre n'est envoyé.
   */
  references?: RecipeRefPick[]
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
    // -- Annonce des images PAR RÔLE (parité foot) : une phrase par image jointe, avec {index}
    // (numéro de l'image dans l'envoi) et {label} (libellé de l'option choisie, ex. « Paris »).
    // Utilisés seulement si des références à rôle sont transmises ; sinon `imageRoles` suffit.
    refStyle?: string
    refFront?: string
    refBack?: string
    refScene?: string
    /** En-tête du bloc de consignes non négociables (notes de fidélité). */
    notesBlock?: string
    /** Consignes communes à TOUTES les options, ajoutées sous la note de l'option choisie. */
    commonNotes?: string
  }
  judge: {
    text: boolean
    figureCount: boolean
    /**
     * Le juge reçoit-il la photo du client et les images de référence ? ABSENT par défaut : il ne
     * voit que le candidat, comme aujourd'hui. Indispensable au foot — sans les maillots sous les
     * yeux, un juge note la fidélité d'un design qu'il n'a jamais vu.
     */
    seesReferences?: boolean
  }
}

export interface LoadedRecipe {
  recipe: StudioRecipe
  /** URLs CDN des images de `studio.references`, dans l'ordre admin */
  referenceUrls: string[]
}

/** Valeur validée d'un champ déclaré (`inputs.fields` de la recette). */
export interface SanitizedFieldValue {
  type: 'choice' | 'number' | 'text'
  /** Clé de l'option retenue (choice), nombre en chaîne (number) ou texte sanitizé (text). */
  value: string
  /**
   * `choice` uniquement : libellé humain FIGÉ au moment de la commande. Snapshoté exprès —
   * si l'option est renommée ou retirée plus tard, la commande passée doit continuer de dire
   * ce que le client a réellement choisi.
   */
  label: string | null
}

/** Entrées client validées/sanitizées — persistées sur le job (colonne `inputs`). */
export interface SanitizedGenericInputs {
  tokens: string[]
  values: Record<string, string>
  title: string | null
  /**
   * Champs déclarés validés. ABSENT (clé non produite) si la recette n'en déclare pas, pour que
   * le contenu persisté d'un produit existant reste identique.
   */
  fields?: Record<string, SanitizedFieldValue>
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
  /**
   * Kill-switch de ROLLBACK (contrat PLAN §3) : `STUDIO_GENERIC_DISABLE_PRODUCTS` = liste (virgules)
   * d'IDs produit FORCÉS sur le chemin legacy, quelle que soit leur recette. Accepte le GID complet
   * (`gid://shopify/Product/123`) OU l'id numérique (`123`). Lu à CHAQUE appel (jamais mis en cache) :
   * un changement d'env + restart (app ET cron) fait effet sans attendre le TTL du cache recette ni
   * toucher au metafield Shopify. Env absente = jamais actif. Même esprit que CUSTOM_ART_WORKER_DISABLED.
   */
  public static isProductKillSwitched(productId: string): boolean {
    const raw = Env.get('STUDIO_GENERIC_DISABLE_PRODUCTS')
    if (!raw) return false
    const numeric = productId.split('/').pop() || productId
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .some((entry) => entry.length > 0 && (entry === productId || entry === numeric))
  }

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

    // inputs.fields (v1.1) : choix discret -> images nommées + notes, nombre borné, texte peint.
    // Absent d'une recette v1 -> null -> la clé `fields` n'est pas produite du tout (sortie inchangée).
    const recipeFields = RecipeService.parseFields(json.inputs?.fields, reasons)
    // Collision de noms : un champ déclaré ne doit pas doubler la source des tokens ni un
    // placeholder du titre — la même clé de payload serait lue deux fois avec des règles différentes.
    if (recipeFields) {
      for (const f of recipeFields) {
        if (tokens && f.name === tokens.from) {
          reasons.push(`inputs.fields : "${f.name}" est déjà la source de inputs.tokens`)
        }
        if (title && title.fields.includes(f.name)) {
          reasons.push(`inputs.fields : "${f.name}" est déjà un placeholder de inputs.title`)
        }
      }
    }

    // references (partagées) : jointes à chaque génération quel que soit le choix du client.
    // Absentes -> null -> la clé n'est pas produite et le worker garde son comportement historique.
    const sharedRefs =
      json.references === undefined || json.references === null
        ? null
        : RecipeService.parseRefPicks(json.references, 'references', reasons, REFERENCES_MAX)

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
      // Parité foot (additifs) : annonce par rôle d'image + bloc de consignes non négociables.
      'refStyle',
      'refFront',
      'refBack',
      'refScene',
      'notesBlock',
      'commonNotes',
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

    const judge: StudioRecipe['judge'] = {
      text: json.judge?.text === undefined ? Boolean(tokens) : Boolean(json.judge.text),
      figureCount:
        json.judge?.figureCount === undefined ? Boolean(tokens) : Boolean(json.judge.figureCount),
      // Clé ajoutée UNIQUEMENT si déclarée : une recette existante produit le même objet qu'avant.
      ...(json.judge?.seesReferences === undefined
        ? {}
        : { seesReferences: Boolean(json.judge.seesReferences) }),
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
      // Spread CONDITIONNEL : sans `inputs.fields`, la clé n'existe pas dans l'objet retourné —
      // une recette v1 (famille LIVE) produit donc exactement le même objet qu'avant la v1.1.
      ...(recipeFields ? { fields: recipeFields } : {}),
      ...(sharedRefs ? { references: sharedRefs } : {}),
      referenceTexts: { title: refTitle, slots },
      prompt,
      judge,
    }
  }

  /**
   * Parse `inputs.fields[]` (v1.1). `null` si la clé est absente -> la recette reste une v1 stricte.
   * Toute anomalie est poussée dans `reasons` : une recette mal formée est REJETÉE à la validation
   * (fail-fast, 422 propre), jamais appliquée à moitié en silence.
   */
  private static parseFields(raw: any, reasons: string[]): RecipeField[] | null {
    if (raw === undefined || raw === null) return null
    if (!Array.isArray(raw)) {
      reasons.push('inputs.fields doit être un tableau')
      return null
    }
    // Tableau VIDE = aucun champ déclaré : on renvoie null pour que la clé `fields` ne soit même pas
    // produite. Sinon l'invariant « pas de champs = objet strictement identique » tomberait dans ce
    // cas précis (`[]` est truthy, le spread conditionnel produirait `fields: []`).
    if (raw.length === 0) return null
    if (raw.length > FIELDS_MAX) {
      reasons.push(`inputs.fields dépasse ${FIELDS_MAX} entrées`)
      return null
    }

    const out: RecipeField[] = []
    const seenNames = new Set<string>()

    for (let i = 0; i < raw.length; i++) {
      const item = raw[i]
      const where = `inputs.fields[${i}]`
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        reasons.push(`${where} doit être un objet`)
        continue
      }

      const name = String(item.name || '').trim()
      if (!FIELD_NAME_RE.test(name)) {
        reasons.push(`${where}.name "${name}" invalide`)
        continue
      }
      if (RESERVED_FIELDS.has(name)) {
        reasons.push(`${where}.name "${name}" est un champ réservé`)
        continue
      }
      if (seenNames.has(name)) {
        reasons.push(`${where}.name "${name}" est en double`)
        continue
      }
      seenNames.add(name)

      const type = String(item.type || '').trim()
      if (type !== 'choice' && type !== 'number' && type !== 'text') {
        reasons.push(`${where}.type "${type}" non supporté (choice, number, text)`)
        continue
      }

      let printOnArtwork: string | null = null
      if (item.printOnArtwork !== undefined && item.printOnArtwork !== null) {
        const slot = String(item.printOnArtwork).trim()
        if (!PRINT_SLOT_RE.test(slot)) {
          reasons.push(`${where}.printOnArtwork "${slot}" invalide`)
          continue
        }
        printOnArtwork = slot
      }

      const field: RecipeField = {
        name,
        type,
        required: item.required === undefined ? true : Boolean(item.required),
        printOnArtwork,
        min: null,
        max: null,
        integer: true,
        maxLength: null,
        options: [],
      }

      if (type === 'number') {
        // typeof STRICT plutôt que Number() : la coercion accepterait `null`, `""`, `[]` et `false`
        // comme 0 — une borne silencieuse née d'une faute de frappe admin, soit exactement le risque
        // n°1 que ce module doit couvrir. Un `min: null` doit être REFUSÉ, pas lu comme 0.
        if (
          typeof item.min !== 'number' ||
          typeof item.max !== 'number' ||
          !Number.isFinite(item.min) ||
          !Number.isFinite(item.max)
        ) {
          reasons.push(`${where} : min et max sont obligatoires (nombres) pour un champ number`)
          continue
        }
        const min: number = item.min
        const max: number = item.max
        if (Math.abs(min) > NUMBER_ABS_LIMIT || Math.abs(max) > NUMBER_ABS_LIMIT) {
          reasons.push(`${where} : min/max hors bornes (±${NUMBER_ABS_LIMIT})`)
          continue
        }
        if (min > max) {
          reasons.push(`${where} : min (${min}) supérieur à max (${max})`)
          continue
        }
        const integer = item.integer === undefined ? true : Boolean(item.integer)
        // Cohérence bornes <-> integer : des bornes fractionnaires sur un champ entier peuvent
        // définir un domaine VIDE (ex. 1.2 → 1.8 : aucun entier) — un champ requis que le client
        // ne pourrait JAMAIS satisfaire, accepté sans le moindre signal.
        if (integer && (!Number.isInteger(min) || !Number.isInteger(max))) {
          reasons.push(`${where} : min/max doivent être entiers quand integer=true`)
          continue
        }
        field.min = min
        field.max = max
        field.integer = integer
      }

      if (type === 'text') {
        // Même exigence de type STRICT que pour number (cf. ci-dessus) : "50" n'est pas 50.
        if (item.maxLength !== undefined && typeof item.maxLength !== 'number') {
          reasons.push(`${where}.maxLength doit être un nombre`)
          continue
        }
        const maxLength = item.maxLength === undefined ? TEXT_MAX_LENGTH_LIMIT : item.maxLength
        if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > TEXT_MAX_LENGTH_LIMIT) {
          reasons.push(`${where}.maxLength doit être un entier de 1 à ${TEXT_MAX_LENGTH_LIMIT}`)
          continue
        }
        field.maxLength = maxLength
      }

      if (type === 'choice') {
        const rawOptions = item.options
        if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
          reasons.push(`${where}.options est obligatoire (au moins 1) pour un champ choice`)
          continue
        }
        if (rawOptions.length > CHOICE_OPTIONS_MAX) {
          reasons.push(`${where}.options dépasse ${CHOICE_OPTIONS_MAX} entrées`)
          continue
        }

        const seenKeys = new Set<string>()
        let optionsOk = true

        for (let j = 0; j < rawOptions.length; j++) {
          const opt = rawOptions[j]
          const owhere = `${where}.options[${j}]`
          if (!opt || typeof opt !== 'object' || Array.isArray(opt)) {
            reasons.push(`${owhere} doit être un objet`)
            optionsOk = false
            continue
          }

          const key = String(opt.key || '').trim()
          if (!OPTION_KEY_RE.test(key)) {
            reasons.push(`${owhere}.key "${key}" invalide`)
            optionsOk = false
            continue
          }
          if (seenKeys.has(key)) {
            reasons.push(`${owhere}.key "${key}" est en double`)
            optionsOk = false
            continue
          }
          seenKeys.add(key)

          const picks = RecipeService.parseRefPicks(
            opt.references,
            `${owhere}.references`,
            reasons,
            CHOICE_REFS_MAX
          )
          if (!picks) {
            optionsOk = false
            continue
          }

          const label =
            opt.label === undefined || opt.label === null
              ? null
              : String(opt.label).trim().slice(0, 80) || null

          let notes: string | null = null
          if (opt.notes !== undefined && opt.notes !== null) {
            const n = String(opt.notes).trim()
            if (n.length > NOTES_MAX_LEN) {
              reasons.push(`${owhere}.notes dépasse ${NOTES_MAX_LEN} caractères`)
              optionsOk = false
              continue
            }
            notes = n || null
          }

          field.options.push({ key, label, references: picks, notes })
        }

        if (!optionsOk) continue
      }

      out.push(field)
    }

    return out
  }

  /**
   * Parse une liste d'images désignées PAR NOM + rôle. Partagé par les références d'une option de
   * `choice` et par les références PARTAGÉES du produit. `null` = liste invalide (les raisons ont
   * été poussées) ; l'appelant doit alors abandonner l'entrée en cours.
   */
  private static parseRefPicks(
    raw: any,
    where: string,
    reasons: string[],
    max: number
  ): RecipeRefPick[] | null {
    if (!Array.isArray(raw) || raw.length === 0) {
      reasons.push(`${where} est obligatoire (au moins 1 image nommée)`)
      return null
    }
    if (raw.length > max) {
      reasons.push(`${where} dépasse ${max} entrées`)
      return null
    }

    const picks: RecipeRefPick[] = []
    let allOk = true
    const seen = new Set<string>()

    for (let k = 0; k < raw.length; k++) {
      const ref = raw[k]
      const rwhere = `${where}[${k}]`
      if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
        reasons.push(`${rwhere} doit être un objet { name, role }`)
        allOk = false
        continue
      }
      const refName = String(ref.name || '').trim()
      if (!refName || refName.length > REF_NAME_MAX_LEN) {
        reasons.push(`${rwhere}.name manquant ou trop long (${REF_NAME_MAX_LEN} max)`)
        allOk = false
        continue
      }
      const role = String(ref.role || '').trim()
      if (!REF_ROLES.has(role)) {
        reasons.push(`${rwhere}.role "${role}" invalide (${Array.from(REF_ROLES).join(', ')})`)
        allOk = false
        continue
      }
      // Doublon strict : la même image jointe deux fois gonflerait l'envoi au modèle pour rien
      // et décalerait la numérotation annoncée dans le prompt.
      const dedup = `${refName.toLowerCase()}|${role}`
      if (seen.has(dedup)) {
        reasons.push(`${rwhere} : image "${refName}" (${role}) en double`)
        allOk = false
        continue
      }
      seen.add(dedup)
      picks.push({ name: refName, role: role as RecipeRefRole })
    }

    return allOk ? picks : null
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

    // 3) Champs DÉCLARÉS par la recette (choice / number / text).
    // Validation SYNCHRONE : les options d'un choix vivent dans la recette elle-même (modèle
    // « tout dans la fiche produit »), aucune lecture externe n'est donc nécessaire.
    let fields: Record<string, SanitizedFieldValue> | undefined
    if (recipe.fields && recipe.fields.length > 0) {
      fields = {}
      for (const spec of recipe.fields) {
        const raw = getField(spec.name)
        if (raw === undefined || raw === null || !String(raw).trim()) {
          if (spec.required) {
            return { ok: false, message: `Le champ « ${spec.name} » est requis.` }
          }
          continue
        }

        if (spec.type === 'choice') {
          const key = String(raw).trim()
          const option = spec.options.find((o) => o.key === key)
          // On n'écho JAMAIS la valeur client dans le message (bruit + surface d'injection).
          if (!option) {
            return { ok: false, message: `Le choix « ${spec.name} » est invalide.` }
          }
          fields[spec.name] = { type: 'choice', value: option.key, label: option.label }
          continue
        }

        if (spec.type === 'number') {
          const text = String(raw).trim()
          // Forme STRICTE : `Number()` accepterait "0x10" (=16), "1e3" (=1000) ou des espaces —
          // or cette valeur peut finir PEINTE sur l'œuvre. Elle doit se lire telle qu'écrite.
          if (!/^-?\d+(\.\d+)?$/.test(text)) {
            return { ok: false, message: `Le champ « ${spec.name} » doit être un nombre.` }
          }
          const value = Number(text)
          if (spec.integer && !Number.isInteger(value)) {
            return { ok: false, message: `Le champ « ${spec.name} » doit être un nombre entier.` }
          }
          if ((spec.min !== null && value < spec.min) || (spec.max !== null && value > spec.max)) {
            return {
              ok: false,
              message: `Le champ « ${spec.name} » doit être compris entre ${spec.min} et ${spec.max}.`,
            }
          }
          fields[spec.name] = { type: 'number', value: String(value), label: null }
          continue
        }

        // text
        const value = RecipeService.sanitizeValue(String(raw))
        const maxLength = spec.maxLength === null ? TOKEN_MAX_LEN : spec.maxLength
        if (value.length < 1 || value.length > maxLength) {
          return {
            ok: false,
            message: `Le champ « ${spec.name} » est invalide (${maxLength} caractères max).`,
          }
        }
        if (!TOKEN_CHARSET_RE.test(value)) {
          return {
            ok: false,
            message: `Le champ « ${spec.name} » est invalide (lettres, chiffres, espaces et tirets).`,
          }
        }
        // Même blocklist que les tokens et le titre : ces textes finissent visibles sur l'œuvre.
        if (isBlockedFirstName(value)) {
          return { ok: false, message: 'Un des textes demandés ne peut pas être imprimé.' }
        }
        fields[spec.name] = { type: 'text', value, label: null }
      }
    }

    // Spread CONDITIONNEL : sans champs déclarés, la clé n'existe pas — ce qui est persisté sur
    // le job d'un produit existant reste donc strictement identique.
    return { ok: true, inputs: { tokens, values, title, ...(fields ? { fields } : {}) } }
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
