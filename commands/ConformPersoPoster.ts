import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'

/**
 * Conforme un poster PERSONNALISÉ (studio, poster.isCustom=true) existant au PRESET RÉDUIT du
 * modèle poster — le même que celui produit désormais par PersonalizedSetup pour les nouveaux
 * posters perso. Un poster perso EST un poster : mêmes papier/formats/cadres/impression, seule
 * la grille de variantes change.
 *
 * Cible EXACTE (idempotent — no-op si déjà conforme) :
 *   - 2 options : Format {30x40 cm, 60x80 cm} × Cadre {Sans cadre, Avec cadre}
 *   - 4 variantes : 30x40/Sans=24.90, 30x40/Avec=47.90, 60x80/Sans=44.90, 60x80/Avec=94.90
 *   - painting_options.frames_poster = 4 pastilles de couleur (couleur = line-item property)
 *   - painting_options.sizes = 30x40 & 60x80 uniquement (plus de 75x100 ni 90x120)
 *   - suppression de painting_options.frames_canvas et painting_options.borders (résidus de
 *     l'ancien modèle : la couleur de cadre et le contour blanc sont des properties, pas des
 *     variantes ni des listes de métaobjets — cf. posters standard qui n'ont ni l'un ni l'autre).
 *
 * La COULEUR du cadre et le CONTOUR BLANC ne deviennent PAS des variantes : le thème/studio les
 * gère en line-item properties (`Couleur du cadre` + `_cadre`, `Contour blanc` + `_passe_partout`).
 * studio.config / studio.recipe / studio.references / fixations restent INCHANGÉS.
 *
 * Méthode : teardown total des options (productOptionsDelete POSITION → 1 variante) puis rebuild
 * déterministe (createOptions LEAVE_AS_IS → la variante par défaut hérite des 1res valeurs → prix
 * → bulk-create des 3 autres) — même patron que PersonalizedSetup.createVariantGrid. Renomme donc
 * aussi les options (Tailles/Cadres → Format/Cadre) au passage.
 *
 *   node ace shopify:conform_perso_poster 10565374247259 --dry-run
 *   node ace shopify:conform_perso_poster 10565374247259 10528685621595
 */
export default class ConformPersoPoster extends BaseCommand {
  public static commandName = 'shopify:conform_perso_poster'
  public static description =
    'Conforme un poster perso existant au preset réduit (Format×Cadre = 4 variantes + frames_poster)'

  public static settings = { loadApp: true, stayAlive: false }

  @args.spread({ description: 'Poster perso product IDs (numeric ou gid://)', required: true })
  public productIds: string[]

  @flags.boolean({ description: 'Affiche le plan sans rien muter' })
  public dryRun: boolean

  private static readonly OPTION_SIZE_NAME = 'Format'
  private static readonly OPTION_FRAME_NAME = 'Cadre'
  private static readonly SIZE_VALUES = ['30x40 cm', '60x80 cm']
  private static readonly FRAME_VALUES = ['Sans cadre', 'Avec cadre']

  // Les 4 pastilles de couleur de cadre POSTER (mêmes métaobjets que les posters standard).
  private static readonly FRAMES_POSTER = [
    'gid://shopify/Metaobject/138918297947', // Cadre noir Mat
    'gid://shopify/Metaobject/138917380443', // Cadre blanc
    'gid://shopify/Metaobject/138918855003', // Cadre chêne clair
    'gid://shopify/Metaobject/138919182683', // Cadre noyer
  ]
  // painting_options.sizes : 30x40 & 60x80 uniquement.
  private static readonly SIZES = [
    'gid://shopify/Metaobject/138179739995', // 30x40 cm
    'gid://shopify/Metaobject/138451485019', // 60x80 cm
  ]

  private static priceFor(size: string, frame: string): string {
    if (size === '30x40 cm') return frame === 'Sans cadre' ? '24.90' : '47.90'
    return frame === 'Sans cadre' ? '44.90' : '94.90'
  }

  /** Les 4 variantes cibles, dans l'ordre Shopify (size externe, frame interne). */
  private static targetVariants() {
    const out: Array<{ size: string; frame: string; price: string }> = []
    for (const size of ConformPersoPoster.SIZE_VALUES) {
      for (const frame of ConformPersoPoster.FRAME_VALUES) {
        out.push({ size, frame, price: ConformPersoPoster.priceFor(size, frame) })
      }
    }
    return out
  }

  public async run() {
    const shopify = new Shopify()
    for (const raw of this.productIds) {
      const id = raw.startsWith('gid://') ? raw : `gid://shopify/Product/${raw}`
      try {
        await this.conform(shopify, id)
      } catch (error) {
        this.logger.error(`[${id}] échec : ${error?.message ?? error}`)
      }
    }
    this.logger.info('Terminé.')
  }

  private async conform(shopify: Shopify, id: string) {
    let product = await shopify.product.getProductById(id)
    this.logger.info(
      `[${id}] "${product.title}" — ${product.variants?.nodes?.length ?? 0} variantes : ` +
        product.variants.nodes.map((v: any) => `${v.title} @${v.price}`).join(' | ')
    )

    // Garde : uniquement des posters perso (poster.isCustom=true). Empêche de casser par erreur
    // un poster standard ou un tout autre produit passé en argument.
    if (product.posterIsCustomMetafield?.value !== 'true') {
      this.logger.warning(`[${id}] poster.isCustom≠true — ignoré (ce n'est pas un poster perso).`)
      return
    }

    // Idempotence : options == [Format{30x40,60x80}, Cadre{Sans cadre,Avec cadre}] et 4 variantes ?
    if (this.alreadyConform(product)) {
      this.logger.success(`[${id}] variantes déjà conformes — on ne touche qu'aux metafields.`)
      if (!this.dryRun) await this.setMetafields(shopify, id)
      return
    }

    const target = ConformPersoPoster.targetVariants()
    this.logger.info(
      `[${id}] plan : teardown des options → rebuild ${ConformPersoPoster.OPTION_SIZE_NAME}×` +
        `${ConformPersoPoster.OPTION_FRAME_NAME} = ${target.length} variantes ` +
        `(${target.map((t) => `${t.size}/${t.frame} @${t.price}`).join(', ')}) ; ` +
        `frames_poster + sizes(2) ; suppression frames_canvas${
          this.hasPaintingOption(product, 'borders') ? ' + borders' : ''
        }`
    )

    if (this.dryRun) {
      this.logger.info(`[${id}] --dry-run : aucune mutation.`)
      return
    }

    // 1) Teardown total des options → 1 variante « Default Title » (POSITION strategy).
    await shopify.product.deleteAllOptions(id)

    // 2) Rebuild : createOptions LEAVE_AS_IS → la variante par défaut hérite des 1res valeurs.
    await shopify.product.createOptions(id, [
      { name: ConformPersoPoster.OPTION_SIZE_NAME, values: ConformPersoPoster.SIZE_VALUES },
      { name: ConformPersoPoster.OPTION_FRAME_NAME, values: ConformPersoPoster.FRAME_VALUES },
    ])

    // 3) La variante par défaut = 1re combinaison (30x40 / Sans cadre) → on lui pose son prix,
    // puis on crée les 3 autres.
    product = await shopify.product.getProductById(id)
    const defaultVariant = product.variants?.nodes?.[0]
    if (!defaultVariant)
      throw new Error('Variante par défaut introuvable après création des options.')
    const [first, ...rest] = target
    await shopify.product.updateVariant(id, defaultVariant.id, { price: first.price })
    await shopify.product.createVariantsBulk(
      id,
      rest.map((t) => ({
        price: t.price,
        optionValues: [
          { optionName: ConformPersoPoster.OPTION_SIZE_NAME, name: t.size },
          { optionName: ConformPersoPoster.OPTION_FRAME_NAME, name: t.frame },
        ],
      }))
    )

    // 4) Metafields (frames_poster + sizes ; nettoyage frames_canvas/borders).
    await this.setMetafields(shopify, id)

    // 5) Vérification.
    const after = await shopify.product.getProductById(id)
    const titles = after.variants.nodes.map((v: any) => `${v.title} @${v.price}`)
    const ok =
      after.variants.nodes.length === target.length &&
      target.every((t) =>
        after.variants.nodes.some(
          (v: any) => v.title === `${t.size} / ${t.frame}` && v.price === t.price
        )
      )
    if (ok) {
      this.logger.success(`[${id}] conforme — ${titles.join(' | ')}`)
    } else {
      this.logger.error(`[${id}] ⚠️ résultat inattendu (${titles.length}) : ${titles.join(' | ')}`)
    }
  }

  /** Pose frames_poster + sizes ; supprime les résidus frames_canvas / borders (best-effort). */
  private async setMetafields(shopify: Shopify, id: string) {
    await shopify.metafield.update(
      id,
      'painting_options',
      'frames_poster',
      JSON.stringify(ConformPersoPoster.FRAMES_POSTER),
      'list.metaobject_reference'
    )
    await shopify.metafield.update(
      id,
      'painting_options',
      'sizes',
      JSON.stringify(ConformPersoPoster.SIZES),
      'list.metaobject_reference'
    )
    for (const key of ['frames_canvas', 'borders']) {
      try {
        await shopify.metafield.delete(id, 'painting_options', key)
      } catch (e: any) {
        this.logger.warning(
          `[${id}] suppression painting_options.${key} échouée : ${e?.message ?? e}`
        )
      }
    }
  }

  private hasPaintingOption(product: any, key: string): boolean {
    return Boolean(product.paintingOptionsMetafields?.nodes?.some((m: any) => m.key === key))
  }

  private alreadyConform(product: any): boolean {
    const options = product.options ?? []
    if (options.length !== 2) return false
    const size = options.find((o: any) => o.name === ConformPersoPoster.OPTION_SIZE_NAME)
    const frame = options.find((o: any) => o.name === ConformPersoPoster.OPTION_FRAME_NAME)
    if (!size || !frame) return false
    const sameSet = (vals: string[], want: string[]) =>
      vals.length === want.length && want.every((w) => vals.includes(w))
    const sizeVals = size.optionValues.map((v: any) => v.name)
    const frameVals = frame.optionValues.map((v: any) => v.name)
    if (!sameSet(sizeVals, ConformPersoPoster.SIZE_VALUES)) return false
    if (!sameSet(frameVals, ConformPersoPoster.FRAME_VALUES)) return false
    return (product.variants?.nodes?.length ?? 0) === ConformPersoPoster.targetVariants().length
  }
}
