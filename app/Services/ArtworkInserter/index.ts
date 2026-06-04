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

// Prompt d'insertion (recherche) : place l'oeuvre dans le cadre vide gris, fidèlement, sans toucher la pièce.
const INSERTION_PROMPT = `You are compositing two images. The FIRST image is an interior photograph that contains one empty picture frame with a flat light-grey (#ECECEC) canvas area. The SECOND image is an artwork.

Task: place the SECOND image (the artwork) so it fills EXACTLY the empty light-grey canvas inside the existing frame of the FIRST image, as if it were the real printed artwork mounted in that frame.

Hard rules:
- Keep the artwork 100% identical to the SECOND image: same colors, same patterns, same composition, same brush/print texture, and reproduce any text or signature exactly, character-for-character, with the same fonts and layout. Do NOT redraw, restyle, re-illustrate, crop, mirror, or re-interpret the artwork.
- Only fit the artwork to the grey canvas region. Match the canvas's perspective, scale and corners so the artwork sits flat inside the frame with correct foreshortening, edge to edge, with no leftover grey band.
- Adapt ONLY global lighting to the room: apply the same soft light direction, subtle shadows and reflections already present on the frame, so it looks naturally lit — without altering the artwork's own colors or content.
- Do NOT add a second frame, border, mat, passe-partout or extra molding. Reuse the frame that is ALREADY in the FIRST image. The artwork must stay strictly inside the existing grey area.
- Keep EVERYTHING ELSE in the FIRST image exactly the same: walls, furniture, floor, decor, the frame itself, lighting and camera. Change nothing outside the grey canvas.

Output: a single photorealistic image, same framing and aspect ratio as the FIRST image, high fidelity, no text added, no watermark.`

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

    const decor = parseImage(decorInput)
    const artwork = parseImage(artworkInput)

    const req: any = {
      model,
      contents: [
        { text: INSERTION_PROMPT },
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

    Logger.info('insert OK model=%s mime=%s', model, outMime)
    const jpeg = await sharp(Buffer.from(outB64, 'base64'))
      .jpeg({ quality: 92, progressive: true, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  }
}
