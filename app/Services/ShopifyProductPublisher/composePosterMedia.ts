/**
 * Assemblage du tableau `media` d'un produit (mockups + œuvre + jumeaux passe-partout).
 *
 * Logique EXTRAITE de ShopifyProductPublishersController.publishOnShopify pour être PARTAGÉE entre :
 *   - le studio (publish normal / draft)        : `resolveMockupAlt` = alt IA (generateMockupAlt) ;
 *   - le mode COPIE (BulkPostersController.createOne) : `resolveMockupAlt` = alt DÉTERMINISTE (zéro IA).
 *
 * Conventions PRÉSERVÉES (ne pas régresser) :
 *   - 2 passes : (1) tous les visuels SAUF les jumeaux ; (2) les jumeaux passe-partout, qui RÉUTILISENT
 *     l'alt/le filename de leur mockup source (lookup par clientId), suffixe « passe-partout », zéro IA ;
 *   - l'œuvre (index === originalImageIndex) garde son alt/filename ;
 *   - le 1er mockup (index 0, fond blanc) réutilise l'alt de l'œuvre + un slug dérivé ;
 *   - en mode brouillon (`draft`), suffixe d'index sur chaque filename (sauf l'œuvre) → noms UNIQUES,
 *     pour que le thème apparie image↔jumeau PAR NOM DE FICHIER sans collision ;
 *   - l'ordre final du tableau = l'ordre du payload (mediaByIndex).
 */

const PP_ALT_SUFFIX = ' — passe-partout blanc'
const PP_FILENAME_SUFFIX = '-passe-partout'

/** Slug SEO depuis un alt (identique au studio : minuscules, [^a-z0-9]→'-', trim, 80 max). */
export function slugFromAlt(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
}

export interface PosterMediaImageMeta {
  type?: 'mockup' | 'original'
  mockupContext?: string
  clientId?: string
  passePartout?: boolean
  passePartoutOf?: string
}

export interface ComposePosterMediaParams {
  /** URLs locales des images (1 par entrée du payload, dans le MÊME ordre). */
  originalImageUrls: string[]
  /** Métadonnées des images (passePartout, clientId, mockupContext…), même ordre que les URLs. */
  imageMetas: PosterMediaImageMeta[]
  /** Index de l'œuvre (type === 'original'). */
  originalImageIndex: number
  /** Brouillon (batch posters) → suffixe d'index pour des noms de fichiers uniques. */
  draft: boolean
  /** Alt/filename de l'œuvre (réutilisés par l'œuvre, le 1er mockup et le repli des jumeaux). */
  mainArtworkAlt: string
  mainArtworkFilename: string
  /** Résout l'alt/filename d'un mockup « autre » (ni œuvre, ni 1er mockup). IA côté studio, déterministe côté copie. */
  resolveMockupAlt: (
    index: number,
    mockupContext: string | undefined
  ) => Promise<{ alt: string; filename: string }>
  /** Renomme le fichier source (SEO) et renvoie l'URL servable. */
  replaceSrcName: (url: string, filename: string) => Promise<string>
}

export async function composePosterMedia(
  params: ComposePosterMediaParams
): Promise<Array<{ src: string; alt: string }>> {
  const {
    originalImageUrls,
    imageMetas,
    originalImageIndex,
    draft,
    mainArtworkAlt,
    mainArtworkFilename,
    resolveMockupAlt,
    replaceSrcName,
  } = params

  const mediaByIndex: Array<{ src: string; alt: string } | null> = new Array(
    originalImageUrls.length
  ).fill(null)
  const altByClientId = new Map<string, { alt: string; filename: string }>()

  // Passe 1 : tout SAUF les jumeaux passe-partout
  await Promise.all(
    originalImageUrls.map(async (url, index) => {
      const meta = imageMetas[index]
      if (meta?.passePartout) return // -> passe 2

      let alt: string
      let filename: string
      if (index === originalImageIndex) {
        // Œuvre : alt/filename générés (studio) ou déterministes (copie)
        alt = mainArtworkAlt
        filename = mainArtworkFilename
      } else if (index === 0) {
        // 1er mockup (fond blanc) : réutilise l'alt de l'œuvre + slug dérivé (évite un doublon de filename)
        alt = mainArtworkAlt
        filename = slugFromAlt(mainArtworkAlt)
      } else {
        // Autres mockups : alt contextuel (IA côté studio, déterministe côté copie)
        ;({ alt, filename } = await resolveMockupAlt(index, meta?.mockupContext))
      }

      // Brouillon : nom de fichier UNIQUE par mockup (l'index désambiguïse). Studio publish inchangé.
      if (draft && index !== originalImageIndex) filename = `${filename}-${index}`
      mediaByIndex[index] = {
        src: await replaceSrcName(url, filename),
        alt,
      }
      if (meta?.clientId) altByClientId.set(meta.clientId, { alt, filename })
    })
  )

  // Passe 2 : jumeaux passe-partout (réutilisent l'alt/filename du mockup source, pas d'IA)
  await Promise.all(
    originalImageUrls.map(async (url, index) => {
      const meta = imageMetas[index]
      if (!meta?.passePartout) return
      const base = (meta.passePartoutOf && altByClientId.get(meta.passePartoutOf)) || {
        alt: mainArtworkAlt,
        filename: mainArtworkFilename,
      }
      mediaByIndex[index] = {
        src: await replaceSrcName(url, base.filename + PP_FILENAME_SUFFIX),
        alt: base.alt + PP_ALT_SUFFIX,
      }
    })
  )

  return mediaByIndex.filter((m): m is { src: string; alt: string } => m !== null)
}
