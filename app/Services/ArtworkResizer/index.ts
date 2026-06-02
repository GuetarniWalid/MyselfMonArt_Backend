import Env from '@ioc:Adonis/Core/Env'
import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'

type Target = 'portrait' | 'square' | 'landscape'

// Ratio cible + taille exacte gpt-image-2 (multiples de 16, ratios exacts) par orientation.
const TARGET = {
  portrait: { size: '1152x1536', ratio: '3:4', orientation: 'portrait' },
  square: { size: '1024x1024', ratio: '1:1', orientation: 'square' },
  landscape: { size: '1536x1152', ratio: '4:3', orientation: 'landscape' },
} as const

// Prompt : recomposer l'oeuvre pour remplir le nouveau cadre bord à bord, SANS fond uni ni bandes,
// en gardant le style, la densité, la palette, les sujets (sans déformation) et les bordures.
function buildPrompt(ratio: string, orientation: string): string {
  return `Recompose this artwork to fully fit a ${ratio} ${orientation} frame. Do NOT add solid color fills, empty backgrounds, blank margins, letterbox bars, or borders to pad the image — instead, regenerate and extend the composition so the original artwork fills the entire new frame edge to edge, corner to corner.

Preserve faithfully:
- The EXACT artistic style, technique and medium of the original (if it is minimalist keep it minimalist with the same amount of empty space; if it is dense and busy keep it equally dense; if abstract stay abstract; if figurative stay figurative).
- The original color palette, lighting, contrast and overall mood — sample new areas from the same colors and textures.
- The main subjects at their original proportions: do NOT stretch, squash, skew or distort them. To fill new space, naturally add MORE of the same elements at the same scale and style rather than enlarging existing ones.
- The original fill density and spatial rhythm across the whole frame, so the new areas look as intentionally composed as the original.
- Any existing border, frame, mat or decorative edge: if the original has a border, keep a consistent border all the way around the new frame; if it has none, add none.

The result must look like the same artwork, simply composed for a ${ratio} ${orientation} canvas.`
}

export default class ArtworkResizer {
  private openai: OpenAI
  private model = Env.get('OPENAI_IMAGE_MODEL') || 'gpt-image-2'

  constructor() {
    this.openai = new OpenAI({ apiKey: Env.get('OPENAI_API_KEY') })
  }

  /**
   * Recompose une oeuvre (data URI ou base64) dans le ratio cible via gpt-image-2.
   * quality 'low' = aperçu rapide/pas cher ; 'high' = rendu final.
   * Retourne un data URI JPEG.
   */
  public async resize(
    imageInput: string,
    target: Target,
    quality: 'low' | 'high' = 'low'
  ): Promise<string> {
    const t = TARGET[target]
    if (!t) throw new Error(`Cible invalide: ${target}`)

    // 1) décoder l'entrée (data URI ou base64 brut) -> Buffer
    const base64 = imageInput.includes(',') ? imageInput.split(',')[1] : imageInput
    const srcBuf = Buffer.from(base64, 'base64')

    // 2) préparer l'image source : PNG, bord <= 1536 (contrainte taille input images.edit)
    const inputPng = await sharp(srcBuf)
      .resize(1536, 1536, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()

    // 3) appel gpt-image-2 (edits, sans masque -> recomposition globale).
    // Les params (model gpt-image-2, size 1152x1536, quality low/high) sont valides à l'exécution
    // mais pas encore reconnus par les types du SDK openai installé -> cast en any.
    const params: any = {
      model: this.model,
      image: await toFile(inputPng, 'artwork.png', { type: 'image/png' }),
      prompt: buildPrompt(t.ratio, t.orientation),
      size: t.size,
      quality,
    }
    const rsp = await this.openai.images.edit(params, { timeout: 580000 })

    const outB64 = rsp.data?.[0]?.b64_json
    if (!outB64) throw new Error('Réponse vide de gpt-image')

    // 4) re-encoder en JPEG (déjà au bon ratio, pas de recadrage) -> data URI
    const jpeg = await sharp(Buffer.from(outB64, 'base64'))
      .jpeg({ quality: 90, progressive: true, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  }
}
