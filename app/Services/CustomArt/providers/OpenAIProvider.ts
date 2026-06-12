import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import type { CustomArtProvider, GenerateParams, GenerateResult } from './types'
import { GENERATION_TIMEOUT_MS } from './types'

// gpt-image-2 : edit accepte un TABLEAU d'images (multi-références). Size = LxH divisible
// par 16 ; 1024x1536 ≈ ratio 2:3 portrait (le plus proche du 3:4 supporté nativement).
const IMAGE_SIZE = '1024x1536'

// Estimation indicative €/image en quality high (suivi du cap quotidien)
const EST_COST_EUR = 0.12

/**
 * Provider OpenAI gpt-image-2 — miroir du pattern ArtworkResizer/DecorGenerator :
 * images.edit avec tableau de toFile() + params castés any (types SDK 4.78.1 périmés).
 * ⚠️ gpt-image-2 REJETTE le param input_fidelity (réservé gpt-image-1/1.5) — ne pas l'ajouter.
 */
export default class OpenAIProvider implements CustomArtProvider {
  public readonly name = 'openai'
  public readonly key: string
  // gpt-image-2 accepte les références contenant des personnes (pas de filtre anti face-swap)
  public readonly acceptsPersonRefs = true

  private openai = new OpenAI({ apiKey: Env.get('OPENAI_API_KEY') })
  private model: string

  constructor(model?: string) {
    this.model = model || Env.get('OPENAI_IMAGE_MODEL') || 'gpt-image-2'
    this.key = `openai:${this.model}`
  }

  public isAvailable(): boolean {
    return Boolean(Env.get('OPENAI_API_KEY'))
  }

  public async generate(params: GenerateParams): Promise<GenerateResult> {
    const t0 = Date.now()

    // Inputs pré-traités en PNG ≤1536px (pattern ArtworkResizer)
    const toPng = (buf: Buffer) =>
      sharp(buf).resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()

    const images = [
      await toFile(await toPng(params.photoBuffer), 'photo.png', { type: 'image/png' }),
    ]
    for (let i = 0; i < params.kitRefBuffers.length; i++) {
      images.push(
        await toFile(await toPng(params.kitRefBuffers[i]), `kit-${i + 1}.png`, {
          type: 'image/png',
        })
      )
    }
    if (params.sceneRefBuffer) {
      images.push(
        await toFile(await toPng(params.sceneRefBuffer), 'scene.png', { type: 'image/png' })
      )
    }

    const apiParams: any = {
      model: this.model,
      image: images,
      prompt: params.prompt,
      size: IMAGE_SIZE,
      quality: 'high',
      n: 1,
    }

    try {
      const rsp = await this.openai.images.edit(apiParams, { timeout: GENERATION_TIMEOUT_MS })
      const b64 = rsp.data?.[0]?.b64_json
      if (!b64) throw new Error('Réponse vide de gpt-image (custom-art)')

      const jpeg = await sharp(Buffer.from(b64, 'base64'))
        .jpeg({ quality: 92, progressive: true, mozjpeg: true })
        .toBuffer()

      return {
        imageBuffer: jpeg,
        providerMeta: { model: this.model, latencyMs: Date.now() - t0, estCostEur: EST_COST_EUR },
      }
    } catch (error: any) {
      // Refus modération OpenAI -> on le signale comme refus (le worker bascule sur le fallback)
      const code = error?.code || error?.error?.code || ''
      const msg = (error?.message || '').toLowerCase()
      const isModeration =
        code === 'moderation_blocked' ||
        code === 'content_policy_violation' ||
        msg.includes('content policy') ||
        msg.includes('safety system')
      if (isModeration) {
        Logger.warn('custom-art openai REFUS model=%s: %s', this.model, error?.message)
        return {
          imageBuffer: null,
          providerMeta: {
            model: this.model,
            latencyMs: Date.now() - t0,
            estCostEur: 0,
            refused: "Rendu refusé par la modération d'OpenAI.",
          },
        }
      }
      throw error
    }
  }
}
