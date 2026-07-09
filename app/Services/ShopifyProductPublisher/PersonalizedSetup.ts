import Logger from '@ioc:Adonis/Core/Logger'
import Shopify from 'App/Services/Shopify'
import DesignTextReader, {
  DesignStepInfo,
  applyDesignTexts,
} from 'App/Services/ShopifyProductPublisher/DesignTextReader'
import StudioTranslator from 'App/Services/ChatGPT/StudioTranslator'
import { I18N_PATHS, getAtPath, isI18nMap } from 'App/Services/StudioConfig'
import {
  OPTION_SIZE_NAME,
  OPTION_FRAME_NAME,
  FRAME_VALUES,
  POSTER_SIZE_VALUES,
  POSTER_SIZES_GIDS,
  FRAMES_POSTER_GIDS,
  FIXATIONS_GIDS,
  posterVariantSpecs,
} from 'App/Services/ShopifyProductPublisher/posterPreset'

/**
 * Finalise un produit « poster personnalisé » APRÈS le pipeline publish standard
 * (IA éditoriale + création produit DRAFT + médias + catégorie + artwork.type déjà posés
 * par le contrôleur). Plan §7.2.
 *
 * Ce que ce service AJOUTE :
 *   1. La grille de variantes DÉDIÉE (le publish n'en crée aucune ; le webhook Modelcopier est
 *      neutralisé pour poster.isCustom=true → il faut la créer nous-mêmes). Un poster personnalisé
 *      EST un poster : MÊME grille que les posters standard, AUCUNE différence de tailles —
 *      Format [30x40, 60x80, 75x100, 90x120] × Cadre [Sans cadre, Avec cadre] = 7 variantes
 *      (90x120 sans version cadrée), prix = grille poster. Définie dans posterPreset.ts.
 *      La COULEUR du cadre et le CONTOUR BLANC ne sont PAS des variantes : ce sont des line-item
 *      properties (`Couleur du cadre` + `_cadre`, `Contour blanc` + `_passe_partout`) gérées par le
 *      thème, qui lit painting_options.frames_poster pour afficher les couleurs de cadre.
 *   2. Upload de la référence de style (+ exemples photo bon/mauvais) dans Shopify Files ;
 *      injection des URLs CDN dans studioConfig.steps[photo].examples avant d'écrire le metafield.
 *   3. Les metafields studio + painting_options (studio.config/recipe/references,
 *      painting_options.sizes/frames_poster/fixations). poster.isCustom + catégorie : posés par le contrôleur.
 *
 * Structurellement « tout ou rien » : une erreur d'options/variantes/référence throw (le
 * contrôleur supprime alors le brouillon). Les metafields non critiques (catégories Google)
 * sont best-effort et remontés en warnings.
 */

// Preset (tailles, cadres, prix) + GIDs painting_options : SOURCE UNIQUE dans posterPreset.ts,
// partagée avec la commande shopify:conform_perso_poster — un poster perso EST un poster.

// Catégorie taxonomique "Home & Garden > … > Posters, Prints, & Visual Artwork > Posters".
// La définition du metafield poster.isCustom est CONTRAINTE à cette catégorie précise : le parent
// hg-3-4-2 copié du modèle poster est REFUSÉ par metafieldsSet (« Owner subtype does not match »).
// Cf. commands/ShopifyFinishCustomProduct.ts (finalisation manuelle historique, même contrainte).
// Posée + poster.isCustom AVANT artwork.type par le CONTRÔLEUR (course P0) — pas ici.
export const PERSONALIZED_POSTER_CATEGORY_GID = 'gid://shopify/TaxonomyCategory/hg-3-4-2-1'

// Fragments de prompt STRUCTURELS : identiques pour tous les produits (aucune UI, aucun LLM) —
// imposés ici à la publication. Le reste (base/perPerson/replaceTitle/add/removeExtra) est écrit
// par RecipeDirector au chargement du design côté Publisher, puis relu par Walid.
const PROMPT_IMAGE_ROLES =
  'Two images are attached. IMAGE 1 is the CUSTOMER PHOTO: it is the ONLY source for the subjects — how many they are, their left-to-right order, relative sizes, apparent ages and distinctive features. IMAGE 2 is the STYLE REFERENCE: copy its art style, composition, framing, typography and layout EXACTLY, but never copy its subjects, their faces or its words.'
const PROMPT_COUNT_LINE =
  'The final illustration shows EXACTLY {n} person(s), in this left-to-right order: {tokens}. Render no other person, and no text other than the ones requested below.'

export interface PersonalizedSetupParams {
  productId: string
  studioConfig: any
  studioRecipe: any
  /** Image de style base64 (data URI). null = pas de référence fournie (best-effort). */
  referenceBase64: string | null
  photoExamples: { good?: string | null; bad?: string | null }
  /** Slug technique du produit (studioConfig.productType) — sert au nommage SEO des fichiers. */
  slug: string
  shopify: Shopify
}

export interface PersonalizedSetupReport {
  warnings: string[]
  referenceFileId: string | null
}

export default class PersonalizedSetup {
  public async run(params: PersonalizedSetupParams): Promise<PersonalizedSetupReport> {
    const { productId, studioConfig, studioRecipe, referenceBase64, photoExamples, slug, shopify } =
      params
    const warnings: string[] = []
    // Fichiers uploadés dans Files : à supprimer si on throw ensuite (le contrôleur supprime le
    // PRODUIT, mais pas ces fichiers de bibliothèque -> sinon orphelins à chaque échec structurel).
    const uploadedFileIds: string[] = []

    // NB : la catégorie « Posters » (hg-3-4-2-1) ET poster.isCustom=true sont posés par le
    // CONTRÔLEUR AVANT artwork.type (course P0). Ici on ne s'occupe que du reste.

    // 1) Grille de variantes dédiée -------------------------------------------------
    await this.createVariantGrid(productId, shopify)

    // 2) Uploads Files (référence + exemples) ---------------------------------------
    // La référence est OBLIGATOIRE (technique de substitution sur image de style) → throw si absente.
    if (!referenceBase64) {
      throw new Error(
        'Référence de style manquante : impossible de finaliser le poster personnalisé.'
      )
    }
    const reference = await this.uploadImage(
      shopify,
      referenceBase64,
      `studio-reference-${slug}.jpg`,
      `Référence de style — ${slug}`
    )
    const referenceFileId = reference.fileId
    uploadedFileIds.push(referenceFileId)

    // Injection des URLs d'exemples dans une COPIE de la config (le thème accepte les URL complètes).
    const configToWrite = JSON.parse(JSON.stringify(studioConfig))
    const photoStep = (configToWrite.steps || []).find((s: any) => s && s.type === 'photo')
    for (const kind of ['good', 'bad'] as const) {
      const b64 = photoExamples && photoExamples[kind]
      if (!b64) continue
      try {
        const ex = await this.uploadImage(
          shopify,
          b64,
          `studio-photo-exemple-${slug}-${kind === 'good' ? 'bon' : 'mauvais'}.jpg`,
          `Exemple photo ${kind === 'good' ? 'à privilégier' : 'à éviter'} — ${slug}`
        )
        uploadedFileIds.push(ex.fileId)
        if (photoStep && photoStep.examples && photoStep.examples[kind]) {
          photoStep.examples[kind].image = ex.url
        }
      } catch (e: any) {
        warnings.push(`Exemple photo « ${kind} » non uploadé : ${e?.message || e}`)
      }
    }

    // 2b) Traduction AUTOMATIQUE des textes du studio ---------------------------------
    // Le builder ne saisit que le FRANÇAIS (règle UX). Le cron TranslateProduct traduit la
    // fiche Shopify via l'API Translations, que le moteur studio ne lit PAS : lui résout les
    // maps i18n DANS le JSON studio.config (map[locale] || map.fr). On génère donc ici les
    // 4 langues depuis le FR (1 appel OpenAI batch), en écrasant en/de/nl/es pour rester
    // cohérent avec le FR édité. Échec = non bloquant : le thème retombe sur le français.
    await this.translateConfigTexts(configToWrite, warnings)

    // 2c) Table de remplacement des textes : LUE SUR LE DESIGN (vision) ----------------
    // Le front n'édite plus reference.texts.title/slots ni inputs.title : ces valeurs décrivent
    // le design lui-même. On les lit ici sur l'image de référence, associées aux étapes du
    // parcours. Échec = non bloquant : la table du préréglage reste telle quelle (warning) et
    // le produit naît en brouillon — Walid la voit à son test studio avant activation.
    const recipeToWrite = JSON.parse(JSON.stringify(studioRecipe))
    const stepsInfo: DesignStepInfo[] = (configToWrite.steps || [])
      .filter((s: any) => s && s.type !== 'format' && s.type !== 'photo')
      .map((s: any) => ({
        payloadKey: String(s.payloadKey || s.name),
        type: String(s.type),
        titleFr: String((s.title && s.title.fr) || s.name),
      }))
    const designTexts = await new DesignTextReader().read(referenceBase64, stepsInfo)
    if (designTexts) {
      applyDesignTexts(
        recipeToWrite,
        designTexts,
        stepsInfo.map((s) => s.payloadKey),
        warnings
      )
      Logger.info(
        'design-texts: title=%s slots=%s template=%s',
        designTexts.title || '—',
        designTexts.slots.length,
        designTexts.titleTemplate || '—'
      )
    } else {
      warnings.push(
        'Lecture des textes du design impossible — table de remplacement du préréglage conservée, vérifie le brouillon.'
      )
    }

    // 2d) Fragments de prompt structurels : imposés (identiques pour tous les produits), et
    // élagage cohérent avec la table lue — sans légendes par sujet (tokens), les fragments
    // par-personne n'ont pas d'objet ; sans titre, pas de remplacement de titre.
    recipeToWrite.prompt = recipeToWrite.prompt || {}
    recipeToWrite.prompt.imageRoles = PROMPT_IMAGE_ROLES
    if (recipeToWrite.inputs && recipeToWrite.inputs.tokens) {
      recipeToWrite.prompt.countLine = PROMPT_COUNT_LINE
    } else {
      delete recipeToWrite.prompt.countLine
      delete recipeToWrite.prompt.perPerson
      delete recipeToWrite.prompt.addExtra
      delete recipeToWrite.prompt.removeExtra
    }
    if (!(recipeToWrite.inputs && recipeToWrite.inputs.title)) {
      delete recipeToWrite.prompt.replaceTitle
    }

    // 3) Metafields -----------------------------------------------------------------
    // Chaque set est tenté indépendamment ; on collecte les échecs (avec la clé, pour le
    // diagnostic) au lieu d'aborter au premier. Les CRITIQUES ratés font throw à la fin (avec
    // la liste) → le contrôleur supprime le brouillon. Les non-critiques deviennent des warnings.
    const criticalFailures: string[] = []
    const setMf = async (
      ns: string,
      key: string,
      value: string,
      type: string | undefined,
      critical: boolean
    ) => {
      try {
        await shopify.metafield.update(productId, ns, key, value, type)
      } catch (e: any) {
        const msg = `${ns}.${key} : ${e?.message || e}`
        if (critical) criticalFailures.push(msg)
        else warnings.push(msg)
      }
    }

    // poster.isCustom : posé par le CONTRÔLEUR avant artwork.type (course P0) — pas ici.
    // studio.config est écrit EN DERNIER (cf. plus bas) : c'est LUI que lit la vérif d'unicité de
    // slug ; s'il n'est jamais posé (échec d'un autre critique -> throw AVANT), aucun brouillon
    // orphelin ne bloque un futur retry du même slug.
    await setMf(
      'painting_options',
      'sizes',
      JSON.stringify(POSTER_SIZES_GIDS),
      'list.metaobject_reference',
      true
    )
    await setMf(
      'painting_options',
      'frames_poster',
      JSON.stringify(FRAMES_POSTER_GIDS),
      'list.metaobject_reference',
      true
    )
    await setMf(
      'painting_options',
      'fixations',
      JSON.stringify(FIXATIONS_GIDS),
      'list.metaobject_reference',
      true
    )
    await setMf('studio', 'recipe', JSON.stringify(recipeToWrite), 'json', true)
    await setMf(
      'studio',
      'references',
      JSON.stringify([referenceFileId]),
      'list.file_reference',
      true
    )

    // NB : mm-google-shopping / mc-facebook.google_product_category NE sont PAS posés ici — les
    // apps Google/Facebook les dérivent AUTOMATIQUEMENT de la catégorie taxonomique (Posters ->
    // 500044), vérifié sur le produit test. Un metafieldsSet manuel échouait (« Type can't be
    // blank » : namespace d'app sans définition accessible à notre token). Comme le script de
    // finalisation historique (ShopifyFinishCustomProduct), on laisse les apps s'en charger.

    // Un critique a échoué AVANT studio.config -> on throw SANS l'écrire (pas de brouillon orphelin
    // portant le slug, qui bloquerait la vérif d'unicité au retry).
    if (criticalFailures.length) {
      await this.deleteFiles(shopify, uploadedFileIds)
      throw new Error(`Metafields critiques non posés → ${criticalFailures.join(' | ')}`)
    }

    // studio.config EN DERNIER (porte le productType lu par la vérif d'unicité de slug).
    await setMf('studio', 'config', JSON.stringify(configToWrite), 'json', true)
    if (criticalFailures.length) {
      await this.deleteFiles(shopify, uploadedFileIds)
      throw new Error(`Metafields critiques non posés → ${criticalFailures.join(' | ')}`)
    }

    return { warnings, referenceFileId }
  }

  /**
   * Génère en/de/nl/es depuis le FR pour TOUTES les maps i18n de la config (étapes ×
   * I18N_PATHS), en un seul appel OpenAI batch. Mutation en place. Non bloquant : en cas
   * d'échec, un warning est remonté et le studio retombera sur le français (comportement
   * moteur : map[locale] || map.fr).
   */
  private async translateConfigTexts(config: any, warnings: string[]): Promise<void> {
    const maps: Array<{ id: string; fr: string; map: any }> = []
    for (const step of Array.isArray(config?.steps) ? config.steps : []) {
      for (const path of I18N_PATHS) {
        const map = getAtPath(step, path)
        if (!isI18nMap(map)) continue
        if (typeof map.fr === 'string' && map.fr.trim())
          maps.push({ id: String(maps.length), fr: map.fr, map })
      }
    }
    if (!maps.length) return
    try {
      const translated = await new StudioTranslator().translateBatch(
        maps.map(({ id, fr }) => ({ id, fr }))
      )
      const byId = new Map(translated.map((t) => [t.id, t]))
      for (const entry of maps) {
        const out = byId.get(entry.id)
        if (!out) continue
        entry.map.en = out.en
        entry.map.de = out.de
        entry.map.nl = out.nl
        entry.map.es = out.es
      }
    } catch (e: any) {
      warnings.push(
        `Traductions non générées (${e?.message || e}) — le studio affichera le français dans toutes les langues jusqu'à correction.`
      )
    }
  }

  /** Supprime des fichiers Shopify (best-effort : ne masque jamais l'erreur d'origine). */
  private async deleteFiles(shopify: Shopify, fileIds: string[]): Promise<void> {
    if (!fileIds.length) return
    try {
      await shopify.file.delete(fileIds)
    } catch (e: any) {
      console.error('[Personalized] cleanup fichiers échoué:', e?.message || e)
    }
  }

  /**
   * Crée les 2 options + 7 variantes (Format × Cadre, grille poster complète — cf. posterPreset).
   * Même patron que le Modelcopier (copyModelVariants) : createOptions (LEAVE_AS_IS) → la variante
   * par défaut hérite des 1res valeurs → on lui pose son prix → bulk-create des autres.
   */
  private async createVariantGrid(productId: string, shopify: Shopify): Promise<void> {
    await shopify.product.createOptions(productId, [
      { name: OPTION_SIZE_NAME, values: POSTER_SIZE_VALUES },
      { name: OPTION_FRAME_NAME, values: FRAME_VALUES },
    ])

    const variants = posterVariantSpecs()

    const product = await shopify.product.getProductById(productId)
    const defaultVariant = product.variants?.nodes?.[0]
    if (!defaultVariant)
      throw new Error('Variante par défaut introuvable après création des options.')

    // La variante par défaut = 1re combinaison (30x40 / Sans cadre) → on lui pose son prix,
    // puis on crée les autres.
    const [firstVariant, ...rest] = variants
    await shopify.product.updateVariant(productId, defaultVariant.id, { price: firstVariant.price })
    try {
      await shopify.product.createVariantsBulk(productId, rest)
    } catch (e: any) {
      // Cap Shopify 1000 variantes/jour (au-delà de 50k) : condition TRANSITOIRE, pas un bug. Le
      // cron RepairIncompleteArtworks ne récupère pas un poster personnalisé (DRAFT + garde P0), donc
      // on remonte un message clair (« réessaie demain ») ; le contrôleur supprime le brouillon et
      // libère l'idempotence -> renvoi possible une fois le quota réinitialisé.
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Daily variant')) {
        throw new Error(
          'Cap Shopify de création de variantes atteint pour aujourd’hui — réessaie demain (le brouillon a été annulé).'
        )
      }
      throw e
    }
  }

  /** Upload d'une image base64 (data URI) dans Shopify Files → { fileId, url }. */
  private async uploadImage(
    shopify: Shopify,
    dataUri: string,
    filename: string,
    alt: string
  ): Promise<{ fileId: string; url: string }> {
    const match = /^data:(.+?);base64,(.+)$/s.exec(dataUri)
    const mimeType = match ? match[1] : 'image/jpeg'
    const base64 = match ? match[2] : dataUri
    const buffer = Buffer.from(base64, 'base64')
    return shopify.file.uploadFromBuffer({ buffer, mimeType, filename, alt })
  }
}
