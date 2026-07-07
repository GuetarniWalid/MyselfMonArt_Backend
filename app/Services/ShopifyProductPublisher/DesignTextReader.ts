import Logger from '@ioc:Adonis/Core/Logger'
import { GoogleGenAI } from '@google/genai'

/**
 * Lit les TEXTES écrits sur le design (vision) et en déduit la table de remplacement de la
 * recette studio — reference.texts.title / reference.texts.slots / inputs.title.template.
 *
 * POURQUOI : ces valeurs décrivent le design lui-même (« The Smith Family », « DADDY, FRANCO… »
 * ou cinq dates de naissance) ; les demander à Walid était du spécifique-déguisé-en-générique.
 * On les lit donc sur l'image à la PUBLICATION, en les associant aux étapes du parcours client.
 * Échec = non bloquant : la table du préréglage est conservée telle quelle (warning), et le
 * produit naît en BROUILLON — Walid teste le studio avant activation.
 */

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash'

export interface DesignStepInfo {
  payloadKey: string
  type: string
  titleFr: string
}

export interface DesignTexts {
  /** Titre principal écrit sur le design, orthographe exacte — null si aucun. */
  title: string | null
  /** Légendes répétées par sujet (prénoms, dates…), de gauche à droite — [] si aucune. */
  slots: string[]
  /** Le titre avec sa partie variable remplacée par {payloadKey} — null si aucun champ ne le produit. */
  titleTemplate: string | null
}

const READER_INSTRUCTION = `You are analyzing a poster DESIGN used as the STYLE REFERENCE of a personalized-art product. At order time, an AI redraws this design replacing its written texts with the customer's own data. Your job: read the texts ON the design and map them to the customer fields.

You are given the design image and the list of CUSTOMER FIELDS (key — kind — French label).

OUTPUT strict JSON only, no markdown fence, with exactly these keys:
{"title": string|null, "slots": string[], "titleTemplate": string|null}

RULES:
- "title": the main standalone title/headline written on the design, EXACT spelling as written. null if the design carries no title.
- "slots": the SHORT texts repeated once per subject (a name, a date… under or next to each person/animal), in left-to-right order, EXACT spelling. [] if none.
- "titleTemplate": the title where its variable part is replaced by the {key} of the customer field that logically produces it (e.g. "La famille Martin" + field familyName -> "La famille {familyName}"). Use ONLY keys from the given list. null if no field logically produces the title.
- Decorative or fixed words that customers never change stay literal in "titleTemplate".
- Do NOT invent texts that are not clearly written on the design.`

export default class DesignTextReader {
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  public async read(designB64: string, steps: DesignStepInfo[]): Promise<DesignTexts | null> {
    if (!process.env.GEMINI_API_KEY) return null
    const m = /^data:(.+?);base64,(.+)$/s.exec(designB64)
    const mimeType = m ? m[1] : 'image/jpeg'
    const data = m ? m[2] : designB64
    const fields = steps.map((s) => `- ${s.payloadKey} — ${s.type} — « ${s.titleFr} »`).join('\n')
    try {
      const config: any = {
        systemInstruction: READER_INSTRUCTION,
        temperature: 0.1, // lecture : on veut l'exactitude, pas la créativité
        maxOutputTokens: 400,
        responseMimeType: 'application/json',
      }
      if (TEXT_MODEL.startsWith('gemini-2.5')) config.thinkingConfig = { thinkingBudget: 0 }
      const rsp: any = await Promise.race([
        this.ai.models.generateContent({
          model: TEXT_MODEL,
          contents: [
            { inlineData: { mimeType, data } },
            { text: `CUSTOMER FIELDS:\n${fields || '(none)'}\nRead the design texts.` },
          ],
          config,
        }),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('DesignTextReader timeout')), 60000)
        ),
      ])
      const raw = (typeof rsp?.text === 'string' ? rsp.text : '').trim()
      const parsed = JSON.parse(
        raw
          .replace(/^```(?:json)?/i, '')
          .replace(/```$/, '')
          .trim()
      )
      const title =
        typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : null
      const slots = Array.isArray(parsed.slots)
        ? parsed.slots
            .filter((s: any) => typeof s === 'string' && s.trim())
            .map((s: string) => s.trim())
            .slice(0, 12)
        : []
      const titleTemplate =
        typeof parsed.titleTemplate === 'string' && parsed.titleTemplate.trim()
          ? parsed.titleTemplate.trim()
          : null
      return { title, slots, titleTemplate }
    } catch (e) {
      Logger.warn('DesignTextReader failed: %s', (e as any)?.message || e)
      return null
    }
  }
}

/**
 * Applique la lecture du design à la recette (mutation d'une COPIE, appelant responsable).
 * Cohérence par construction : titre et template écrits ENSEMBLE ou pas du tout ; un template
 * qui référence un champ inconnu du parcours retombe sur la table existante (warning).
 */
export function applyDesignTexts(
  recipe: any,
  texts: DesignTexts,
  knownKeys: string[],
  warnings: string[]
): void {
  recipe.reference = recipe.reference || {}
  recipe.reference.texts = recipe.reference.texts || {}
  recipe.inputs = recipe.inputs || {}

  // Titre : lu sur le design + produit par un champ du parcours -> substitution complète.
  if (texts.title && texts.titleTemplate) {
    const used = [...texts.titleTemplate.matchAll(/\{([^{}]+)\}/g)].map((mm) => mm[1])
    const unknown = used.filter((k) => !knownKeys.includes(k))
    if (unknown.length) {
      warnings.push(
        `Titre du design : champ inconnu {${unknown[0]}} proposé par la lecture — table du préréglage conservée.`
      )
    } else {
      recipe.reference.texts.title = texts.title
      recipe.inputs.title = { template: texts.titleTemplate, required: true }
    }
  } else if (texts.title && !texts.titleTemplate) {
    // Titre décoratif fixe : écrit tel quel sur chaque dessin, aucun champ client ne le produit.
    recipe.reference.texts.title = texts.title
    recipe.inputs.title = { template: texts.title, required: false }
    warnings.push(
      `Titre « ${texts.title} » lu sur le design sans champ client correspondant : il sera peint tel quel — vérifie le brouillon.`
    )
  } else {
    // Pas de titre sur le design : aucune substitution de titre.
    delete recipe.reference.texts.title
    delete recipe.inputs.title
  }

  // Slots : légendes par sujet lues sur le design (prénoms, dates…).
  if (texts.slots.length) {
    recipe.reference.texts.slots = texts.slots
  } else {
    delete recipe.reference.texts.slots
    // sans légendes par sujet, le découpage en prénoms n'a rien à remplacer
    delete recipe.inputs.tokens
  }
}
