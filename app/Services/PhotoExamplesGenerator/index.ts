import Logger from '@ioc:Adonis/Core/Logger'
import sharp from 'sharp'
import { GoogleGenAI } from '@google/genai'
import { noThinking, THINKING_HEADROOM_TOKENS } from 'App/Services/Gemini/thinking'

/**
 * Génère UN exemple photo du studio personnalisé (« bonne photo » OU « photo à éviter »)
 * À PARTIR DE L'ŒUVRE uploadée, des règles du juge photo (photoPolicy) et, si fournie,
 * d'une CONSIGNE courte de Walid (« famille de 4, jambes coupées ») réécrite par IA.
 *
 * Système en 2 étages, même architecture que le décor IA (DecorGenerator) :
 *   1a. SANS consigne — PHOTO-DIRECTOR (Gemini Flash, vision) : regarde l'ŒUVRE et en déduit
 *       QUI/QUOI doit figurer sur la photo client (line-art famille -> « deux adultes et deux
 *       enfants » ; portrait d'animal -> « un golden retriever »). Les contraintes (angle,
 *       cadrage, lumière) viennent de la POLICY en CODE (déterministe) : souple ET solide.
 *   1b. AVEC consigne — INTENT-REWRITER (Gemini Flash, vision) : réécrit la consigne courte
 *       en brief photographique complet (même principe que « salon marocain » -> décor
 *       détaillé). La consigne PRIME sur les défauts de la policy ; ce qu'elle ne dit pas
 *       retombe sur la policy. Repli : si le rewriter échoue, on retombe sur 1a.
 *   2. GÉNÉRATION (NB2) : une seule image 1K, 3:4.
 *
 * L'œuvre n'est PAS attachée à l'étage 2 : les exemples sont des PHOTOS réalistes, pas des
 * œuvres — attacher un line-art contaminerait le style. Seuls les étages 1 la voient.
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
  /**
   * Animaux de compagnie DESSINÉS sur l'œuvre (« chien », « chat »), vus par le studio-director.
   * Sans eux, l'exemple montrait la personne seule : le casting est déduit par un LLM qui les
   * oubliait, alors que l'acheteur doit comprendre qu'il faut venir AVEC son animal.
   */
  companions?: string[]
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
- Derive the subject(s) ONLY from what the artwork depicts: how many people (adults/children, approximate ages) AND every companion animal shown WITH them. A family of four -> a family of four (two adults, two young children). A couple -> a couple. A dog portrait -> one dog. A woman drawn with her dog -> ONE woman AND her dog, both in the photo — an animal in the artwork is never optional and never replaces the person.
- Describe subjects as REAL people/animals for a photograph: plain everyday clothing, natural builds. Invent plausible neutral details (never celebrity likenesses).
- Do NOT describe the artwork's STYLE (line-art, watercolor…), its text, or its layout — only the subjects to photograph.
- Do NOT describe pose, camera angle, framing or lighting — those are decided elsewhere.
- OUTPUT: 25-60 words, ONE sentence or two, English, no preamble, no lists, no quotes.`

export type ExampleKind = 'good' | 'bad'

const INTENT_REWRITER_INSTRUCTION = `You are a PHOTO ART DIRECTOR for a personalized-art e-commerce studio. Customers send ONE photo and an artist redraws its subjects in the style of the ARTWORK you are shown. The studio displays sample photos: a GOOD example (perfectly usable for the drawing) or a BAD example (a plausible customer photo that is NOT usable).

You are given the ARTWORK (image), the DEFAULT RULES of this product's photo policy, and the OWNER'S WISH — a terse instruction (usually French) describing what he wants on THIS sample photo.

Write the complete PHOTO BRIEF for the requested sample: subjects (who/what, how many — derived from the artwork unless the wish says otherwise), camera angle, framing, setting, light and overall mood.

RULES:
- The OWNER'S WISH is AUTHORITATIVE: where it contradicts the default rules, the wish wins. Expand its terse words into concrete photographic language (e.g. « jambes coupées » -> the framing cuts everyone off below the knees; « noir et blanc » -> a black-and-white photograph).
- Everything the wish does NOT specify falls back to the DEFAULT RULES given.
- GOOD sample: the photo must stay PERFECT for the drawing — sharp, well lit, subjects clearly readable.
- BAD sample: a genuine everyday snapshot gone wrong — plausible, never grotesque or comedic.
- Subjects are fictional everyday people (never celebrity likenesses), described as real people for a photograph — never in the artwork's style.
- OUTPUT: 50-110 words, ONE flowing paragraph, English, no preamble, no lists, no quotes.`

export default class PhotoExamplesGenerator {
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  /** Génère UN exemple (bonne OU mauvaise photo), avec consigne optionnelle de Walid. */
  public async generateOne(
    artwork: string,
    kind: ExampleKind,
    policy: PhotoExamplesPolicy = {},
    intent?: string
  ): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Génération indisponible : clé Gemini (GEMINI_API_KEY) non configurée.')
    }
    if (!artwork || artwork.length < 100) {
      throw new Error("Ajoute d'abord ton design (carte 1) : les exemples en dérivent.")
    }

    const wish = (intent || '').replace(/\s+/g, ' ').trim().slice(0, 300)
    if (wish) {
      // 1b) Consigne courte -> brief photographique complet (la consigne PRIME sur la policy)
      const brief = await this.rewriteIntent(artwork, kind, policy, wish)
      if (brief) {
        Logger.info('photo-example %s brief(intent): %s', kind, brief.slice(0, 140))
        return await this.renderPhoto(wrapBriefPrompt(kind, brief))
      }
      Logger.warn('photo-example %s: rewriter muet — repli sur le chemin policy', kind)
    }

    // 1a) Chemin déterministe : casting déduit de l'œuvre + contraintes de la policy en code
    const casting = await this.photoDirect(artwork, policy)
    Logger.info('photo-example %s casting: %s', kind, casting.slice(0, 140))
    return await this.renderPhoto(
      kind === 'good' ? buildGoodPrompt(casting, policy) : buildBadPrompt(casting, policy)
    )
  }

  /** Étage 1b : réécrit la consigne courte de Walid en brief photo complet (vision sur l'œuvre). */
  private async rewriteIntent(
    artwork: string,
    kind: ExampleKind,
    policy: PhotoExamplesPolicy,
    wish: string
  ): Promise<string | null> {
    const m = /^data:(.+?);base64,(.+)$/s.exec(artwork)
    const mimeType = m ? m[1] : 'image/jpeg'
    const data = m ? m[2] : artwork
    // Défauts de la policy : le rewriter ne les devine pas, il les reçoit (la consigne prime).
    const defaults = kind === 'good' ? goodConstraints(policy) : badConstraints(policy)
    try {
      const config: any = {
        systemInstruction: INTENT_REWRITER_INSTRUCTION,
        temperature: 0.6,
        maxOutputTokens: 220 + THINKING_HEADROOM_TOKENS,
      }
      config.thinkingConfig = noThinking(TEXT_MODEL)
      const rsp: any = await Promise.race([
        this.ai.models.generateContent({
          model: TEXT_MODEL,
          contents: [
            { inlineData: { mimeType, data } },
            {
              text: `SAMPLE REQUESTED: the ${kind === 'good' ? 'GOOD (usable)' : 'BAD (unusable)'} example.\nDEFAULT RULES: ${defaults}\nOWNER'S WISH: ${wish}\nWrite the photo brief.`,
            },
          ],
          config,
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('rewriteIntent timeout')), 60000)),
      ])
      const txt = (typeof rsp?.text === 'string' ? rsp.text : '').trim()
      if (txt && txt.length >= 20) return txt.replace(/\s+/g, ' ').slice(0, 900)
    } catch (e) {
      Logger.warn('photo-example rewriteIntent failed (repli policy): %s', (e as any)?.message || e)
    }
    return null
  }

  /** Étage 1 : le photo-director regarde l'œuvre et écrit le casting de la photo client. */
  private async photoDirect(artwork: string, policy: PhotoExamplesPolicy): Promise<string> {
    const m = /^data:(.+?);base64,(.+)$/s.exec(artwork)
    const mimeType = m ? m[1] : 'image/jpeg'
    const data = m ? m[2] : artwork
    // Le nombre de personnes de la policy CADRE le casting (le juge photo l'imposera au client).
    // Les animaux ne sont JAMAIS comptés comme des personnes (le juge du studio non plus) : sans
    // cette précision, « exactement UNE personne » faisait disparaître le chien de l'œuvre.
    const countHint =
      policy.subject === 'group'
        ? `The customer photo must contain between ${policy.peopleMin ?? 1} and ${policy.peopleMax ?? 6} PEOPLE — if the artwork's count differs, stay within that range while matching the artwork's family structure.`
        : policy.subject === 'person'
          ? 'The customer photo must contain exactly ONE PERSON.'
          : ''
    const companionHint = companionsText(policy)
      ? ` Companion animals are NOT counted as people: this artwork shows ${companionsText(
          policy
        )}, so the photo must show the person WITH that animal.`
      : ''
    try {
      const config: any = {
        systemInstruction: PHOTO_DIRECTOR_INSTRUCTION,
        temperature: 0.7,
        maxOutputTokens: 160 + THINKING_HEADROOM_TOKENS,
      }
      config.thinkingConfig = noThinking(TEXT_MODEL)
      const rsp: any = await Promise.race([
        this.ai.models.generateContent({
          model: TEXT_MODEL,
          contents: [
            { inlineData: { mimeType, data } },
            { text: `${countHint}${companionHint}\nWrite the casting brief.` },
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
    const withAnimal = companionsText(policy) ? `, together with ${companionsText(policy)}` : ''
    return policy.subject === 'group'
      ? `A warm ordinary family of ${Math.min(4, policy.peopleMax ?? 4)} — two adults and their children — in plain everyday clothing${withAnimal}.`
      : `One ordinary person in plain everyday clothing${withAnimal}.`
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

// « chien », « chien et chat »… tels que lus sur l'œuvre par le studio-director.
function companionsText(policy: PhotoExamplesPolicy): string {
  const list = (policy.companions || [])
    .map((c) => String(c).trim())
    .filter(Boolean)
    .slice(0, 3)
  if (!list.length) return ''
  const EN: Record<string, string> = {
    chien: 'a dog',
    chat: 'a cat',
    cheval: 'a horse',
    lapin: 'a rabbit',
    oiseau: 'a bird',
  }
  const parts = list.map((c) => EN[c] || `a ${c}`)
  return parts.length === 1
    ? parts[0]
    : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]
}
// L'animal est EXIGÉ en code, pas seulement espéré du casting : c'est la garantie déterministe
// que l'exemple montre bien la personne AVEC son animal.
function companionClause(policy: PhotoExamplesPolicy): string {
  const txt = companionsText(policy)
  return txt
    ? ` The photo also shows ${txt}, right beside the person or held in their arms — clearly visible in the frame.`
    : ''
}
/**
 * Humeur : détendue et avenante dans les DEUX exemples — la mauvaise photo doit être mauvaise
 * pour sa RAISON TECHNIQUE, jamais parce que les gens auraient l'air malheureux.
 *
 * MAIS on ne réclame un SOURIRE que si les visages se voient : demander « un sourire naturel » sur
 * une prise DE DOS met deux règles en conflit, et le modèle sacrifie celle qu'il ne peut pas
 * satisfaire — il retournerait les gens vers l'objectif, ruinant justement l'exemple. Dos/profil :
 * la chaleur passe par la posture.
 */
function moodClause(angleKey?: string): string {
  const facesHidden = angleKey === 'back'
  if (facesHidden) {
    return 'The mood is warm and relaxed, carried by the posture alone — an easy, comfortable stance, shoulders loose, nothing stiff or sad. Faces stay away from the camera: do NOT turn anyone towards the lens to show an expression.'
  }
  return 'Everyone looks relaxed and happy in an ordinary way — a natural, easy smile, the expression of people glad to be photographed. Never a wide forced grin, never a blank stare, never a frown, a sulk or a sad face.'
}

// Contraintes de la BONNE photo, dérivées de la policy en code.
function goodConstraints(policy: PhotoExamplesPolicy): string {
  const angle = ANGLE_TEXT[policy.perfectAngle || 'front'] || ANGLE_TEXT.front
  const framing =
    policy.framing === 'full-body'
      ? 'FULL-LENGTH framing: every subject entirely visible from head to feet, with comfortable margin above heads and below feet — nothing cropped.'
      : 'The face is the subject: a clear, generous head-and-shoulders framing, the face large, fully visible and in sharp focus.'
  const together =
    policy.subject === 'group'
      ? ' They stand naturally close together, softly connected (holding hands or side by side), calm and unposed.'
      : ' The pose is calm and unposed.'
  return `${framing} The subjects are ${angle}.${together}${companionClause(policy)} ${moodClause(
    policy.perfectAngle
  )}`
}

/**
 * Violations de la MAUVAISE photo — UNE SEULE, celle que la policy refuse vraiment.
 *
 * Avant, l'exemple cumulait mauvais angle + cadrage coupé + lumière ratée + flou + fond encombré :
 * l'acheteur n'y lisait plus la règle du produit (« il me faut une photo de dos »), il y voyait
 * juste une photo ratée. On isole donc la faute : si un angle est noté 🔴, c'est LUI le défaut et
 * tout le reste — netteté, lumière, cadrage — reste impeccable. Le cadrage ne devient le défaut
 * que si aucun angle n'est refusé.
 */
function badConstraints(policy: PhotoExamplesPolicy): string {
  const rejected = (policy.rejectAngles && policy.rejectAngles[0]) || null
  const wrongAngleKey = rejected || OPPOSITE_ANGLE[policy.perfectAngle || 'front'] || null
  const wellShot =
    'Everything else about the photo is GOOD: sharp focus, soft even daylight, a calm uncluttered background, straight horizon, natural colours.'

  if (wrongAngleKey && wrongAngleKey !== policy.perfectAngle) {
    const angle = ANGLE_TEXT[wrongAngleKey] || ANGLE_TEXT.front
    const framing =
      policy.framing === 'full-body'
        ? 'Everyone is fully visible from head to feet, nothing cropped.'
        : 'A clear head-and-shoulders framing.'
    return `THE ONE AND ONLY FAULT is the shooting angle: the subjects are ${angle} — the exact viewpoint this artwork cannot use. ${framing} ${wellShot}${companionClause(
      policy
    )} ${moodClause(wrongAngleKey)}`
  }

  // Aucun angle refusé -> la faute est le cadrage.
  const framing =
    policy.framing === 'full-body'
      ? 'THE ONE AND ONLY FAULT is the framing: it cuts the subjects off — legs and feet out of frame, one person half outside the edge.'
      : 'THE ONE AND ONLY FAULT is the framing: the face is tiny and far away, lost in the frame.'
  return `${framing} ${wellShot}${companionClause(policy)} ${moodClause(policy.perfectAngle)}`
}

function buildGoodPrompt(casting: string, policy: PhotoExamplesPolicy): string {
  return `A candid amateur smartphone photograph, vertical 3:4 — the kind of photo a real customer would send to have their portrait drawn. It must be PERFECT for that purpose.

SUBJECTS: ${casting}

${goodConstraints(policy)}

SETTING & LIGHT: a simple, uncluttered outdoor spot (a park path, a beach at golden hour, a plain bright wall) in soft even daylight; gentle natural colours; every subject sharp and clearly separated from the calm background.

RENDERING: honest photorealism — a real snapshot, warm and likeable, natural skin and fabric texture, no filters, no studio look. Absolutely no text, watermark, frame or logo. Fictional everyday people only.`
}

function buildBadPrompt(casting: string, policy: PhotoExamplesPolicy): string {
  // L'intro ne dit plus « photo ratée » : depuis que la faute est UNIQUE, la photo est bien
  // prise — elle est simplement inutilisable POUR CETTE ŒUVRE. Dire les deux (« mal prise » et
  // « nette et bien éclairée ») laissait le modèle choisir, et il ajoutait flou et pénombre.
  return `A candid amateur smartphone photograph, vertical 3:4 — a realistic example of a photo a customer would send that CANNOT be used for THIS artwork. The photo itself is perfectly well taken; it simply shows the subjects from a viewpoint this artwork cannot work from.

SUBJECTS: ${casting}

${badConstraints(policy)}

RENDERING: honest photorealism — a real, pleasant snapshot, natural skin and fabric texture, no filters, no studio look. Not grotesque, not comedic, no exaggerated distortion. Absolutely no text, watermark, frame or logo. Fictional everyday people only.`
}

// Enveloppe FIXE du brief écrit par l'intent-rewriter : le brief décrit sujets/angle/cadrage/
// lumière (consigne de Walid intégrée), l'enveloppe garantit le reste (photo réaliste 3:4,
// bonne = exploitable / mauvaise = plausible, jamais grotesque, personnes fictives, zéro texte).
function wrapBriefPrompt(kind: ExampleKind, brief: string): string {
  const intro =
    kind === 'good'
      ? `A candid amateur smartphone photograph, vertical 3:4 — the kind of photo a real customer would send to have their portrait drawn. It must be PERFECT for that purpose.`
      : `A candid amateur smartphone photograph, vertical 3:4 — a realistic example of a photo that is NOT usable for drawing a portrait: a genuine everyday snapshot gone wrong, instantly recognizable as unsuitable, yet completely plausible.`
  const rendering =
    kind === 'good'
      ? `RENDERING: honest photorealism — a real snapshot, warm and likeable, natural skin and fabric texture, no filters, no studio look. ${moodClause(undefined)} Absolutely no text, watermark, frame or logo. Fictional everyday people only.`
      : `RENDERING: honest photorealism — a believable casual snapshot, just a poorly taken one. Not grotesque, not comedic, no exaggerated distortion. ${moodClause(undefined)} Absolutely no text, watermark, frame or logo. Fictional everyday people only.`
  return `${intro}

THE PHOTO: ${brief}

${rendering}`
}
