import Shopify from 'App/Services/Shopify'

/**
 * Finalise un produit « poster personnalisé » APRÈS le pipeline publish standard
 * (IA éditoriale + création produit DRAFT + médias + catégorie + artwork.type déjà posés
 * par le contrôleur). Plan §7.2.
 *
 * Ce que ce service AJOUTE :
 *   1. La grille de variantes DÉDIÉE (le publish n'en crée aucune ; le webhook Modelcopier est
 *      neutralisé pour poster.isCustom=true → il faut la créer nous-mêmes) :
 *      Tailles [30x40 cm, 60x80 cm] × Cadres [Sans cadre, Cadre blanc, Cadre noir Mat,
 *      Cadre argent ancien, Cadre chêne clair, Cadre noyer] = 12 variantes, prix figés.
 *   2. Upload de la référence de style (+ exemples photo bon/mauvais) dans Shopify Files ;
 *      injection des URLs CDN dans studioConfig.steps[photo].examples avant d'écrire le metafield.
 *   3. Les 9 metafields nouveaux (studio.config/recipe/references, poster.isCustom,
 *      painting_options.sizes/frames_canvas/fixations, google_product_category ×2).
 *
 * Structurellement « tout ou rien » : une erreur d'options/variantes/référence throw (le
 * contrôleur supprime alors le brouillon). Les metafields non critiques (catégories Google)
 * sont best-effort et remontés en warnings.
 */

// Metaobjects d'options (vérifiés sur le produit famille live gid 10565374247259).
const SIZES_GIDS = [
  'gid://shopify/Metaobject/138179739995',
  'gid://shopify/Metaobject/138451485019',
  'gid://shopify/Metaobject/138451878235',
  'gid://shopify/Metaobject/138452500827',
]
const FRAMES_GIDS = [
  'gid://shopify/Metaobject/139262263643', // « Sans cadre » PREMIER (set 100% framePoster)
  'gid://shopify/Metaobject/138917380443',
  'gid://shopify/Metaobject/138918297947',
  'gid://shopify/Metaobject/138918527323',
  'gid://shopify/Metaobject/138918855003',
  'gid://shopify/Metaobject/138919182683',
]
const FIXATIONS_GIDS = [
  'gid://shopify/Metaobject/138270671195',
  'gid://shopify/Metaobject/138271359323',
]
const GOOGLE_PRODUCT_CATEGORY = '500044'
// Catégorie taxonomique "Home & Garden > … > Posters, Prints, & Visual Artwork > Posters".
// La définition du metafield poster.isCustom est CONTRAINTE à cette catégorie précise : le parent
// hg-3-4-2 copié du modèle poster est REFUSÉ par metafieldsSet (« Owner subtype does not match »).
// Cf. commands/ShopifyFinishCustomProduct.ts (finalisation manuelle historique, même contrainte).
const CATEGORIE_POSTERS_GID = 'gid://shopify/TaxonomyCategory/hg-3-4-2-1'

// Grille de variantes : NOMS d'options résolus par regex côté thème (taille/cadre) + libellés/prix
// EXACTS du produit famille live. L'ordre size×frame reproduit celui de Shopify (option1 en boucle
// externe) : la 1re combinaison (30x40 / Sans cadre) revient à la variante par défaut.
const OPTION_SIZE_NAME = 'Tailles'
const OPTION_FRAME_NAME = 'Cadres'
const SIZE_VALUES = ['30x40 cm', '60x80 cm']
const FRAME_VALUES = [
  'Sans cadre',
  'Cadre blanc',
  'Cadre noir Mat',
  'Cadre argent ancien',
  'Cadre chêne clair',
  'Cadre noyer',
]
function priceFor(size: string, frame: string): string {
  if (size === '30x40 cm') return frame === 'Sans cadre' ? '24.90' : '47.90'
  return frame === 'Sans cadre' ? '44.90' : '94.90'
}

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

    // 0) Catégorie taxonomique "Posters" (hg-3-4-2-1) — EXIGÉE par la définition poster.isCustom.
    // Doit précéder l'écriture des metafields (le contrôleur a posé le parent hg-3-4-2 du modèle,
    // insuffisant). On écrase par la catégorie précise attendue.
    await shopify.category.setProductCategory(productId, CATEGORIE_POSTERS_GID)

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
        if (photoStep && photoStep.examples && photoStep.examples[kind]) {
          photoStep.examples[kind].image = ex.url
        }
      } catch (e: any) {
        warnings.push(`Exemple photo « ${kind} » non uploadé : ${e?.message || e}`)
      }
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

    await setMf('studio', 'config', JSON.stringify(configToWrite), 'json', true)
    await setMf('studio', 'recipe', JSON.stringify(studioRecipe), 'json', true)
    await setMf(
      'studio',
      'references',
      JSON.stringify([referenceFileId]),
      'list.file_reference',
      true
    )
    await setMf('poster', 'isCustom', 'true', 'boolean', true)
    await setMf(
      'painting_options',
      'sizes',
      JSON.stringify(SIZES_GIDS),
      'list.metaobject_reference',
      true
    )
    await setMf(
      'painting_options',
      'frames_canvas',
      JSON.stringify(FRAMES_GIDS),
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

    // Non critiques : catégories Google/Facebook. Type OMIS → Shopify utilise la définition d'app.
    await setMf(
      'mm-google-shopping',
      'google_product_category',
      GOOGLE_PRODUCT_CATEGORY,
      undefined,
      false
    )
    await setMf('mc-facebook', 'google_product_category', GOOGLE_PRODUCT_CATEGORY, undefined, false)

    if (criticalFailures.length) {
      throw new Error(`Metafields critiques non posés → ${criticalFailures.join(' | ')}`)
    }

    return { warnings, referenceFileId }
  }

  /**
   * Crée les 2 options + 12 variantes. Même patron que le Modelcopier (copyModelVariants) :
   * createOptions (LEAVE_AS_IS) → la variante par défaut hérite des 1res valeurs → on lui pose son
   * prix → bulk-create des 11 autres.
   */
  private async createVariantGrid(productId: string, shopify: Shopify): Promise<void> {
    await shopify.product.createOptions(productId, [
      { name: OPTION_SIZE_NAME, values: SIZE_VALUES },
      { name: OPTION_FRAME_NAME, values: FRAME_VALUES },
    ])

    const variants: Array<{
      price: string
      optionValues: { name: string; optionName: string }[]
    }> = []
    for (const size of SIZE_VALUES) {
      for (const frame of FRAME_VALUES) {
        variants.push({
          price: priceFor(size, frame),
          optionValues: [
            { name: size, optionName: OPTION_SIZE_NAME },
            { name: frame, optionName: OPTION_FRAME_NAME },
          ],
        })
      }
    }

    const product = await shopify.product.getProductById(productId)
    const defaultVariant = product.variants?.nodes?.[0]
    if (!defaultVariant)
      throw new Error('Variante par défaut introuvable après création des options.')

    // La variante par défaut = 1re combinaison (30x40 / Sans cadre) → on lui pose son prix,
    // puis on crée les 11 autres.
    const [firstVariant, ...rest] = variants
    await shopify.product.updateVariant(productId, defaultVariant.id, { price: firstVariant.price })
    await shopify.product.createVariantsBulk(productId, rest)
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
