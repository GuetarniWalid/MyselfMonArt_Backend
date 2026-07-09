/**
 * SOURCE UNIQUE du preset de variantes d'un POSTER (perso ou standard) — un poster perso EST un
 * poster : AUCUNE différence sur les tailles ni la grille. Partagé par PersonalizedSetup (création
 * des nouveaux posters perso) et la commande shopify:conform_perso_poster (mise en conformité des
 * posters perso existants), pour qu'ils ne divergent jamais.
 *
 * Modèle (identique aux posters standard, cf. produit live 10290792923483) :
 *   - 2 options : Format {30x40, 60x80, 75x100, 90x120} × Cadre {Sans cadre, Avec cadre}
 *   - Le cadre est un axe {Sans cadre, Avec cadre} : la COULEUR du cadre et le CONTOUR BLANC sont
 *     des line-item properties (`Couleur du cadre`+`_cadre`, `Contour blanc`+`_passe_partout`),
 *     PAS des variantes. Le thème lit painting_options.frames_poster pour les couleurs.
 *   - 90x120 n'a PAS de version « Avec cadre » (règle poster standard) → 7 variantes au total.
 *   - Prix = grille poster standard.
 */

export const OPTION_SIZE_NAME = 'Format'
export const OPTION_FRAME_NAME = 'Cadre'
export const FRAME_SANS = 'Sans cadre'
export const FRAME_AVEC = 'Avec cadre'
export const FRAME_VALUES = [FRAME_SANS, FRAME_AVEC]

export interface PosterSize {
  name: string
  gid: string
  /** Prix « Sans cadre ». */
  sans: string
  /** Prix « Avec cadre », ou null si la taille n'a pas de version cadrée (90x120). */
  avec: string | null
}

// Métaobjets `painting_option` de type « size » (mêmes que les posters standard).
export const POSTER_SIZE_GRID: PosterSize[] = [
  { name: '30x40 cm', gid: 'gid://shopify/Metaobject/138179739995', sans: '24.90', avec: '47.90' },
  { name: '60x80 cm', gid: 'gid://shopify/Metaobject/138451485019', sans: '44.90', avec: '94.90' },
  {
    name: '75x100 cm',
    gid: 'gid://shopify/Metaobject/138451878235',
    sans: '64.90',
    avec: '134.90',
  },
  { name: '90x120 cm', gid: 'gid://shopify/Metaobject/138452500827', sans: '71.90', avec: null },
]

export const POSTER_SIZE_VALUES = POSTER_SIZE_GRID.map((s) => s.name)
export const POSTER_SIZES_GIDS = POSTER_SIZE_GRID.map((s) => s.gid)

// painting_options.frames_poster : 4 pastilles de couleur de cadre POSTER (couleur = property).
export const FRAMES_POSTER_GIDS = [
  'gid://shopify/Metaobject/138918297947', // Cadre noir Mat
  'gid://shopify/Metaobject/138917380443', // Cadre blanc
  'gid://shopify/Metaobject/138918855003', // Cadre chêne clair
  'gid://shopify/Metaobject/138919182683', // Cadre noyer
]

export const FIXATIONS_GIDS = [
  'gid://shopify/Metaobject/138270671195',
  'gid://shopify/Metaobject/138271359323',
]

export interface PosterVariantSpec {
  price: string
  optionValues: { optionName: string; name: string }[]
}

/**
 * Les variantes cibles, dans l'ordre Shopify (size externe, « Sans cadre » puis « Avec cadre »).
 * La 1re (30x40 / Sans cadre) = variante par défaut après createOptions LEAVE_AS_IS. 90x120 :
 * « Sans cadre » uniquement. → 7 variantes.
 */
export function posterVariantSpecs(): PosterVariantSpec[] {
  const specs: PosterVariantSpec[] = []
  for (const size of POSTER_SIZE_GRID) {
    specs.push({
      price: size.sans,
      optionValues: [
        { optionName: OPTION_SIZE_NAME, name: size.name },
        { optionName: OPTION_FRAME_NAME, name: FRAME_SANS },
      ],
    })
    if (size.avec) {
      specs.push({
        price: size.avec,
        optionValues: [
          { optionName: OPTION_SIZE_NAME, name: size.name },
          { optionName: OPTION_FRAME_NAME, name: FRAME_AVEC },
        ],
      })
    }
  }
  return specs
}
