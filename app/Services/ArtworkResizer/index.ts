import sharp from 'sharp'
import { GoogleGenAI } from '@google/genai'

type Target = 'portrait' | 'square' | 'landscape'
// recompose = recomposer l'original pour remplir le cadre (aperçu LOW) ;
// enhance = reproduire fidèlement l'aperçu LOW validé en haute qualité (HIGH).
export type ResizeMode = 'recompose' | 'enhance'

// Ratio cible NATIF par orientation. Migration NB2 (12/06/2026) : fini les tailles fixes gpt-image
// approchantes — gemini-3.1-flash-image sort directement en 3:4 / 1:1 / 4:3, les vrais ratios produit.
const TARGET = {
  portrait: { ratio: '3:4', orientation: 'portrait' },
  square: { ratio: '1:1', orientation: 'square' },
  landscape: { ratio: '4:3', orientation: 'landscape' },
} as const

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image'
// quality 'low' (aperçu rapide) -> 1K ; 'high' (rendu final) -> 2K.
// Décision 12/06 : pas de 4K — l'image retaillée est une image écran, pas un fichier d'impression.
const SIZE_BY_QUALITY = { low: '1K', high: '2K' } as const

// Deux prompts selon le mode (contenu INCHANGÉ à la migration NB2 : ces règles — comptage des
// sujets, échelle relative au cadre, palette complète — sont des règles métier durement acquises,
// indépendantes du moteur ; à n'ajuster qu'après jugement visuel) :
// - enhance : l'entrée est l'aperçu LOW DÉJÀ VALIDÉ -> on le re-rend à l'identique en HQ, SANS
//   recomposition ni retouche créative (corrige la dérive du HIGH qui repartait de l'original).
//   Le modèle reste génératif -> dérive résiduelle minime possible, mais plus de "retouche".
// - recompose : recomposer l'oeuvre pour remplir le cadre cible bord à bord (aperçu LOW).
//   Le prompt fait d'abord CLASSER l'oeuvre : (A) composition finie de sujets COMPTABLES
//   (ex. 3 bouches) -> on garde le nombre exact, on remplit en étendant le fond ; (B) motif
//   répété / texture all-over -> on prolonge le motif. Évite la multiplication des sujets
//   (bug "3 bouches -> 11 bouches") sans casser le cas des vrais motifs.
//   2e règle : conserver l'ÉCHELLE des sujets RELATIVE au cadre (part de la largeur/hauteur
//   occupée) -> on redimensionne les sujets existants UNIFORMÉMENT (jamais déformer, jamais
//   rogner, jamais rapetisser) pour garder leur prestance d'origine, au lieu de les laisser
//   petits avec du fond en plus sur les côtés.
function buildPrompt(ratio: string, orientation: string, mode: ResizeMode = 'recompose'): string {
  if (mode === 'enhance') {
    return `The input image is the FINAL, APPROVED artwork. Reproduce it EXACTLY — an upscale, never an edit. Output the same image, only re-rendered at higher quality.

You are a fidelity-preserving restorer/upscaler, not an image generator. Do NOT reinterpret, repaint, redraw, restyle, recompose, embellish, "improve", "clean up", complete, or beautify anything. Do NOT add, remove, move, resize, duplicate, or reposition any element, subject, object, shape, line, pattern, or text. Do NOT crop, zoom, pan, rotate, flip, extend, outpaint, or re-frame. Keep the composition, framing, layout, perspective, proportions, edges, and margins identical, with the same ${ratio} ${orientation} aspect ratio (no involuntary crop or zoom). Keep every color, hue, saturation, brightness, contrast, gradient, tone, and lighting exactly as in the input. Preserve all subjects, contours, brushstrokes, textures, grain, and any text or logos character-for-character. Treat every pixel's position and color as fixed.

The ONLY allowed change is rendering quality: sharpen existing edges, recover crisp micro-detail already implied by the input, smooth gradients, and reduce noise, banding, and compression artifacts — without inventing any new content. If any region is ambiguous, copy the input faithfully rather than guessing. The result must be indistinguishable from the input in content, geometry, and palette — a cleaner, higher-resolution version of the SAME image, never regenerated or reinterpreted.`
  }
  return `Recompose this artwork to fully fit a ${ratio} ${orientation} frame. Do NOT add solid color fills, empty backgrounds, blank margins, letterbox bars, borders, or sparse empty edges to pad the image — instead, regenerate and extend the composition so the original artwork itself fills the entire new frame edge to edge, corner to corner. This is a faithful recomposition, NOT a redesign or a cleanup.

THE FIRST INVIOLABLE RULE — SUBJECT COUNT. Before doing anything else, look at the image and decide which kind of artwork this is:
(A) A FINITE COMPOSITION of distinct, COUNTABLE primary subjects — things you could point at and count, like exactly three lipstick-kiss mouths, two figures, one vase, a row of four birds. The exact number is part of the artwork's identity.
(B) An UNCOUNTABLE ALL-OVER PATTERN, texture or field — a repeating or scattered motif so dense or regular that no one counts the individual elements (for example dozens of small dots, a speckled abstract field, a seamless tiling). Losing or gaining a few elements would not change the work's identity.
Heuristic: a few large, distinct, recognizable subjects = (A); many small, similar, interchangeable units = (B). If you are even slightly unsure, treat the work as (A) and preserve the count.

If the artwork is type (A): the output MUST contain EXACTLY the same number of primary subjects as the input — not one more, not one fewer. If the input has 3 mouths, the output has EXACTLY 3 mouths. Adding even a single extra subject — cloning, duplicating, repeating, mirroring, scattering, tiling, or turning a small countable set into a grid — is a FAILURE that destroys the artwork. You change the size of the subjects ONLY by resizing the EXISTING ones together by the same single factor (see the SECOND INVIOLABLE RULE below), NEVER by adding more of them; and you fill any remaining new area ONLY by extending the surrounding background, ground and negative space outward, and by gently re-balancing, re-centering and re-spacing the existing subjects so they sit naturally in the new proportions. Never duplicate a subject to fill space, and never stretch, squash, skew or warp the existing subjects to cover it.

THE SECOND INVIOLABLE RULE — SUBJECT SCALE / FRAMING TIGHTNESS. The size of the primary subjects RELATIVE TO THE FRAME — how large a share of the canvas they command, how close they come to the edges, the ratio of subject-area to surrounding negative space — is itself part of the artwork's identity and must be reproduced. Measure how much of the frame each subject commands in the original and reproduce that command in the result: if the lips span about 90% of the width in the source, they must span about 90% of the width in the result; if a figure fills most of the height, it must still fill most of the height. Do NOT hold the subjects at their old absolute pixel size while padding the new space with extra ground — that shrinks their share of the frame and is a FAILURE that drains the artwork of its boldness. Because the frame's aspect ratio is changing, holding this footprint REQUIRES scaling the existing subjects UNIFORMLY (resizing them larger or smaller by the SAME factor in width and height together) until they reclaim their original dominance in the new frame. This uniform resize is REQUIRED, not forbidden.

How to scale without breaking anything (all three are mandatory):
- UNIFORM ONLY: apply the exact same scale factor to width and height. The subject's OWN shape and width-to-height aspect (its "original proportions") are sacred and must NEVER be stretched, squashed, skewed, warped or otherwise distorted. "Original proportions" refers ONLY to each subject's own internal shape; it does NOT mean the subject's absolute size, which you SHOULD change so that its share of the frame is preserved.
- NEVER CROP: do not scale so large that any subject is cut off, clipped or amputated by the frame edge. Every primary subject stays FULLY visible inside the frame, complete and uncut, with its natural breathing room. If reaching full edge-to-edge coverage would push a subject off the edge, pull the scale back just enough that it stays whole, then fill any residual room with extending ground rather than by cutting the subject.
- NEVER SHRINK BELOW THE ORIGINAL: the subjects must end up just as large and dominant relative to the canvas as in the original — never smaller, never less bold.

Reconciling the two rules when the target ratio differs from the source: you cannot keep the subject's exact fractional coverage in BOTH width AND height at once without either distorting it or cutting it off, so resolve it this way — preserve the subject's PROMINENCE by matching its coverage along its SIGNATURE / DOMINANT dimension (for wide lips that is the WIDTH: scale so the lips again span nearly the full width; for a tall figure, the height), scale uniformly to hit that, and let ONLY the dimension that gained relative room show a little more of the same background, with slightly larger margins there. The signature-dimension margin is matched tightly; only the gained axis is allowed mild extra breathing room. The subjects must NEVER end up smaller or less dominant than in the original; a touch of extra breathing room in one axis is fine, shrinking the subjects below their original share is not.

If — and ONLY if — the artwork is genuinely type (B): you SHOULD fill the new areas by continuing the same repeating motif outward at the SAME scale, density and spacing as the original, adding more repeats so the field reads as one continuous pattern all the way to the edges. Do not pack it tighter and do not thin it out; match the original rhythm exactly. Here the repeats ARE the ground, so extending them IS extending the background. (The relative-scale rule for the motif and the SECOND INVIOLABLE RULE say the same thing in different words: in both cases the elements keep the SAME share of the canvas as in the original. In type (B) the motif keeps its original element size and spacing, so the scale rule is already satisfied by matching that rhythm — do NOT enlarge the individual pattern units.)

Treat the artwork as two layers and rebuild BOTH across the whole new frame:
- FOREGROUND: the discrete elements, shapes, motifs, marks and main subjects (governed by the count and scale rules above).
- BACKGROUND: the color, texture and field behind and BETWEEN those elements — including any color that is only glimpsed in the gaps, interstices and negative space (for example a faint turquoise ground showing only between many small dots, or a dark textured canvas behind a few mouths). This background is an intentional part of the artwork and part of its palette, never empty space to be filled with extra subjects; in type (A) it is what fills only the room that remains AFTER the subjects have been scaled up to their original dominance.

Preserve faithfully:
- The EXACT artistic style, technique and medium of the original (if minimalist keep it minimalist with the same amount of empty space; if dense and busy keep it equally dense; if abstract stay abstract; if figurative stay figurative).
- The COMPLETE original color palette — every hue present in the source, with NO exceptions. This explicitly includes background, base and underlying tones, and any color that is low-saturation, low-contrast, occupies only a small fraction of the surface, or appears only in the gaps between elements. Do NOT simplify, clean up, flatten, unify, neutralize, mute, brighten, darken or harmonize the palette; do NOT drop, merge, recolor or replace any color, and do NOT let a faint color be absorbed or crowded out by a more dominant neighbor. Keep every hue in the same role (foreground vs background), saturation and proportion.
- The figure/ground relationship: the SAME background color and texture must show through around and between the subjects at the SAME visibility as in the original, so the contrast the artwork relies on is reproduced everywhere — in the original AND the newly generated regions.
- The original lighting, contrast and overall mood, without flattening, averaging or boosting them.
- The main subjects' own shape and internal proportions: do NOT stretch, squash, skew, distort or warp them, and do NOT let either layer take over. Their absolute size, by contrast, must be scaled uniformly as described above so they keep the same dominant share of the frame as in the original — keep them as bold and large-relative-to-the-canvas as the source, never shrunken.

Fill density depends on the category, so apply it per case:
- In type (A): first scale the existing subjects uniformly so they reclaim their original share of the frame, then fill ONLY the remaining room (on the axis that gained relative space) by extending the ground and re-balancing placement. Do NOT raise the apparent density by multiplying, cloning, scattering or sprinkling in extra subjects, and do NOT pack the existing subjects tighter to cover the background. The added room is atmospheric ground consistent with the original, not new subjects.
- In type (B): keep the same fill density and spatial rhythm as the original across the whole frame, so the newly generated areas look as intentionally composed as the original field. Do NOT pack the pattern tighter and do NOT leave it sparse.

Any existing border, frame, mat or decorative edge: if the original has a border, keep a consistent border all the way around the new frame; if it has none, add none.

When generating new areas, sample directly from the original and reproduce the SAME background/interstitial color and texture — and, in type (B) only, reproduce the SAME repeating motif on top of that ground. Never place the motif on a different or simplified ground, and never show the ground without the texture it had in the original.

The result must look like the SAME artwork — the same subjects in the same number, each as large and dominant within the frame as in the original and never shrunken, every subtle color, fine detail and background tone intact — simply composed for a ${ratio} ${orientation} canvas.`
}

export default class ArtworkResizer {
  // Clé Gemini DÉDIÉE (AI Studio), distincte de GOOGLE_API_KEY. Lue via process.env comme partout.
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  /**
   * Retaille une oeuvre (data URI ou base64) dans le ratio cible via Nano Banana 2 (édition image).
   * - mode 'recompose' (défaut) : recompose l'ORIGINAL pour remplir le cadre cible (aperçu LOW).
   * - mode 'enhance' : l'entrée est l'aperçu LOW DÉJÀ VALIDÉ ; on le re-rend à l'identique en
   *   haute qualité (prompt de reproduction fidèle) -> le HIGH = le LOW validé, pas une nouvelle image.
   * quality 'low' = aperçu rapide/pas cher (1K) ; 'high' = rendu final (2K).
   * Retourne un data URI JPEG.
   */
  public async resize(
    imageInput: string,
    target: Target,
    quality: 'low' | 'high' = 'low',
    mode: ResizeMode = 'recompose'
  ): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Retaillage indisponible : clé Gemini (GEMINI_API_KEY) non configurée.')
    }
    const t = TARGET[target]
    if (!t) throw new Error(`Cible invalide: ${target}`)

    // 1) décoder l'entrée (data URI ou base64 brut) -> Buffer
    const base64 = imageInput.includes(',') ? imageInput.split(',')[1] : imageInput
    const srcBuf = Buffer.from(base64, 'base64')

    // 2) préparer l'image source : JPEG qualité 95, bord <= 2048 (payload inline raisonnable,
    //    largement assez fin pour conditionner le modèle)
    const inputJpeg = await sharp(srcBuf)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer()

    // 3) appel NB2 (édition : prompt + image). Le prompt dépend du mode :
    //    recompose -> remplit le cadre ; enhance -> reproduit fidèlement l'aperçu LOW validé en HQ.
    //    Le ratio de sortie est NATIF (imageConfig.aspectRatio) — le prompt n'a plus à le porter seul.
    const req: any = {
      model: IMAGE_MODEL,
      contents: [
        { text: buildPrompt(t.ratio, t.orientation, mode) },
        { inlineData: { mimeType: 'image/jpeg', data: inputJpeg.toString('base64') } },
      ],
      config: {
        responseModalities: ['IMAGE'],
        // imageSize : seulement sur la génération 3.x (un override env vers 2.5 resterait valide).
        imageConfig: IMAGE_MODEL.startsWith('gemini-3')
          ? { aspectRatio: t.ratio, imageSize: SIZE_BY_QUALITY[quality] }
          : { aspectRatio: t.ratio },
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
      // aucune image -> refus modération Google ou réponse vide
      throw new Error('Rendu vide ou refusé par la modération (réessaie ou change d’œuvre).')
    }

    // 4) re-encoder en JPEG (déjà au bon ratio, pas de recadrage) -> data URI
    const jpeg = await sharp(Buffer.from(outB64, 'base64'))
      .jpeg({ quality: 90, progressive: true, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  }
}
