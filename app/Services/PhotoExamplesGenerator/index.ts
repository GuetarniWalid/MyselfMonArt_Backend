import Logger from '@ioc:Adonis/Core/Logger'
import sharp from 'sharp'
import { GoogleGenAI } from '@google/genai'

/**
 * Génère la PAIRE d'exemples photo du studio personnalisé (« bonne photo » / « photo à
 * éviter ») À PARTIR DE L'ŒUVRE uploadée et des règles du juge photo (photoPolicy).
 *
 * Système en 2 étages, même architecture que le décor IA (DecorGenerator) :
 *   1. PHOTO-DIRECTOR (Gemini Flash, vision) : regarde l'ŒUVRE et en déduit QUI/QUOI doit
 *      figurer sur la photo client (ex. line-art famille -> « deux adultes et deux enfants » ;
 *      portrait d'animal -> « un golden retriever »). C'est ce qui rend le système SOUPLE :
 *      aucun style d'œuvre n'est présupposé.
 *   2. GÉNÉRATION ×2 (NB2) : la BONNE photo respecte exactement la policy (angle « parfait »,
 *      cadrage, nombre de personnes, lumière propre) ; la MAUVAISE viole précisément ce que la
 *      policy refuse (angle rejeté, cadrage coupé, lumière ratée) tout en restant une photo
 *      d'amateur plausible. Les contraintes viennent de la POLICY en CODE (déterministe),
 *      jamais devinées par le modèle — c'est ce qui rend le système SOLIDE.
 *
 * L'œuvre n'est PAS attachée à l'étage 2 : les exemples sont des PHOTOS réalistes, pas des
 * œuvres — attacher un line-art contaminerait le style. Seul le photo-director la voit.
 */

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image'
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash'
const EXAMPLE_IMAGE_SIZE = '1K' // vignettes d'exemple : 1K suffit largement

export interface PhotoExamplesPolicy {
  subject?: 'person' | 'group'
  framing?: 'face' | 'full-body'
  peopleMin?: number
  peopleMax?: number
  /** angle noté 🟢 (perfect) dans la grille — la consigne de la bonne photo */
  perfectAngle?: string
  /** angles notés 🔴 (reject) — la mauvaise photo en utilise un */
  rejectAngles?: string[]
}

const ANGLE_TEXT: Record<string, string> = {
  'back': 'seen from BEHIND — backs to the camera, faces not visible',
  'front': 'facing the camera directly, faces clearly visible',
  'three-quarter': 'in a three-quarter view, faces mostly visible',
  'profile': 'in strict profile view, seen from the side',
}
// Angle « opposé » : sert à fabriquer la violation quand la policy ne rejette rien explicitement.
const OPPOSITE_ANGLE: Record<string, string> = {
  'back': 'front',
  'front': 'back',
  'three-quarter': 'profile',
  'profile': 'front',
}

const PHOTO_DIRECTOR_INSTRUCTION = `You are a PHOTO CASTING DIRECTOR for a personalized-art e-commerce studio. Customers send ONE photo, and an artist redraws its subject(s) in the style of the ARTWORK you are shown. Your job: look at the ARTWORK image and write the CASTING BRIEF for a sample customer photo — WHO or WHAT should appear in it.

RULES:
- Derive the subject(s) ONLY from what the artwork depicts: how many people (adults/children, approximate ages), or the animal/object if it is not people. If the artwork shows a family of four, the brief says a family of four (two adults, two young children). A couple -> a couple. A dog portrait -> one dog.
- Describe subjects as REAL people/animals for a photograph: plain everyday clothing, natural builds. Invent plausible neutral details (never celebrity likenesses).
- Do NOT describe the artwork's STYLE (line-art, watercolor…), its text, or its layout — only the subjects to photograph.
- Do NOT describe pose, camera angle, framing or lighting — those are decided elsewhere.
- OUTPUT: 25-60 words, ONE sentence or two, English, no preamble, no lists, no quotes.`

export default class PhotoExamplesGenerator {
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  public async generate(
    artwork: string,
    policy: PhotoExamplesPolicy = {}
  ): Promise<{ good: string; bad: string }> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Génération indisponible : clé Gemini (GEMINI_API_KEY) non configurée.')
    }
    if (!artwork || artwork.length < 100) {
      throw new Error("Ajoute d'abord ton design (carte 1) : les exemples en dérivent.")
    }

    // 1) Casting : QUI doit figurer sur la photo (déduit de l'œuvre, tout style confondu)
    const casting = await this.photoDirect(artwork, policy)
    Logger.info('photo-examples casting: %s', casting.slice(0, 140))

    // 2) Bonne + mauvaise photo (en parallèle : 2 images 1K, ~10-20 s)
    const [good, bad] = await Promise.all([
      this.renderPhoto(buildGoodPrompt(casting, policy)),
      this.renderPhoto(buildBadPrompt(casting, policy)),
    ])
    return { good, bad }
  }

  /** Étage 1 : le photo-director regarde l'œuvre et écrit le casting de la photo client. */
  private async photoDirect(artwork: string, policy: PhotoExamplesPolicy): Promise<string> {
    const m = /^data:(.+?);base64,(.+)$/s.exec(artwork)
    const mimeType = m ? m[1] : 'image/jpeg'
    const data = m ? m[2] : artwork
    // Le nombre de personnes de la policy CADRE le casting (le juge photo l'imposera au client).
    const countHint =
      policy.subject === 'group'
        ? `The customer photo must contain between ${policy.peopleMin ?? 1} and ${policy.peopleMax ?? 6} people — if the artwork's count differs, stay within that range while matching the artwork's family structure.`
        : policy.subject === 'person'
          ? 'The customer photo must contain exactly ONE person (or one animal if the artwork depicts an animal).'
          : ''
    try {
      const config: any = {
        systemInstruction: PHOTO_DIRECTOR_INSTRUCTION,
        temperature: 0.7,
        maxOutputTokens: 160,
      }
      if (TEXT_MODEL.startsWith('gemini-2.5')) config.thinkingConfig = { thinkingBudget: 0 }
      const rsp: any = await Promise.race([
        this.ai.models.generateContent({
          model: TEXT_MODEL,
          contents: [
            { inlineData: { mimeType, data } },
            { text: `${countHint}\nWrite the casting brief.` },
          ],
          config,
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('photoDirect timeout')), 60000)),
      ])
      const txt = (typeof rsp?.text === 'string' ? rsp.text : '').trim()
      if (txt && txt.length >= 12) return txt.replace(/\s+/g, ' ').slice(0, 400)
    } catch (e) {
      Logger.warn('photo-examples photoDirect failed (fallback): %s', (e as any)?.message || e)
    }
    // Repli déterministe si le LLM échoue : casting générique cohérent avec la policy.
    return policy.subject === 'group'
      ? `A warm ordinary family of ${Math.min(4, policy.peopleMax ?? 4)} — two adults and their children — in plain everyday clothing.`
      : 'One ordinary person in plain everyday clothing.'
  }

  /** Étage 2 : rend UNE photo (verticale 3:4) et la renvoie en data URI JPEG. */
  private async renderPhoto(prompt: string): Promise<string> {
    const req: any = {
      model: IMAGE_MODEL,
      contents: [{ text: prompt }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: IMAGE_MODEL.startsWith('gemini-3')
          ? { aspectRatio: '3:4', imageSize: EXAMPLE_IMAGE_SIZE }
          : { aspectRatio: '3:4' },
      },
    }
    const rsp: any = await Promise.race([
      this.ai.models.generateContent(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini timeout')), 580000)),
    ])
    let outB64: string | null = null
    for (const part of rsp?.candidates?.[0]?.content?.parts || []) {
      if (part?.inlineData?.data) {
        outB64 = part.inlineData.data
        break
      }
    }
    if (!outB64) throw new Error('Rendu vide ou refusé par la modération (réessaie).')
    const jpeg = await sharp(Buffer.from(outB64, 'base64'))
      .jpeg({ quality: 88, progressive: true, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  }
}

// ---- Prompts : la POLICY décide (déterministe), le casting habille. --------------------

// Contraintes de la BONNE photo, dérivées de la policy en code.
function goodConstraints(policy: PhotoExamplesPolicy): string {
  const angle = ANGLE_TEXT[policy.perfectAngle || 'front'] || ANGLE_TEXT.front
  const framing =
    policy.framing === 'full-body'
      ? 'FULL-LENGTH framing: every subject entirely visible from head to feet, with comfortable margin above heads and below feet — nothing cropped.'
      : 'The face is the subject: a clear, generous head-and-shoulders framing, the face large, fully visible and in sharp focus.'
  return `${framing} The subjects are ${angle}. They stand naturally close together, softly connected (holding hands or side by side), calm and unposed.`
}

// Violations de la MAUVAISE photo : exactement ce que la policy refuse.
function badConstraints(policy: PhotoExamplesPolicy): string {
  const wrongAngleKey =
    (policy.rejectAngles && policy.rejectAngles[0]) ||
    OPPOSITE_ANGLE[policy.perfectAngle || 'front'] ||
    'front'
  const angle = ANGLE_TEXT[wrongAngleKey] || ANGLE_TEXT.front
  const framing =
    policy.framing === 'full-body'
      ? 'BADLY CROPPED: the framing cuts people off — legs and feet out of frame, one person half outside the edge; subjects at awkwardly different distances.'
      : 'The face is TINY and far away, partly turned or obstructed, hard to make out.'
  return `${framing} The subjects are ${angle}. The light is poor — dim, backlit or harsh mixed indoor light; the image is slightly blurry and tilted, with a cluttered distracting background.`
}

function buildGoodPrompt(casting: string, policy: PhotoExamplesPolicy): string {
  return `A candid amateur smartphone photograph, vertical 3:4 — the kind of photo a real customer would send to have their portrait drawn. It must be PERFECT for that purpose.

SUBJECTS: ${casting}

${goodConstraints(policy)}

SETTING & LIGHT: a simple, uncluttered outdoor spot (a park path, a beach at golden hour, a plain bright wall) in soft even daylight; gentle natural colours; every subject sharp and clearly separated from the calm background.

RENDERING: honest photorealism — a real snapshot, warm and likeable, natural skin and fabric texture, no filters, no studio look. Absolutely no text, watermark, frame or logo. Fictional everyday people only.`
}

function buildBadPrompt(casting: string, policy: PhotoExamplesPolicy): string {
  return `A candid amateur smartphone photograph, vertical 3:4 — a realistic example of a photo that is NOT usable for drawing a portrait. It must look like a genuine everyday snapshot gone wrong, instantly recognizable as unsuitable, yet completely plausible.

SUBJECTS: ${casting}

${badConstraints(policy)}

RENDERING: honest photorealism — a believable casual snapshot, just a poorly taken one. Not grotesque, not comedic, no exaggerated distortion. Absolutely no text, watermark, frame or logo. Fictional everyday people only.`
}
