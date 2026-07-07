import Logger from '@ioc:Adonis/Core/Logger'
import { GoogleGenAI } from '@google/genai'

/**
 * PROMPT-DIRECTOR : écrit les fragments de prompt de la recette studio À PARTIR DU DESIGN
 * (vision), au moment où Walid uploade son image dans le Publisher personnalisé.
 *
 * POURQUOI : base/perPerson/replaceTitle/addExtra/removeExtra décrivent le STYLE du design
 * (trait, typographie du titre, séparateurs des légendes…) — c'était le dernier morceau de
 * « prompting » manuel. L'IA les écrit, Walid ne fait que relire dans la carte 4.
 *
 * SOLIDITÉ : sortie JSON stricte ; chaque fragment non-null doit contenir ses placeholders
 * obligatoires (contrat genericPrompt) sinon il est rejeté individuellement (l'appelant garde
 * la valeur précédente). Le prompt famille (fait main, éprouvé) sert d'étalon few-shot.
 * imageRoles/countLine ne sont PAS écrits ici : structurels, imposés en code à la publication.
 */

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash'

export interface RecipeDirectorStepInfo {
  payloadKey: string
  type: string
  titleFr: string
}

export interface RecipePrompts {
  base: string | null
  perPerson: string | null
  replaceTitle: string | null
  addExtra: string | null
  removeExtra: string | null
}

// Placeholders EXIGÉS par le moteur de génération (contrat recette §5) pour chaque fragment.
const REQUIRED_PLACEHOLDERS: Record<keyof RecipePrompts, string[]> = {
  base: [],
  perPerson: ['{index}', '{from}', '{to}'],
  replaceTitle: ['{from}', '{to}'],
  addExtra: ['{to}'],
  removeExtra: ['{from}'],
}

// Étalon few-shot : les fragments du produit famille (faits main, validés en prod).
const EXAMPLE_FRAGMENTS = `{
  "base": "Create a minimalist single continuous-line illustration ('one-line art' style): one delicate, even, pure-black line on a pure-white background - no color, no grey, no shading, no hatching, no background, no shadow. Redraw the family from the UPLOADED PHOTO in the exact line quality, composition, framing and hand-lettering of the STYLE-REFERENCE image: the family seen FROM BEHIND, gently walking, softly connected - holding hands, a parent carrying the youngest when there is a very small child - elegant and tender. From the photo, faithfully derive for EACH person their left-to-right order, relative height and apparent age (adult / child / toddler / baby), hair length, hairstyle and parting, and overall build and clothing silhouette - but always rendered from behind, faces undetailed, in the reference's clean thin single-line style. Do NOT add wings, halos, hats, pets or any accessory not clearly present in the uploaded photo. The final artwork is one continuous elegant black line on pure white, with no text other than the captions requested below.",
  "perPerson": "Under person #{index} (left to right), replace the reference caption « {from} » with « {to} » - EXACT spelling and casing, in the reference's evenly spaced serif capitals, separated from the next name by the same small heart.",
  "replaceTitle": "Write the title in the reference's flowing script font, replacing « {from} » with « {to} » - exact spelling, same elegant hand-lettered style.",
  "addExtra": "Add one more person, consistent with the photo (matching height, apparent age and hair, viewed from behind, same single-line style), naturally connected in the row, with the caption « {to} » under them in the same lettering and even heart separators.",
  "removeExtra": "Remove the person associated with the caption « {from} » and remove that caption, keeping the remaining family naturally connected and the name row evenly spaced."
}`

const DIRECTOR_INSTRUCTION = `You are a PROMPT DIRECTOR for a personalized-art e-commerce studio. At order time, an image AI receives the customer's photo (IMAGE 1) and this DESIGN as style reference (IMAGE 2), and redraws the photo's subjects in the design's exact style, replacing the design's written texts with the customer's data. You write the PROMPT FRAGMENTS used for that generation.

You are given the DESIGN image and the list of CUSTOMER FIELDS (key — kind — French label).

OUTPUT strict JSON only, exactly these keys:
{"base": string, "perPerson": string|null, "replaceTitle": string|null, "addExtra": string|null, "removeExtra": string|null}

HOW TO WRITE "base" (100-220 words, imperative English for an image model):
- Open by naming the exact ART STYLE you observe on the design: line quality, colours, background, shading, texture — precise enough that the model cannot drift to a generic look.
- Say what to derive from the UPLOADED PHOTO for EACH subject (order, relative sizes, apparent ages, hair, build, clothing silhouette — whatever this style actually renders), and what the design's conventions impose (pose, angle, framing, connection between subjects).
- Forbid inventions: nothing added that is not clearly present in the photo.
- Close with: the final artwork is [one-sentence style summary], with no text other than the captions requested below.

THE OTHER FRAGMENTS (each null when not applicable to this design):
- "perPerson": how to replace the per-subject caption — MUST contain {index}, {from} and {to}; describe the captions' typography and separator EXACTLY as seen on the design. null if the design has no per-subject captions.
- "replaceTitle": how to rewrite the title — MUST contain {from} and {to}; describe the title's typography as seen. null if the design has no title.
- "addExtra": add one subject consistently with photo and style — MUST contain {to}. null if no per-subject captions.
- "removeExtra": remove the subject of caption {from} — MUST contain {from}. null if no per-subject captions.

QUALITY BAR — match the precision of this hand-crafted example (a one-line family art design):
${EXAMPLE_FRAGMENTS}

Never copy the example's style words if the design differs — describe THIS design. No preamble, no markdown fence.`

export default class RecipeDirector {
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  public async write(
    designB64: string,
    steps: RecipeDirectorStepInfo[]
  ): Promise<RecipePrompts | null> {
    if (!process.env.GEMINI_API_KEY) return null
    const m = /^data:(.+?);base64,(.+)$/s.exec(designB64)
    const mimeType = m ? m[1] : 'image/jpeg'
    const data = m ? m[2] : designB64
    const fields = steps.map((s) => `- ${s.payloadKey} — ${s.type} — « ${s.titleFr} »`).join('\n')
    try {
      const config: any = {
        systemInstruction: DIRECTOR_INSTRUCTION,
        temperature: 0.4,
        maxOutputTokens: 1400,
        responseMimeType: 'application/json',
      }
      if (TEXT_MODEL.startsWith('gemini-2.5')) config.thinkingConfig = { thinkingBudget: 0 }
      const rsp: any = await Promise.race([
        this.ai.models.generateContent({
          model: TEXT_MODEL,
          contents: [
            { inlineData: { mimeType, data } },
            { text: `CUSTOMER FIELDS:\n${fields || '(none)'}\nWrite the prompt fragments.` },
          ],
          config,
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('RecipeDirector timeout')), 90000)),
      ])
      const raw = (typeof rsp?.text === 'string' ? rsp.text : '').trim()
      const parsed = JSON.parse(
        raw
          .replace(/^```(?:json)?/i, '')
          .replace(/```$/, '')
          .trim()
      )
      return this.sanitize(parsed)
    } catch (e) {
      Logger.warn('RecipeDirector failed: %s', (e as any)?.message || e)
      return null
    }
  }

  /** Garde par fragment : type + placeholders obligatoires ; un fragment douteux -> null. */
  private sanitize(parsed: any): RecipePrompts | null {
    const clean = (key: keyof RecipePrompts, minLen: number): string | null => {
      const v = parsed && parsed[key]
      if (typeof v !== 'string') return null
      const txt = v.replace(/\s+/g, ' ').trim()
      if (txt.length < minLen) return null
      for (const ph of REQUIRED_PLACEHOLDERS[key]) if (!txt.includes(ph)) return null
      return txt.slice(0, 2400)
    }
    const base = clean('base', 200) // une base courte = analyse ratée, on rejette tout
    if (!base) return null
    return {
      base,
      perPerson: clean('perPerson', 40),
      replaceTitle: clean('replaceTitle', 30),
      addExtra: clean('addExtra', 30),
      removeExtra: clean('removeExtra', 30),
    }
  }
}
