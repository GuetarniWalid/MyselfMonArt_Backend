import Env from '@ioc:Adonis/Core/Env'
import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'

type Target = 'portrait' | 'square' | 'landscape'
// recompose = recomposer l'original pour remplir le cadre (aperçu LOW) ;
// enhance = reproduire fidèlement l'aperçu LOW validé en haute qualité (HIGH).
export type ResizeMode = 'recompose' | 'enhance'

// Ratio cible + taille exacte gpt-image-2 (multiples de 16, ratios exacts) par orientation.
const TARGET = {
  portrait: { size: '1152x1536', ratio: '3:4', orientation: 'portrait' },
  square: { size: '1024x1024', ratio: '1:1', orientation: 'square' },
  landscape: { size: '1536x1152', ratio: '4:3', orientation: 'landscape' },
} as const

// Deux prompts selon le mode :
// - enhance : l'entrée est l'aperçu LOW DÉJÀ VALIDÉ -> on le re-rend à l'identique en HQ, SANS
//   recomposition ni retouche créative (corrige la dérive du HIGH qui repartait de l'original).
//   gpt-image reste génératif -> dérive résiduelle minime possible, mais plus de "retouche".
// - recompose : recomposer l'oeuvre pour remplir le cadre cible bord à bord (aperçu LOW).
//   Le prompt fait d'abord CLASSER l'oeuvre : (A) composition finie de sujets COMPTABLES
//   (ex. 3 bouches) -> on garde le nombre exact, on remplit en étendant le fond ; (B) motif
//   répété / texture all-over -> on prolonge le motif. Évite la multiplication des sujets
//   (bug "3 bouches -> 11 bouches") sans casser le cas des vrais motifs.
function buildPrompt(ratio: string, orientation: string, mode: ResizeMode = 'recompose'): string {
  if (mode === 'enhance') {
    return `The input image is the FINAL, APPROVED artwork. Reproduce it EXACTLY — an upscale, never an edit. Output the same image, only re-rendered at higher quality.

You are a fidelity-preserving restorer/upscaler, not an image generator. Do NOT reinterpret, repaint, redraw, restyle, recompose, embellish, "improve", "clean up", complete, or beautify anything. Do NOT add, remove, move, resize, duplicate, or reposition any element, subject, object, shape, line, pattern, or text. Do NOT crop, zoom, pan, rotate, flip, extend, outpaint, or re-frame. Keep the composition, framing, layout, perspective, proportions, edges, and margins identical, with the same ${ratio} ${orientation} aspect ratio (no involuntary crop or zoom). Keep every color, hue, saturation, brightness, contrast, gradient, tone, and lighting exactly as in the input. Preserve all subjects, contours, brushstrokes, textures, grain, and any text or logos character-for-character. Treat every pixel's position and color as fixed.

The ONLY allowed change is rendering quality: sharpen existing edges, recover crisp micro-detail already implied by the input, smooth gradients, and reduce noise, banding, and compression artifacts — without inventing any new content. If any region is ambiguous, copy the input faithfully rather than guessing. The result must be indistinguishable from the input in content, geometry, and palette — a cleaner, higher-resolution version of the SAME image, never regenerated or reinterpreted.`
  }
  return `Recompose this artwork to fully fit a ${ratio} ${orientation} frame. Do NOT add solid color fills, empty backgrounds, blank margins, letterbox bars, borders, or sparse empty edges to pad the image — instead, regenerate and extend the composition so the original artwork itself fills the entire new frame edge to edge, corner to corner. This is a faithful recomposition, NOT a redesign or a cleanup.

THE ONE INVIOLABLE RULE — SUBJECT COUNT. Before doing anything else, look at the image and decide which kind of artwork this is:
(A) A FINITE COMPOSITION of distinct, COUNTABLE primary subjects — things you could point at and count, like exactly three lipstick-kiss mouths, two figures, one vase, a row of four birds. The exact number is part of the artwork's identity.
(B) An UNCOUNTABLE ALL-OVER PATTERN, texture or field — a repeating or scattered motif so dense or regular that no one counts the individual elements (for example dozens of small dots, a speckled abstract field, a seamless tiling). Losing or gaining a few elements would not change the work's identity.
Heuristic: a few large, distinct, recognizable subjects = (A); many small, similar, interchangeable units = (B). If you are even slightly unsure, treat the work as (A) and preserve the count.

If the artwork is type (A): the output MUST contain EXACTLY the same number of primary subjects as the input — not one more, not one fewer. If the input has 3 mouths, the output has EXACTLY 3 mouths. Adding even a single extra subject — cloning, duplicating, repeating, mirroring, scattering, tiling, or turning a small countable set into a grid — is a FAILURE that destroys the artwork. You fill the new frame ONLY by extending the surrounding background, ground and negative space outward, and by gently re-balancing, re-centering and re-spacing the EXISTING subjects so they sit naturally in the new proportions at their original size. Never duplicate a subject to fill space, and never stretch, squash, skew, enlarge or distort the existing subjects to cover it.

If — and ONLY if — the artwork is genuinely type (B): you SHOULD fill the new areas by continuing the same repeating motif outward at the SAME scale, density and spacing as the original, adding more repeats so the field reads as one continuous pattern all the way to the edges. Do not pack it tighter and do not thin it out; match the original rhythm exactly. Here the repeats ARE the ground, so extending them IS extending the background.

Treat the artwork as two layers and rebuild BOTH across the whole new frame:
- FOREGROUND: the discrete elements, shapes, motifs, marks and main subjects (governed by the count rule above).
- BACKGROUND: the color, texture and field behind and BETWEEN those elements — including any color that is only glimpsed in the gaps, interstices and negative space (for example a faint turquoise ground showing only between many small dots, or a dark textured canvas behind a few mouths). This background is an intentional part of the artwork and part of its palette, never empty space to be filled with extra subjects; in type (A) it is your primary tool for filling new area.

Preserve faithfully:
- The EXACT artistic style, technique and medium of the original (if minimalist keep it minimalist with the same amount of empty space; if dense and busy keep it equally dense; if abstract stay abstract; if figurative stay figurative).
- The COMPLETE original color palette — every hue present in the source, with NO exceptions. This explicitly includes background, base and underlying tones, and any color that is low-saturation, low-contrast, occupies only a small fraction of the surface, or appears only in the gaps between elements. Do NOT simplify, clean up, flatten, unify, neutralize, mute, brighten, darken or harmonize the palette; do NOT drop, merge, recolor or replace any color, and do NOT let a faint color be absorbed or crowded out by a more dominant neighbor. Keep every hue in the same role (foreground vs background), saturation and proportion.
- The figure/ground relationship: the SAME background color and texture must show through around and between the subjects at the SAME visibility as in the original, so the contrast the artwork relies on is reproduced everywhere — in the original AND the newly generated regions.
- The original lighting, contrast and overall mood, without flattening, averaging or boosting them.
- The main subjects at their original proportions: do NOT stretch, squash, skew, distort, enlarge or shrink them, and do NOT let either layer take over.

Fill density depends on the category, so apply it per case:
- In type (A): fill new space by extending the ground and re-balancing placement only. Do NOT raise the apparent density by multiplying, cloning, scattering or sprinkling in extra subjects, and do NOT pack the existing subjects tighter to cover the background. The added room is atmospheric ground consistent with the original, not new subjects.
- In type (B): keep the same fill density and spatial rhythm as the original across the whole frame, so the newly generated areas look as intentionally composed as the original field. Do NOT pack the pattern tighter and do NOT leave it sparse.

Any existing border, frame, mat or decorative edge: if the original has a border, keep a consistent border all the way around the new frame; if it has none, add none.

When generating new areas, sample directly from the original and reproduce the SAME background/interstitial color and texture — and, in type (B) only, reproduce the SAME repeating motif on top of that ground. Never place the motif on a different or simplified ground, and never show the ground without the texture it had in the original.

The result must look like the SAME artwork — the same subjects in the same number, every subtle color, fine detail and background tone intact — simply composed for a ${ratio} ${orientation} canvas.`
}

export default class ArtworkResizer {
  private openai: OpenAI
  private model = Env.get('OPENAI_IMAGE_MODEL') || 'gpt-image-2'

  constructor() {
    this.openai = new OpenAI({ apiKey: Env.get('OPENAI_API_KEY') })
  }

  /**
   * Retaille une oeuvre (data URI ou base64) dans le ratio cible via gpt-image-2.
   * - mode 'recompose' (défaut) : recompose l'ORIGINAL pour remplir le cadre cible (aperçu LOW).
   * - mode 'enhance' : l'entrée est l'aperçu LOW DÉJÀ VALIDÉ ; on le re-rend à l'identique en
   *   haute qualité (prompt de reproduction fidèle) -> le HIGH = le LOW validé, pas une nouvelle image.
   * quality 'low' = aperçu rapide/pas cher ; 'high' = rendu final.
   * Retourne un data URI JPEG.
   */
  public async resize(
    imageInput: string,
    target: Target,
    quality: 'low' | 'high' = 'low',
    mode: ResizeMode = 'recompose'
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

    // 3) appel gpt-image-2 (edits, sans masque). Le prompt dépend du mode :
    //    recompose -> remplit le cadre ; enhance -> reproduit fidèlement l'aperçu LOW validé en HQ.
    // Les params (model gpt-image-2, size 1152x1536, quality low/high) sont valides à l'exécution
    // mais pas encore reconnus par les types du SDK openai installé -> cast en any.
    // NB: input_fidelity (gpt-image-1/1.5) n'est PAS envoyé : gpt-image-2 est déjà haute fidélité
    // et rejette ce paramètre. L'ancrage = passer l'aperçu validé en entrée (côté appelant).
    const params: any = {
      model: this.model,
      image: await toFile(inputPng, 'artwork.png', { type: 'image/png' }),
      prompt: buildPrompt(t.ratio, t.orientation, mode),
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
