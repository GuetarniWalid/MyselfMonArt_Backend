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
  "base": "Create a minimalist single continuous-line illustration ('one-line art' style): one delicate, even, pure-black line on a pure-white background - no colour, no grey, no shading, no hatching, no texture, no background, no shadow, no frame. Draw the people of IMAGE 1 in the drawing language of IMAGE 2.\nThe pose is never taken from IMAGE 2: whatever its own figures happen to be doing belongs to that one drawing and is not an instruction here. Read each person off IMAGE 1 instead - the direction they face (if they face the camera, draw them facing the viewer; if their backs are turned, draw them from behind; if they are at an angle, keep that angle), their real posture (standing, walking, sitting, crouching, arms round each other, carried in someone's arms), whether they touch at all and how, their left-to-right placement, relative height, apparent age (adult / teenager / child / toddler / baby), hair length and hairstyle, build and clothing silhouette. Do not turn anyone round and do not invent contact between people who stand apart in the photo.\nThe drawing stays ONE unbroken line whatever the poses: it travels from one figure to the next through the white, so people who are not touching are still drawn without lifting the pen. Draw every figure full length, head to feet, completing the body naturally if the photo is cropped at the chest or waist, at the same scale, framing and page layout as IMAGE 2 and leaving the same room for the title and the row of names.\nFaces stay undetailed, including faces turned towards the viewer: head and hair are simple contours in the same stroke, at most a barely suggested nose or lip line, no detailed features and no attempt at a likeness. Keep the people only: drop the photo's background, and add nothing that is not clearly on the photo - no wings, halos, hats, pets, furniture, ground line, props or ornaments; a seated or leaning posture is drawn by the body's line alone, with no seat and no support. The finished artwork is one continuous black line on pure white, carrying no words other than the title and the names asked for below - no signature, no date, no watermark.",
  "perPerson": "The caption under figure #{index} from the left reads « {to} », in place of the reference's « {from} » - spelled exactly as written here between the guillemets, in the reference's evenly spaced serif lettering, with the same small heart between consecutive names. « {from} » must appear nowhere on the artwork.",
  "replaceTitle": "Write the title « {to} » in the reference's flowing hand-lettered script, in the place IMAGE 2 gives « {from} » and instead of it, spelled exactly as written here between the guillemets. « {from} » must appear nowhere on the artwork.",
  "addExtra": "Draw one more figure, in position #{index} from the left, so that there is one figure per name. If the photo shows that person, take their facing direction, posture, height, apparent age, hair and clothing silhouette from the photo; if it does not, draw a figure consistent with the others rather than leave the count short - same unbroken line, same undetailed face, no pose or contact imposed on them. Its caption reads « {to} », spelled exactly as written here between the guillemets, in the same serif lettering with the same small heart between consecutive names.",
  "removeExtra": "The reference caption « {from} » has no name of its own here: draw no figure for it and write « {from} » nowhere on the artwork. Leave the remaining figures placed and posed as the photo places and poses them, and keep the row of names centred and evenly spaced with the same heart separators."
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
