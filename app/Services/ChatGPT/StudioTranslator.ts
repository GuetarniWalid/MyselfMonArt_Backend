import Env from '@ioc:Adonis/Core/Env'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import Authentication from './Authentication'

/**
 * Traducteur léger « batch de chaînes » pour le builder « poster personnalisé » (plan §4.4).
 *
 * Le Translator existant est structuré PAR RESSOURCE Shopify (constructeur (payload, resource,
 * targetLanguage)) et n'expose pas d'API générique « liste de libellés -> 4 langues ». On ajoute
 * donc ce handler dédié, en gardant le MÊME modèle/config (OPENAI_MODEL + client Authentication).
 *
 * Entrée : [{ id, fr }] ; sortie : [{ id, en, de, nl, es }] (FR laissé au client). Un seul appel
 * OpenAI (structured output zod) pour tout le lot -> coût minimal, ordre garanti par l'id.
 */

const TARGET_LANGS = ['en', 'de', 'nl', 'es'] as const

export interface TranslateItemIn {
  id: string
  fr: string
}
export interface TranslateItemOut {
  id: string
  en: string
  de: string
  nl: string
  es: string
}

// Schéma de sortie imposé au modèle : un item par id, avec les 4 langues.
const responseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      en: z.string(),
      de: z.string(),
      nl: z.string(),
      es: z.string(),
    })
  ),
})

const SYSTEM_PROMPT =
  'You are a professional e-commerce localizer for an art store (posters). ' +
  'Translate each French UI label from "fr" into English (en), German (de), Dutch (nl) and Spanish (es). ' +
  'Keep the marketing tone, keep it concise, preserve any placeholders in braces like {familyName} EXACTLY, ' +
  'do not add quotes or trailing punctuation that was not present. Return every id you received, unchanged.'

export default class StudioTranslator extends Authentication {
  public async translateBatch(items: TranslateItemIn[]): Promise<TranslateItemOut[]> {
    const cleaned = items
      .filter((it) => it && typeof it.id === 'string' && typeof it.fr === 'string' && it.fr.trim())
      .map((it) => ({ id: it.id, fr: it.fr.slice(0, 400) }))
    if (!cleaned.length) return []

    const completion = await this.openai.beta.chat.completions.parse({
      model: Env.get('OPENAI_MODEL'),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ items: cleaned }) },
      ],
      response_format: zodResponseFormat(responseSchema, 'translations'),
    })

    const parsed = completion.choices[0]?.message?.parsed
    if (!parsed || !Array.isArray(parsed.items)) {
      throw new Error('Traduction : réponse du modèle invalide')
    }

    // Réindexe par id et garantit les 4 langues (repli FR si le modèle a omis un champ).
    const byId = new Map(parsed.items.map((it) => [it.id, it]))
    return cleaned.map((src) => {
      const out = byId.get(src.id)
      return {
        id: src.id,
        en: (out && out.en) || src.fr,
        de: (out && out.de) || src.fr,
        nl: (out && out.nl) || src.fr,
        es: (out && out.es) || src.fr,
      }
    })
  }
}

export { TARGET_LANGS }
