import sharp from 'sharp'
import { GoogleGenAI } from '@google/genai'

type Target = 'portrait' | 'square' | 'landscape'
type Product = 'canvas' | 'poster' | 'tapestry'

export interface CleanOptions {
  product?: Product
}

const TARGET = {
  portrait: { ratio: '3:4', orientation: 'portrait' },
  square: { ratio: '1:1', orientation: 'square' },
  landscape: { ratio: '4:3', orientation: 'landscape' },
} as const

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image'
// 2K : le mockup nettoyé devient un TEMPLATE réutilisable (coût one-shot, ~$0.10) — on préserve
// au maximum la matière de la photo source, que l'insertion re-rendra ensuite.
const CLEAN_IMAGE_SIZE = '2K'

// ---- Prompt de nettoyage (12/06/2026, phase 2 de la migration NB2) ----
// Une photo de mise en situation importée (avec textes/logos superposés, voire une œuvre déjà
// dans le cadre) devient un décor VIDE conforme au contrat d'insertion : support unique converti
// au type produit choisi, face gris #ECECEC mat, ratio de l'œuvre en cours, photo carrée.
// NB : ne JAMAIS employer le mot « watermark » (les demandes de suppression contenant ce mot
// sont refusées par Google) — on décrit les marquages sans le mot.
function buildCleanPrompt(ratio: string, orientation: string, product: Product): string {
  const productNoun =
    product === 'poster' ? 'framed poster' : product === 'tapestry' ? 'tapestry' : 'canvas'
  const support =
    product === 'poster'
      ? 'a framed poster: a slim minimalist matte frame in warm oak or soft black, with the blank sheet filling the whole aperture edge-to-edge, NO mat, non-reflective matte, no glass glare (if the photo shows a frameless support, give it such a slim frame; if its frame is thick or ornate, replace it with this slim one)'
      : product === 'tapestry'
        ? 'a soft woven wall tapestry / textile panel hung flat from a slim wooden rod, no frame, no glass (convert any framed or rigid support in the photo into this hanging textile)'
        : 'a slim gallery-wrapped stretched canvas with clean wrapped side edges, a subtle shallow depth and a matte surface, NO surrounding picture frame (if the photo shows a framed support, REMOVE the frame entirely and rebuild the wall behind it)'

  return `You are renovating a real interior photograph so it can be reused as a clean, empty product-mockup scene.

The input photo shows an interior with a wall-mounted picture support (framed poster, framed print, stretched canvas or textile hanging) that may currently DISPLAY an artwork, photo or poster. The photo may also carry overlaid graphics: text, letters, numbers, logos, brand marks, signatures, stamps, website addresses or semi-transparent repeating overlay patterns.

Do exactly this, and nothing more:
1. REMOVE every overlaid graphic from the whole photo — all text, letters, numbers, logos, brand marks, stamps, signatures, website addresses and any semi-transparent repeating overlay pattern — and rebuild the surfaces underneath seamlessly.
2. EMPTY AND CONVERT the picture support: whatever it currently displays disappears, and the support becomes ${support}. Its face becomes ONE perfectly uniform, smooth, MATTE light-grey (#ECECEC) surface — evenly lit, completely shadow-free, nothing printed on it, no gradient, no glow, no reflection.
3. RESHAPE the support so it is unmistakably a ${orientation} rectangle of exactly ${ratio} proportions, hanging at the same spot on the same wall, at a natural generous size for that wall, with a calm margin of clear wall on all four sides — nothing overlapping it, and it never touches the photo edge. If several picture supports hang in the photo, keep ONLY the main one (the largest or most central) and remove the others completely, rebuilding the wall behind them.
4. KEEP EVERYTHING ELSE exactly as photographed: the room, walls, furniture, textiles, plants, props, floor, the camera angle and perspective, the natural light, shadows, colour grading and photographic grain. The real-world character of this photo is its whole value — do not restyle, redecorate, brighten or "improve" anything.
5. OUTPUT FRAMING: the final image is SQUARE (1:1). If the source is not square, naturally extend the scene at the edges (continue the walls, floor and furniture) rather than cropping away the room — keep the support fully visible with a clear margin all around.

Result: ONE photorealistic, clean, square interior photograph containing exactly one empty ${productNoun} with a uniform matte light-grey (#ECECEC) face, ready to receive an artwork. No text, no logos, no overlays anywhere in the image.`
}

/**
 * Nettoie une photo de mockup importée via Nano Banana 2 (édition image) :
 * marquages retirés, support vidé en gris #ECECEC, converti au type produit, reformé au ratio
 * de l'œuvre en cours, sortie CARRÉE 2K. Le résultat rejoint les décors IA (mêmes templates,
 * même insertion). Retourne un data URI JPEG.
 */
export default class MockupCleaner {
  // Clé Gemini DÉDIÉE (AI Studio), distincte de GOOGLE_API_KEY. Lue via process.env comme partout.
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  public async clean(imageInput: string, target: Target, opts: CleanOptions = {}): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Nettoyage indisponible : clé Gemini (GEMINI_API_KEY) non configurée.')
    }
    const t = TARGET[target]
    if (!t) throw new Error(`Cible invalide: ${target}`)
    const product: Product =
      opts.product === 'poster' ? 'poster' : opts.product === 'tapestry' ? 'tapestry' : 'canvas'

    // décoder l'entrée (data URI ou base64 brut) puis la borner (payload inline raisonnable)
    const base64 = imageInput.includes(',') ? imageInput.split(',')[1] : imageInput
    const inputJpeg = await sharp(Buffer.from(base64, 'base64'))
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer()

    const req: any = {
      model: IMAGE_MODEL,
      contents: [
        { text: buildCleanPrompt(t.ratio, t.orientation, product) },
        { inlineData: { mimeType: 'image/jpeg', data: inputJpeg.toString('base64') } },
      ],
      config: {
        responseModalities: ['IMAGE'],
        // sortie TOUJOURS carrée (règle métier des décors). imageSize : génération 3.x seulement.
        imageConfig: IMAGE_MODEL.startsWith('gemini-3')
          ? { aspectRatio: '1:1', imageSize: CLEAN_IMAGE_SIZE }
          : { aspectRatio: '1:1' },
      },
    }

    // Garde-fou timeout (le SDK peut ne pas en exposer) : on borne l'appel sous le TTL job (15 min).
    const rsp: any = await Promise.race([
      this.ai.models.generateContent(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini timeout')), 580000)),
    ])

    let outB64: string | null = null
    const parts = rsp?.candidates?.[0]?.content?.parts || []
    for (const part of parts) {
      if (part?.inlineData?.data) {
        outB64 = part.inlineData.data
        break
      }
    }
    if (!outB64) {
      throw new Error(
        'Nettoyage refusé par la modération ou réponse vide (réessaie ou change de photo).'
      )
    }

    const jpeg = await sharp(Buffer.from(outB64, 'base64'))
      .jpeg({ quality: 90, progressive: true, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  }
}
