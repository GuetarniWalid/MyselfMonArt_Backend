import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import Shopify from 'App/Services/Shopify'
import {
  OPTION_SIZE_NAME,
  OPTION_FRAME_NAME,
  FRAME_VALUES,
  POSTER_SIZE_VALUES,
  POSTER_SIZES_GIDS,
  FRAMES_POSTER_GIDS,
  posterVariantSpecs,
} from 'App/Services/ShopifyProductPublisher/posterPreset'

/**
 * Conforme un poster PERSONNALISÉ (studio, poster.isCustom=true) existant à la grille de variantes
 * du modèle poster — la MÊME que celle produite désormais par PersonalizedSetup pour les nouveaux
 * posters perso (source unique : posterPreset.ts). Un poster perso EST un poster : mêmes papier /
 * formats / cadres / impression, AUCUNE différence de tailles ; seul l'axe couleur/contour quitte
 * les variantes pour devenir des line-item properties.
 *
 * Cible EXACTE (idempotent — no-op si déjà conforme) :
 *   - 2 options : Format {30x40, 60x80, 75x100, 90x120} × Cadre {Sans cadre, Avec cadre}
 *   - 7 variantes (90x120 = Sans cadre uniquement), prix = grille poster standard
 *   - painting_options.frames_poster = 4 pastilles de couleur (couleur = line-item property)
 *   - painting_options.sizes = les 4 tailles poster
 *   - suppression de painting_options.frames_canvas et painting_options.borders (résidus de
 *     l'ancien modèle : couleur de cadre et contour blanc sont des properties, pas des variantes ni
 *     des listes de métaobjets — cf. posters standard qui n'ont ni l'un ni l'autre).
 *
 * studio.config / studio.recipe / studio.references / fixations restent INCHANGÉS.
 *
 * Méthode : teardown total des options (productOptionsDelete POSITION → 1 variante) puis rebuild
 * déterministe (createOptions LEAVE_AS_IS → la variante par défaut hérite des 1res valeurs → prix
 * → bulk-create des autres) — même patron que PersonalizedSetup.createVariantGrid. Renomme donc
 * aussi les options (Tailles/Cadres → Format/Cadre) au passage.
 *
 *   node ace shopify:conform_perso_poster 10565374247259 --dry-run
 *   node ace shopify:conform_perso_poster 10565374247259 10528685621595
 */
export default class ConformPersoPoster extends BaseCommand {
  public static commandName = 'shopify:conform_perso_poster'
  public static description =
    'Conforme un poster perso existant à la grille poster (Format×Cadre, 7 variantes + frames_poster)'

  public static settings = { loadApp: true, stayAlive: false }

  @args.spread({ description: 'Poster perso product IDs (numeric ou gid://)', required: true })
  public productIds: string[]

  @flags.boolean({ description: 'Affiche le plan sans rien muter' })
  public dryRun: boolean

  /** Titre de variante Shopify attendu pour une spec ("Format / Cadre" joint par " / "). */
  private static titleOf(spec: { optionValues: { name: string }[] }): string {
    return spec.optionValues.map((o) => o.name).join(' / ')
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

    const target = posterVariantSpecs()

    // Idempotence : options == [Format{4 tailles}, Cadre{Sans,Avec}] et le bon nombre de variantes ?
    if (this.alreadyConform(product, target.length)) {
      this.logger.success(`[${id}] variantes déjà conformes — on ne touche qu'aux metafields.`)
      if (!this.dryRun) await this.setMetafields(shopify, id)
      return
    }

    this.logger.info(
      `[${id}] plan : teardown des options → rebuild ${OPTION_SIZE_NAME}×${OPTION_FRAME_NAME} = ` +
        `${target.length} variantes (${target
          .map((t) => `${ConformPersoPoster.titleOf(t)} @${t.price}`)
          .join(', ')}) ; frames_poster + sizes(${POSTER_SIZES_GIDS.length}) ; suppression ` +
        `frames_canvas${this.hasPaintingOption(product, 'borders') ? ' + borders' : ''}`
    )

    if (this.dryRun) {
      this.logger.info(`[${id}] --dry-run : aucune mutation.`)
      return
    }

    // 1) Teardown total des options → 1 variante « Default Title » (POSITION strategy).
    await shopify.product.deleteAllOptions(id)

    // 2) Rebuild : createOptions LEAVE_AS_IS → la variante par défaut hérite des 1res valeurs.
    await shopify.product.createOptions(id, [
      { name: OPTION_SIZE_NAME, values: POSTER_SIZE_VALUES },
      { name: OPTION_FRAME_NAME, values: FRAME_VALUES },
    ])

    // 3) La variante par défaut = 1re combinaison (30x40 / Sans cadre) → on lui pose son prix,
    // puis on crée les autres.
    product = await shopify.product.getProductById(id)
    const defaultVariant = product.variants?.nodes?.[0]
    if (!defaultVariant)
      throw new Error('Variante par défaut introuvable après création des options.')
    const [first, ...rest] = target
    await shopify.product.updateVariant(id, defaultVariant.id, { price: first.price })
    await shopify.product.createVariantsBulk(id, rest)

    // 4) Metafields (frames_poster + sizes ; nettoyage frames_canvas/borders).
    await this.setMetafields(shopify, id)

    // 5) Vérification.
    const after = await shopify.product.getProductById(id)
    const titles = after.variants.nodes.map((v: any) => `${v.title} @${v.price}`)
    const ok =
      after.variants.nodes.length === target.length &&
      target.every((t) =>
        after.variants.nodes.some(
          (v: any) => v.title === ConformPersoPoster.titleOf(t) && v.price === t.price
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
      JSON.stringify(FRAMES_POSTER_GIDS),
      'list.metaobject_reference'
    )
    await shopify.metafield.update(
      id,
      'painting_options',
      'sizes',
      JSON.stringify(POSTER_SIZES_GIDS),
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

  private alreadyConform(product: any, targetVariantCount: number): boolean {
    const options = product.options ?? []
    if (options.length !== 2) return false
    const size = options.find((o: any) => o.name === OPTION_SIZE_NAME)
    const frame = options.find((o: any) => o.name === OPTION_FRAME_NAME)
    if (!size || !frame) return false
    const sameSet = (vals: string[], want: string[]) =>
      vals.length === want.length && want.every((w) => vals.includes(w))
    const sizeVals = size.optionValues.map((v: any) => v.name)
    const frameVals = frame.optionValues.map((v: any) => v.name)
    if (!sameSet(sizeVals, POSTER_SIZE_VALUES)) return false
    if (!sameSet(frameVals, FRAME_VALUES)) return false
    return (product.variants?.nodes?.length ?? 0) === targetVariantCount
  }
}
