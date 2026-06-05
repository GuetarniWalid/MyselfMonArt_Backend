import Logger from '@ioc:Adonis/Core/Logger'
import sharp from 'sharp'
import { GoogleGenAI } from '@google/genai'

type Target = 'portrait' | 'square' | 'landscape'
type Product = 'canvas' | 'poster' | 'tapestry'

export interface InsertOptions {
  product?: Product
  fidelity?: 'standard' | 'high' // 'high' = Nano Banana Pro (meilleur sur le texte, ~3x plus cher)
}

// Ratio cible par orientation (verrouille l'aspectRatio de sortie = celui du décor -> cadre aligné).
const TARGET = {
  portrait: { ratio: '3:4' },
  square: { ratio: '1:1' },
  landscape: { ratio: '4:3' },
} as const

// IDs modèles SÛRS (ne pas utiliser 'gemini-3-pro-image' ni 'gemini-3.1-flash-image' : non fiables).
const FLASH_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'
const PRO_MODEL = process.env.GEMINI_IMAGE_MODEL_HIGH || 'gemini-3-pro-image-preview'

// Vocabulaire d'insertion par PRODUIT : le support n'est PAS toujours un cadre.
// - canvas   : toile tendue sur châssis (gallery-wrapped), AUCUN cadre -> sinon Gemini en invente un.
// - poster   : feuille imprimée dans un cadre fin (le cadre existe vraiment).
// - tapestry : panneau textile tissé suspendu à une tringle, sans cadre ni verre.
const SUPPORT: Record<
  Product,
  {
    surface: string // nom du support tel qu'il apparaît dans le décor
    face: string // nom de la surface grise à remplir
    mounted: string // "...comme la vraie oeuvre <mounted>"
    fitClause: string // précision sur l'ajustement bord à bord / wrap
    supportRule: string // règle dure spécifique au support (cadre ou pas)
    negative: string // rappel négatif final propre au support
  }
> = {
  canvas: {
    surface:
      'gallery-wrapped stretched canvas (a bare canvas stretched over a wooden stretcher frame, NO surrounding picture frame)',
    face: 'canvas face',
    mounted: 'artwork printed directly onto that bare stretched canvas',
    fitClause:
      'The print covers the canvas face edge-to-edge; if the thin wrapped side edges (the shallow depth of the canvas) are visible, let the artwork wrap cleanly and continuously around them. Keep the canvas perfectly flat and planar with its clean wrapped edges and subtle shallow depth.',
    supportRule:
      'This is a FRAMELESS gallery-wrapped canvas — it is a canvas, NOT a poster and NOT a framed picture. Do NOT add or invent any frame, border, mat, passe-partout, fillet, molding or glass around it. The image goes directly onto the bare stretched canvas, edge-to-edge. Reuse the exact frameless canvas object already in the FIRST image and keep it frameless.',
    negative:
      'no added frame, no border, no mat, no molding, no glass — it stays a bare frameless gallery-wrapped stretched canvas with clean wrapped edges',
  },
  poster: {
    surface: 'framed poster: a flat printed sheet inside the slim minimalist frame already present',
    face: 'poster sheet area',
    mounted: 'real printed poster mounted in that existing frame',
    fitClause:
      'The print fills the whole aperture edge-to-edge with NO mat / no passe-partout, sitting flat behind the frame opening.',
    supportRule:
      'Reuse the slim frame that is ALREADY in the FIRST image. Do NOT add a SECOND frame, extra border, mat or molding. The artwork stays strictly inside the existing aperture.',
    negative: 'no second frame, no extra border or mat, keep the single slim frame already present',
  },
  tapestry: {
    surface:
      'soft woven wall tapestry / textile panel hung flat from a slim wooden rod (no frame, no glass)',
    face: 'textile face',
    mounted: 'design woven into that hanging textile panel',
    fitClause:
      'The artwork sits flat across the rectangular textile face, following its subtle natural weave and any gentle fabric undulation, edge-to-edge with no leftover grey band.',
    supportRule:
      'This is a soft textile hung from a slim rod — NOT a framed picture. Do NOT add any frame, border, mat, molding or glass. Keep the existing tapestry object and its rod exactly as they are.',
    negative: 'no frame, no glass, no border — keep the hanging woven textile look',
  },
}

// Prompt d'insertion PRODUIT-AWARE : place l'oeuvre dans la surface vide grise du bon support
// (toile nue / poster encadré / tapisserie), fidèlement, sans rien toucher d'autre dans la pièce.
function buildInsertionPrompt(product: Product): string {
  const s = SUPPORT[product]
  return `You are compositing two images. The FIRST image is an interior photograph that contains ONE empty ${s.surface}, with a flat light-grey (#ECECEC) ${s.face}. The SECOND image is an artwork.

Task: place the SECOND image (the artwork) so it fills EXACTLY the empty light-grey ${s.face} of the existing support in the FIRST image, as if it were the real ${s.mounted}.

Hard rules:
- Keep the artwork 100% identical to the SECOND image: same colors, same patterns, same composition, same brush/print texture, and reproduce any text or signature exactly, character-for-character, with the same fonts and layout. Do NOT redraw, restyle, re-illustrate, crop, mirror, or re-interpret the artwork.
- Only fit the artwork to the grey ${s.face}. Match its perspective, scale and corners so the artwork sits flat with correct foreshortening, edge to edge, with no leftover grey band. ${s.fitClause}
- Adapt ONLY global lighting to the room: apply the same soft light direction and subtle shadows already present on the support, so it looks naturally lit. The support is MATTE (no glass, no sheen): do NOT add any glossy reflection, specular highlight or glare — keep its surface matte. Do not alter the artwork's own colors or content.
- SUPPORT TYPE (critical): ${s.supportRule}
- Keep EVERYTHING ELSE in the FIRST image exactly the same: walls, furniture, floor, decor, the support itself, lighting and camera. Change nothing outside the grey ${s.face}.

Output: a single photorealistic image, same framing and aspect ratio as the FIRST image, high fidelity, ${s.negative}, no text added, no watermark.`
}

function parseImage(input: string): { mimeType: string; data: string } {
  const m = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/)
  if (m) return { mimeType: m[1], data: m[2] }
  return { mimeType: 'image/jpeg', data: input.includes(',') ? input.split(',')[1] : input }
}

/**
 * Insère l'oeuvre dans le cadre vide du décor via Nano Banana (Gemini image), 2 images en entrée.
 * Génératif (re-synthèse de la zone du cadre) : fidélité "commerciale + re-roll", pas pixel-perfect.
 * Retourne un data URI JPEG.
 */
export default class ArtworkInserter {
  // Clé Gemini DÉDIÉE (AI Studio), distincte de GOOGLE_API_KEY (projet sans l'API Gemini).
  // Lue via process.env pour ne pas dépendre de env.ts.
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  public async insert(
    decorInput: string,
    artworkInput: string,
    target: Target,
    opts: InsertOptions = {}
  ): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Insertion indisponible : clé Gemini (GEMINI_API_KEY) non configurée.')
    }
    const t = TARGET[target]
    if (!t) throw new Error(`Cible invalide: ${target}`)
    const model = opts.fidelity === 'high' ? PRO_MODEL : FLASH_MODEL
    // Le support dicte le prompt : un canvas est une toile NUE (pas de cadre), à préciser à l'insertion.
    const product: Product =
      opts.product === 'poster' ? 'poster' : opts.product === 'tapestry' ? 'tapestry' : 'canvas'
    const prompt = buildInsertionPrompt(product)

    const decor = parseImage(decorInput)
    const artwork = parseImage(artworkInput)

    const req: any = {
      model,
      contents: [
        { text: prompt },
        { inlineData: { mimeType: decor.mimeType, data: decor.data } }, // IMAGE 1 = décor (scène)
        { inlineData: { mimeType: artwork.mimeType, data: artwork.data } }, // IMAGE 2 = oeuvre
      ],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: t.ratio }, // camelCase ; verrouille le ratio = pas de reframing
      },
    }

    // Garde-fou timeout (le SDK peut ne pas en exposer) : on borne l'appel sous le TTL job (15 min).
    const rsp: any = await Promise.race([
      this.ai.models.generateContent(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini timeout')), 580000)),
    ])

    let outB64: string | null = null
    let outMime = 'image/png'
    const parts = rsp?.candidates?.[0]?.content?.parts || []
    for (const part of parts) {
      if (part?.inlineData?.data) {
        outB64 = part.inlineData.data
        outMime = part.inlineData.mimeType || outMime
        break
      }
    }
    if (!outB64) {
      // aucune image -> refus modération Google ou réponse vide
      throw new Error('Rendu vide ou refusé par la modération (réessaie ou change d’œuvre).')
    }

    Logger.info('insert OK model=%s product=%s mime=%s', model, product, outMime)
    const jpeg = await sharp(Buffer.from(outB64, 'base64'))
      .jpeg({ quality: 92, progressive: true, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  }
}
