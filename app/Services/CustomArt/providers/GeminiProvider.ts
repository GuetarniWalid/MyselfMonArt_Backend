import Logger from '@ioc:Adonis/Core/Logger'
import sharp from 'sharp'
import { GoogleGenAI } from '@google/genai'
import type { CustomArtProvider, GenerateParams, GenerateResult } from './types'
import { withTimeout } from './types'

// Modèle par défaut du maillon : primaire de la chaîne arbitrée au bench M1 (2026-06-11).
// IDs STABLES (les *-preview sont deprecated, shutdown 25/06/2026), vérifiés au bench.
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image'

// Estimations indicatives €/image (mesures bench M1 — suivi du cap quotidien, pas une facture)
const EST_COST_FLASH_EUR = 0.039
const EST_COST_PRO_EUR = 0.134

/**
 * Provider Gemini (Nano Banana) — miroir du pattern ArtworkInserter : multi-images en
 * inlineData successifs + responseModalities IMAGE + aspectRatio. Aucune part image
 * dans la réponse = refus modération Google (pas une erreur HTTP).
 *
 * Le modèle est fixé par maillon de chaîne (cf. providers/index.ts) : la même classe
 * sert le primaire (3.1 flash), le secours (3 pro) et le dernier recours (2.5 flash,
 * filtre d'entrée moins strict). ⚠️ Gemini 3.x refuse photo client + toute autre image
 * contenant une personne (acceptsPersonRefs=false) : la réf scène est retirée en amont.
 */
export default class GeminiProvider implements CustomArtProvider {
  public readonly name = 'gemini'
  public readonly key: string
  public readonly acceptsPersonRefs: boolean

  // Clé Gemini DÉDIÉE (AI Studio), distincte de GOOGLE_API_KEY — lue via process.env
  // pour ne pas dépendre de env.ts (même choix qu'ArtworkInserter).
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  private model: string

  constructor(model?: string) {
    this.model = model || DEFAULT_GEMINI_IMAGE_MODEL
    this.key = `gemini:${this.model}`
    // Filtre anti face-swap des Gemini 3.x (bench 2026-06-10) : pas de réf avec personne
    this.acceptsPersonRefs = !this.model.startsWith('gemini-3')
  }

  public isAvailable(): boolean {
    return Boolean(process.env.GEMINI_API_KEY)
  }

  public async generate(params: GenerateParams): Promise<GenerateResult> {
    const t0 = Date.now()
    const estCostEur = this.model.includes('pro') ? EST_COST_PRO_EUR : EST_COST_FLASH_EUR

    const contents: any[] = [
      { text: params.prompt },
      // image 1 = photo client (référence visage)
      { inlineData: { mimeType: 'image/jpeg', data: params.photoBuffer.toString('base64') } },
    ]
    // images 2..n = références maillot (sans personne — requis par le filtre Gemini 3.x)
    for (const kit of params.kitRefBuffers) {
      contents.push({ inlineData: { mimeType: 'image/jpeg', data: kit.toString('base64') } })
    }
    // dernière image (optionnelle) = référence scène/pose — retirée en amont pour Gemini 3.x
    if (params.sceneRefBuffer) {
      contents.push({
        inlineData: { mimeType: 'image/jpeg', data: params.sceneRefBuffer.toString('base64') },
      })
    }

    const req: any = {
      model: this.model,
      contents,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '3:4' }, // poster portrait
      },
    }

    const rsp: any = await withTimeout(this.ai.models.generateContent(req), `Gemini ${this.model}`)

    let outB64: string | null = null
    const parts = rsp?.candidates?.[0]?.content?.parts || []
    for (const part of parts) {
      if (part?.inlineData?.data) {
        outB64 = part.inlineData.data
        break
      }
    }

    if (!outB64) {
      // Pas de part image = refus modération (comportement documenté Gemini).
      // blockReason 'OTHER'/'IMAGE_SAFETY' avec photo de personne = filtre d'entrée
      // (anti face-swap / sécurité) — le worker déclenche la chaîne de secours.
      const blockReason = rsp?.promptFeedback?.blockReason
      const finishReason = rsp?.candidates?.[0]?.finishReason
      const detail = blockReason
        ? `blockReason=${blockReason}`
        : `finishReason=${finishReason || 'inconnu'}`
      Logger.warn('custom-art gemini REFUS model=%s (%s)', this.model, detail)
      return {
        imageBuffer: null,
        providerMeta: {
          model: this.model,
          latencyMs: Date.now() - t0,
          estCostEur: 0,
          refused: `Rendu refusé par la modération du modèle (${detail}).`,
        },
      }
    }

    // Normalisation sortie : JPEG propre (pattern repo)
    const jpeg = await sharp(Buffer.from(outB64, 'base64'))
      .jpeg({ quality: 92, progressive: true, mozjpeg: true })
      .toBuffer()

    return {
      imageBuffer: jpeg,
      providerMeta: { model: this.model, latencyMs: Date.now() - t0, estCostEur },
    }
  }
}
