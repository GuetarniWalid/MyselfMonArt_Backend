import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import type Shopify from 'App/Services/Shopify'
import { promises as fs } from 'fs'
import { isAbsolute, join } from 'path'

/**
 * Finalise le produit "poster personnalisé" (pipeline poster perso foot) :
 * options, variantes, template, catégorie et metafields — en un seul passage.
 *
 *   node ace shopify:finish_custom_product --product 10528685621595 --grid ./grille-prix.json
 *
 * Étapes (idempotentes : l'existant est comparé et signalé, jamais écrasé) :
 *   1. productOptionsCreate  — "Tailles" [30x40 cm, 60x80 cm] et "Cadres" [6 finitions]
 *      (casse EXACTE : le picker du thème matche le libellé border.name).
 *   2. productVariantsBulkCreate (REMOVE_STANDALONE_VARIANT) — les 12 variantes
 *      taille × cadre avec les prix de la grille JSON.
 *   3. productUpdate — templateSuffix "personalized".
 *   4. Catégorie — taxonomie "Posters" (hg-3-4-2-1) : la définition du metafield
 *      poster.isCustom est contrainte à cette catégorie précise (le parent
 *      hg-3-4-2 du produit de référence est refusé par metafieldsSet).
 *   5. Metafields (refusés en M8 tant que la catégorie n'était pas posée) :
 *      poster.isCustom=true, artwork.type=poster, painting.layout=<métaobjet format>.
 *   6. Vérification finale — re-query complet + tableau récapitulatif.
 *
 * GARDE-FOU : refuse de tourner sur un produit dont le status n'est pas DRAFT.
 *
 * Format de la grille JSON (deux formes acceptées) :
 *   a) objet imbriqué :  { "30x40 cm": { "Sans cadre": 34.9, "Cadre blanc": "54.90", ... }, "60x80 cm": { ... } }
 *   b) liste à plat   :  [ { "taille": "30x40 cm", "cadre": "Sans cadre", "prix": 34.9 }, ... ]
 * Les 12 combinaisons doivent être présentes. Virgule décimale FR tolérée ("34,90").
 */

// Casse EXACTE exigée par le picker du thème (matche border.name des métaobjets)
const OPTIONS_ATTENDUES: Array<{ name: string; values: string[] }> = [
  { name: 'Tailles', values: ['30x40 cm', '60x80 cm'] },
  {
    name: 'Cadres',
    values: [
      'Sans cadre',
      'Cadre blanc',
      'Cadre noir Mat',
      'Cadre argent ancien',
      'Cadre chêne clair',
      'Cadre noyer',
    ],
  },
]

// Catégorie taxonomique cible : "Home & Garden > Decor > Artwork >
// Posters, Prints, & Visual Artwork > Posters". La définition du metafield
// poster.isCustom ("À personnaliser") est CONTRAINTE à cette catégorie :
// metafieldsSet refuse tout produit qui n'y est pas rattaché.
const CATEGORIE_POSTERS_GID = 'gid://shopify/TaxonomyCategory/hg-3-4-2-1'
const TEMPLATE_SUFFIX_CIBLE = 'personalized'
// Métaobjet format (painting.layout) du poster personnalisé
const LAYOUT_METAOBJECT_GID = 'gid://shopify/Metaobject/264401846619'

type EtatProduit = {
  id: string
  title: string
  status: string
  templateSuffix: string | null
  hasOnlyDefaultVariant: boolean
  category: { id: string; fullName: string } | null
  options: Array<{ id: string; name: string; optionValues: Array<{ id: string; name: string }> }>
  variants: {
    nodes: Array<{
      id: string
      title: string
      price: string
      selectedOptions: Array<{ name: string; value: string }>
    }>
  }
  isCustomMetafield: { value: string } | null
  artworkTypeMetafield: { value: string } | null
  paintingLayoutMetafield: { value: string } | null
}

export default class ShopifyFinishCustomProduct extends BaseCommand {
  public static commandName = 'shopify:finish_custom_product'
  public static description =
    'Finalise un produit poster personnalisé draft : options, 12 variantes (grille de prix), template personalized, catégorie et metafields'

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.string({ description: 'ID numérique du produit Shopify draft (ex: 10528685621595)' })
  public product: string

  @flags.string({
    description: 'Chemin du JSON de la grille de prix (12 combinaisons taille × cadre)',
  })
  public grid: string

  /** Accès direct à fetchGraphQL (protégé sur Authentication) pour les requêtes
   *  spécifiques à cette commande (status, stratégie de création de variantes,
   *  metafields typés) — même contournement que BackfillCollectionLinks.
   *  Posé dans run() : le conteneur IoC n'est prêt qu'à l'exécution de la commande. */
  private gql: (
    query: string,
    variables?: Record<string, any>,
    estimatedCost?: number
  ) => Promise<any>

  private problemes: string[] = []

  public async run() {
    if (!this.product || !this.grid) {
      this.logger.error(
        'Usage : node ace shopify:finish_custom_product --product <id-numerique> --grid <chemin-json>'
      )
      this.exitCode = 1
      return
    }

    const productGid = this.product.startsWith('gid://')
      ? this.product
      : `gid://shopify/Product/${this.product}`

    try {
      // Import dynamique : le conteneur IoC n'est prêt qu'à l'exécution de la commande
      const { default: ShopifyService } = await import('App/Services/Shopify')
      const shopify: Shopify = new ShopifyService()
      this.gql = (shopify.metafield as any).fetchGraphQL.bind(shopify.metafield)

      // Lecture + validation de la grille de prix AVANT tout appel Shopify
      const grille = await this.chargerGrille()

      const etatInitial = await this.fetchEtatProduit(productGid)
      if (!etatInitial) {
        this.logger.error(`Produit introuvable : ${productGid}`)
        this.exitCode = 1
        return
      }

      this.logger.info(`Produit : "${etatInitial.title}" (${etatInitial.id})`)

      // GARDE-FOU : uniquement sur un produit draft (jamais sur le catalogue live)
      if (etatInitial.status !== 'DRAFT') {
        this.logger.error(
          `REFUS : le produit est en status ${etatInitial.status} (attendu : DRAFT). ` +
            'Cette commande ne touche que des produits draft.'
        )
        this.exitCode = 1
        return
      }

      await this.etapeOptions(shopify, etatInitial)

      // Re-fetch après création d'options (Shopify peut avoir retouché les variantes)
      const etatApresOptions = (await this.fetchEtatProduit(productGid)) as EtatProduit
      await this.etapeVariantes(productGid, etatApresOptions, grille)

      await this.etapeTemplate(shopify, productGid, etatApresOptions)
      await this.etapeCategorie(shopify, productGid, etatApresOptions)

      // Metafields APRÈS la catégorie : painting.layout est lié à la catégorie
      const etatApresCategorie = (await this.fetchEtatProduit(productGid)) as EtatProduit
      await this.etapeMetafields(shopify, productGid, etatApresCategorie)

      // Vérification finale sur un état frais
      const etatFinal = (await this.fetchEtatProduit(productGid)) as EtatProduit
      this.afficherRecapitulatif(etatFinal, grille)

      if (this.problemes.length > 0) {
        this.logger.warning(`${this.problemes.length} point(s) à vérifier :`)
        this.problemes.forEach((p) => this.logger.warning(`  - ${p}`))
        this.exitCode = 1
      } else {
        this.logger.success(
          'Produit finalisé : 12 variantes, template, catégorie et metafields OK.'
        )
      }
    } catch (error) {
      this.logger.error(`Échec : ${error?.message ?? error}`)
      this.exitCode = 1
    }
  }

  /* ------------------------------------------------------------------ */
  /* Grille de prix                                                      */
  /* ------------------------------------------------------------------ */

  /** Charge la grille JSON et la normalise en Map "taille|cadre" -> prix (string). */
  private async chargerGrille(): Promise<Map<string, string>> {
    const chemin = isAbsolute(this.grid) ? this.grid : join(process.cwd(), this.grid)
    let brut: any
    try {
      brut = JSON.parse(await fs.readFile(chemin, 'utf-8'))
    } catch (error) {
      throw new Error(`Grille illisible (${chemin}) : ${error?.message ?? error}`)
    }

    const grille = new Map<string, string>()
    const poser = (taille: string, cadre: string, prix: any) => {
      grille.set(`${String(taille).trim()}|${String(cadre).trim()}`, this.normaliserPrix(prix))
    }

    if (Array.isArray(brut)) {
      // Forme liste à plat : [{ taille, cadre, prix }]
      for (const ligne of brut) {
        if (!ligne?.taille || !ligne?.cadre || ligne?.prix === undefined) {
          throw new Error(
            `Ligne de grille invalide (attendu { taille, cadre, prix }) : ${JSON.stringify(ligne)}`
          )
        }
        poser(ligne.taille, ligne.cadre, ligne.prix)
      }
    } else if (brut && typeof brut === 'object') {
      // Forme objet imbriqué : { "<taille>": { "<cadre>": prix } }
      for (const [taille, cadres] of Object.entries(brut)) {
        if (!cadres || typeof cadres !== 'object') {
          throw new Error(
            `Entrée de grille invalide pour "${taille}" (objet { cadre: prix } attendu)`
          )
        }
        for (const [cadre, prix] of Object.entries(cadres as Record<string, any>)) {
          poser(taille, cadre, prix)
        }
      }
    } else {
      throw new Error('Format de grille non reconnu (objet imbriqué ou liste à plat attendu)')
    }

    // Les 12 combinaisons doivent être couvertes
    const manquantes: string[] = []
    for (const taille of OPTIONS_ATTENDUES[0].values) {
      for (const cadre of OPTIONS_ATTENDUES[1].values) {
        if (!grille.has(`${taille}|${cadre}`)) manquantes.push(`${taille} / ${cadre}`)
      }
    }
    if (manquantes.length > 0) {
      throw new Error(
        `Grille incomplète — ${manquantes.length} combinaison(s) manquante(s) :\n  - ${manquantes.join('\n  - ')}`
      )
    }

    // Combinaisons inconnues = probable faute de casse (le picker exige la casse exacte)
    const attendues = new Set(
      OPTIONS_ATTENDUES[0].values.flatMap((t) =>
        OPTIONS_ATTENDUES[1].values.map((c) => `${t}|${c}`)
      )
    )
    for (const cle of grille.keys()) {
      if (!attendues.has(cle)) {
        this.logger.warning(`Combinaison ignorée (hors référentiel, vérifier la casse) : ${cle}`)
      }
    }

    return grille
  }

  /** Valide et normalise un prix ("34,90" / "34.90" / 34.9 -> "34.90"). */
  private normaliserPrix(prix: any): string {
    const nombre =
      typeof prix === 'number' ? prix : parseFloat(String(prix).replace(',', '.').trim())
    if (!Number.isFinite(nombre) || nombre <= 0) {
      throw new Error(`Prix invalide dans la grille : ${JSON.stringify(prix)}`)
    }
    return nombre.toFixed(2)
  }

  /* ------------------------------------------------------------------ */
  /* Lecture de l'état du produit                                        */
  /* ------------------------------------------------------------------ */

  private async fetchEtatProduit(productGid: string): Promise<EtatProduit | null> {
    const data = await this.gql(
      `query EtatProduit($id: ID!) {
        product(id: $id) {
          id
          title
          status
          templateSuffix
          hasOnlyDefaultVariant
          category {
            id
            fullName
          }
          options(first: 5) {
            id
            name
            optionValues {
              id
              name
            }
          }
          variants(first: 30) {
            nodes {
              id
              title
              price
              selectedOptions {
                name
                value
              }
            }
          }
          isCustomMetafield: metafield(namespace: "poster", key: "isCustom") {
            value
          }
          artworkTypeMetafield: metafield(namespace: "artwork", key: "type") {
            value
          }
          paintingLayoutMetafield: metafield(namespace: "painting", key: "layout") {
            value
          }
        }
      }`,
      { id: productGid },
      50
    )
    return (data.product as EtatProduit) ?? null
  }

  /* ------------------------------------------------------------------ */
  /* Étape 1 — options                                                   */
  /* ------------------------------------------------------------------ */

  private async etapeOptions(shopify: Shopify, etat: EtatProduit) {
    const aCreer: Array<{ name: string; values: string[] }> = []

    for (const attendue of OPTIONS_ATTENDUES) {
      const existante = etat.options.find((o) => o.name === attendue.name)
      if (!existante) {
        aCreer.push(attendue)
        continue
      }

      // Idempotence : l'option existe, on compare les valeurs sans rien recréer
      const valeursExistantes = existante.optionValues.map((v) => v.name)
      const manquantes = attendue.values.filter((v) => !valeursExistantes.includes(v))
      const enTrop = valeursExistantes.filter((v) => !attendue.values.includes(v))
      if (manquantes.length === 0 && enTrop.length === 0) {
        this.logger.info(
          `Option "${attendue.name}" déjà en place (${valeursExistantes.length} valeurs) — ignorée`
        )
      } else {
        const detail = [
          manquantes.length ? `valeurs manquantes : ${manquantes.join(', ')}` : '',
          enTrop.length ? `valeurs inattendues : ${enTrop.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join(' ; ')
        this.problemes.push(`Option "${attendue.name}" existe mais diverge (${detail})`)
        this.logger.warning(`Option "${attendue.name}" diverge — ${detail}`)
      }
    }

    if (aCreer.length === 0) return

    this.logger.info(`Création des options : ${aCreer.map((o) => `"${o.name}"`).join(', ')}`)
    // LEAVE_AS_IS : la matrice de variantes est posée juste après via
    // productVariantsBulkCreate (REMOVE_STANDALONE_VARIANT)
    const resultat = await shopify.product.createOptions(etat.id, aCreer)
    if (resultat.userErrors?.length) {
      throw new Error(`productOptionsCreate : ${resultat.userErrors[0].message}`)
    }
    this.logger.success(`Options créées (${aCreer.length})`)
  }

  /* ------------------------------------------------------------------ */
  /* Étape 2 — variantes                                                 */
  /* ------------------------------------------------------------------ */

  private async etapeVariantes(productGid: string, etat: EtatProduit, grille: Map<string, string>) {
    // Indexe l'existant par "taille|cadre" (ignore la variante standalone "Default Title")
    const existantes = new Map<string, { id: string; price: string }>()
    for (const variante of etat.variants.nodes) {
      const taille = variante.selectedOptions.find((o) => o.name === 'Tailles')?.value
      const cadre = variante.selectedOptions.find((o) => o.name === 'Cadres')?.value
      if (taille && cadre) existantes.set(`${taille}|${cadre}`, variante)
    }

    const aCreer: Array<{
      price: string
      optionValues: Array<{ optionName: string; name: string }>
    }> = []
    // Variantes existantes dont le prix diverge de la grille (cas typique : la
    // variante standalone "Default Title" héritée du produit, convertie en
    // "30x40 cm / Sans cadre" à prix 0.00 par productOptionsCreate)
    const aRealigner: Array<{ id: string; price: string; libelle: string }> = []

    for (const taille of OPTIONS_ATTENDUES[0].values) {
      for (const cadre of OPTIONS_ATTENDUES[1].values) {
        const cle = `${taille}|${cadre}`
        const prixAttendu = grille.get(cle) as string
        const existante = existantes.get(cle)

        if (!existante) {
          aCreer.push({
            price: prixAttendu,
            optionValues: [
              { optionName: 'Tailles', name: taille },
              { optionName: 'Cadres', name: cadre },
            ],
          })
          continue
        }

        // Variante déjà là : on réaligne le prix sur la grille si nécessaire
        if (parseFloat(existante.price) !== parseFloat(prixAttendu)) {
          aRealigner.push({
            id: existante.id,
            price: prixAttendu,
            libelle: `${taille} / ${cadre} (${existante.price} -> ${prixAttendu})`,
          })
        }
      }
    }

    if (aRealigner.length > 0) {
      this.logger.info(`Réalignement de ${aRealigner.length} prix sur la grille…`)
      const data = await this.gql(
        `mutation RealignerPrix($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              price
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          productId: productGid,
          variants: aRealigner.map((v) => ({ id: v.id, price: v.price })),
        },
        10 + aRealigner.length
      )
      if (data.productVariantsBulkUpdate.userErrors?.length) {
        throw new Error(
          `productVariantsBulkUpdate : ${data.productVariantsBulkUpdate.userErrors[0].message}`
        )
      }
      aRealigner.forEach((v) => this.logger.success(`Prix réaligné : ${v.libelle}`))
    }

    if (aCreer.length === 0) {
      this.logger.info('Les 12 variantes existent déjà — création ignorée')
      return
    }

    this.logger.info(`Création de ${aCreer.length} variante(s)…`)
    const data = await this.gql(
      `mutation CreerVariantes($productId: ID!, $variants: [ProductVariantsBulkInput!]!, $strategy: ProductVariantsBulkCreateStrategy) {
        productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: $strategy) {
          productVariants {
            id
            title
            price
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        productId: productGid,
        variants: aCreer.map((v) => ({
          ...v,
          // Pas de suivi de stock : produit imprimé à la demande
          inventoryItem: { tracked: false },
          inventoryPolicy: 'CONTINUE',
        })),
        // Supprime la variante standalone "Default Title" à la pose de la matrice
        strategy: 'REMOVE_STANDALONE_VARIANT',
      },
      50 + aCreer.length * 2
    )

    if (data.productVariantsBulkCreate.userErrors?.length) {
      throw new Error(
        `productVariantsBulkCreate : ${data.productVariantsBulkCreate.userErrors[0].message}`
      )
    }
    this.logger.success(
      `${data.productVariantsBulkCreate.productVariants.length} variante(s) créée(s)`
    )
  }

  /* ------------------------------------------------------------------ */
  /* Étape 3 — template                                                  */
  /* ------------------------------------------------------------------ */

  private async etapeTemplate(shopify: Shopify, productGid: string, etat: EtatProduit) {
    if (etat.templateSuffix === TEMPLATE_SUFFIX_CIBLE) {
      this.logger.info(`templateSuffix déjà "${TEMPLATE_SUFFIX_CIBLE}" — ignoré`)
      return
    }
    await shopify.product.update(productGid, { templateSuffix: TEMPLATE_SUFFIX_CIBLE })
    this.logger.success(`templateSuffix posé : "${TEMPLATE_SUFFIX_CIBLE}"`)
  }

  /* ------------------------------------------------------------------ */
  /* Étape 4 — catégorie                                                 */
  /* ------------------------------------------------------------------ */

  private async etapeCategorie(shopify: Shopify, productGid: string, etat: EtatProduit) {
    if (etat.category?.id === CATEGORIE_POSTERS_GID) {
      this.logger.info(`Catégorie déjà en place (${etat.category.fullName}) — ignorée`)
      return
    }

    await shopify.category.setProductCategory(productGid, CATEGORIE_POSTERS_GID)
    this.logger.success(
      'Catégorie posée : Posters (hg-3-4-2-1, exigée par la définition poster.isCustom)'
    )
  }

  /* ------------------------------------------------------------------ */
  /* Étape 5 — metafields                                                */
  /* ------------------------------------------------------------------ */

  private async etapeMetafields(shopify: Shopify, productGid: string, etat: EtatProduit) {
    // poster.isCustom : namespace neuf -> type explicite pour que metafieldsSet
    // puisse créer la valeur même sans définition préalable
    if (etat.isCustomMetafield?.value === 'true') {
      this.logger.info('Metafield poster.isCustom déjà à true — ignoré')
    } else {
      await this.poserMetafieldType(productGid, 'poster', 'isCustom', 'true', 'boolean')
      this.logger.success('Metafield poser : poster.isCustom = true')
    }

    // artwork.type et painting.layout : définitions existantes du catalogue,
    // même chemin que le reste du back (metafieldsSet sans type)
    if (etat.artworkTypeMetafield?.value === 'poster') {
      this.logger.info('Metafield artwork.type déjà à "poster" — ignoré')
    } else {
      await shopify.metafield.update(productGid, 'artwork', 'type', 'poster')
      this.logger.success('Metafield posé : artwork.type = poster')
    }

    if (etat.paintingLayoutMetafield?.value === LAYOUT_METAOBJECT_GID) {
      this.logger.info('Metafield painting.layout déjà posé — ignoré')
    } else {
      await shopify.metafield.update(productGid, 'painting', 'layout', LAYOUT_METAOBJECT_GID)
      this.logger.success(`Metafield posé : painting.layout = ${LAYOUT_METAOBJECT_GID}`)
    }
  }

  /** metafieldsSet avec type explicite (création possible sans définition préalable). */
  private async poserMetafieldType(
    ownerId: string,
    namespace: string,
    key: string,
    value: string,
    type: string
  ) {
    const data = await this.gql(
      `mutation PoserMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            namespace
            key
            value
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      { metafields: [{ ownerId, namespace, key, value, type }] },
      10
    )
    if (data.metafieldsSet.userErrors?.length) {
      throw new Error(
        `metafieldsSet ${namespace}.${key} : ${data.metafieldsSet.userErrors[0].message}`
      )
    }
  }

  /* ------------------------------------------------------------------ */
  /* Étape 6 — récapitulatif                                             */
  /* ------------------------------------------------------------------ */

  private afficherRecapitulatif(etat: EtatProduit, grille: Map<string, string>) {
    console.info('')
    console.info('================= RÉCAPITULATIF =================')
    console.info(`Produit         : ${etat.title}`)
    console.info(`GID             : ${etat.id}`)
    console.info(`Status          : ${etat.status}`)

    const templateOk = etat.templateSuffix === TEMPLATE_SUFFIX_CIBLE
    console.info(`templateSuffix  : ${etat.templateSuffix ?? '(aucun)'} ${templateOk ? '✔' : '✘'}`)
    if (!templateOk) this.problemes.push(`templateSuffix attendu "${TEMPLATE_SUFFIX_CIBLE}"`)

    const categorieOk = etat.category?.id === CATEGORIE_POSTERS_GID
    console.info(
      `Catégorie       : ${etat.category?.fullName ?? '(aucune)'} ${categorieOk ? '✔' : '✘'}`
    )
    if (!categorieOk)
      this.problemes.push(
        `Catégorie attendue ${CATEGORIE_POSTERS_GID}, trouvée ${etat.category?.id ?? '(aucune)'}`
      )

    console.info('')
    console.info('Options :')
    for (const attendue of OPTIONS_ATTENDUES) {
      const existante = etat.options.find((o) => o.name === attendue.name)
      const valeurs = existante?.optionValues.map((v) => v.name) ?? []
      const ok =
        valeurs.length === attendue.values.length &&
        attendue.values.every((v) => valeurs.includes(v))
      console.info(`  ${ok ? '✔' : '✘'} ${attendue.name} : ${valeurs.join(', ') || '(absente)'}`)
      if (!ok && !this.problemes.some((p) => p.includes(`"${attendue.name}"`))) {
        this.problemes.push(`Option "${attendue.name}" absente ou incomplète`)
      }
    }

    console.info('')
    console.info('Variantes (taille × cadre, prix grille) :')
    const variantesValides = etat.variants.nodes.filter((v) =>
      v.selectedOptions.some((o) => o.name === 'Tailles')
    )
    for (const taille of OPTIONS_ATTENDUES[0].values) {
      for (const cadre of OPTIONS_ATTENDUES[1].values) {
        const cle = `${taille}|${cadre}`
        const prixAttendu = grille.get(cle) as string
        const variante = variantesValides.find(
          (v) =>
            v.selectedOptions.find((o) => o.name === 'Tailles')?.value === taille &&
            v.selectedOptions.find((o) => o.name === 'Cadres')?.value === cadre
        )
        if (!variante) {
          console.info(
            `  ✘ ${taille.padEnd(10)} | ${cadre.padEnd(20)} | MANQUANTE (grille : ${prixAttendu} €)`
          )
          this.problemes.push(`Variante manquante : ${taille} / ${cadre}`)
        } else {
          const prixOk = parseFloat(variante.price) === parseFloat(prixAttendu)
          console.info(
            `  ${prixOk ? '✔' : '✘'} ${taille.padEnd(10)} | ${cadre.padEnd(20)} | ${variante.price} €${
              prixOk ? '' : ` (grille : ${prixAttendu} €)`
            }`
          )
        }
      }
    }
    console.info(`  Total : ${variantesValides.length}/12 variantes`)

    console.info('')
    console.info('Metafields :')
    const lignes: Array<[string, string | undefined, string]> = [
      ['poster.isCustom', etat.isCustomMetafield?.value, 'true'],
      ['artwork.type', etat.artworkTypeMetafield?.value, 'poster'],
      ['painting.layout', etat.paintingLayoutMetafield?.value, LAYOUT_METAOBJECT_GID],
    ]
    for (const [nom, valeur, attendu] of lignes) {
      const ok = valeur === attendu
      console.info(`  ${ok ? '✔' : '✘'} ${nom.padEnd(16)} = ${valeur ?? '(absent)'}`)
      if (!ok)
        this.problemes.push(
          `Metafield ${nom} attendu "${attendu}", trouvé "${valeur ?? '(absent)'}"`
        )
    }
    console.info('=================================================')
    console.info('')
  }
}
