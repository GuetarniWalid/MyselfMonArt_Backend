import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import CustomArtStorage from '../Storage'
import type { CustomArtProvider, GenerateParams, GenerateResult } from './types'
import { GENERATION_TIMEOUT_MS } from './types'

// Modèle officiel Replicate (Seedream 4, $0.03/image, multi-images via image_input).
// Surchargeable par env (hors env.ts, comme GEMINI_IMAGE_MODEL) pour le bench M1.
const REPLICATE_MODEL = process.env.REPLICATE_IMAGE_MODEL || 'bytedance/seedream-4'
const EST_COST_EUR = 0.03

const API_BASE = 'https://api.replicate.com/v1'

/**
 * Provider Replicate (REST, sans SDK) — POST /models/{owner}/{name}/predictions avec
 * Prefer: wait (sync <=60 s), sinon poll GET /predictions/{id} jusqu'à succeeded/failed.
 *
 * ⚠️ Replicate limite les inputs en data URI (~256 KB) : on uploade donc les images
 * d'entrée en clés tmp publiques sur DO Spaces et on passe des URLs, supprimées ensuite
 * (best-effort). Désactivé proprement si REPLICATE_API_TOKEN est absent.
 */
export default class ReplicateProvider implements CustomArtProvider {
  public readonly name = 'replicate'
  public readonly key = `replicate:${REPLICATE_MODEL}`
  // Seedream accepte les références contenant des personnes (modèle permissif, §0.12)
  public readonly acceptsPersonRefs = true

  public isAvailable(): boolean {
    // Le passage par URLs publiques exige aussi un storage distant configuré
    return Boolean(Env.get('REPLICATE_API_TOKEN')) && CustomArtStorage.spacesConfigured()
  }

  public async generate(params: GenerateParams): Promise<GenerateResult> {
    const t0 = Date.now()
    const headers = {
      'Authorization': `Bearer ${Env.get('REPLICATE_API_TOKEN')}`,
      'Prefer': 'wait',
      'Content-Type': 'application/json',
    }

    // 1) Upload des inputs en tmp public (URLs requises par Replicate)
    const tmpKeys: string[] = []
    const uploadTmp = async (buffer: Buffer): Promise<string> => {
      const key = `custom-art/tmp/${randomUUID()}.jpg`
      await CustomArtStorage.put(key, buffer, { contentType: 'image/jpeg', isPublic: true })
      tmpKeys.push(key)
      return CustomArtStorage.publicUrl(key)
    }

    try {
      const imageInput: string[] = [await uploadTmp(params.photoBuffer)]
      for (const kit of params.kitRefBuffers) imageInput.push(await uploadTmp(kit))
      if (params.sceneRefBuffer) imageInput.push(await uploadTmp(params.sceneRefBuffer))

      // 2) Prediction (Prefer: wait tente la réponse synchrone)
      const createRsp = await axios.post(
        `${API_BASE}/models/${REPLICATE_MODEL}/predictions`,
        {
          input: {
            prompt: params.prompt,
            image_input: imageInput,
            size: '2K',
            aspect_ratio: '3:4',
            sequential_image_generation: 'disabled',
          },
        },
        { headers, timeout: GENERATION_TIMEOUT_MS }
      )

      let prediction: any = createRsp.data

      // 3) Poll si la réponse n'est pas encore terminale
      while (prediction?.status === 'starting' || prediction?.status === 'processing') {
        if (Date.now() - t0 > GENERATION_TIMEOUT_MS) {
          throw new Error(`Replicate timeout (${GENERATION_TIMEOUT_MS}ms)`)
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
        const pollRsp = await axios.get(`${API_BASE}/predictions/${prediction.id}`, {
          headers: { Authorization: headers.Authorization },
          timeout: 15000,
        })
        prediction = pollRsp.data
      }

      if (prediction?.status !== 'succeeded') {
        const detail = prediction?.error || prediction?.status || 'inconnu'
        // Les refus guardrails Seedream remontent comme prediction failed avec un message dédié
        const msg = String(detail).toLowerCase()
        if (msg.includes('safety') || msg.includes('flagged') || msg.includes('nsfw')) {
          Logger.warn('custom-art replicate REFUS model=%s: %s', REPLICATE_MODEL, detail)
          return {
            imageBuffer: null,
            providerMeta: {
              model: REPLICATE_MODEL,
              latencyMs: Date.now() - t0,
              estCostEur: 0,
              refused: 'Rendu refusé par les garde-fous du modèle.',
            },
          }
        }
        throw new Error(`Replicate prediction échouée: ${detail}`)
      }

      const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
      if (!output || typeof output !== 'string') {
        throw new Error('Replicate: sortie vide ou inattendue')
      }

      // 4) Téléchargement de l'image résultat puis normalisation JPEG
      const imgRsp = await axios.get(output, { responseType: 'arraybuffer', timeout: 30000 })
      const jpeg = await sharp(Buffer.from(imgRsp.data))
        .jpeg({ quality: 92, progressive: true, mozjpeg: true })
        .toBuffer()

      return {
        imageBuffer: jpeg,
        providerMeta: {
          model: REPLICATE_MODEL,
          latencyMs: Date.now() - t0,
          estCostEur: EST_COST_EUR,
        },
      }
    } finally {
      // Nettoyage best-effort des inputs temporaires publics
      for (const key of tmpKeys) {
        CustomArtStorage.delete(key).catch(() => {})
      }
    }
  }
}
