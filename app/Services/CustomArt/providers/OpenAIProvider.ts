import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'
import type { CustomArtProvider, GenerateParams, GenerateResult } from './types'

/**
 * gpt-image-2 : edit accepte un TABLEAU d'images (multi-références) et une taille EXPLICITE.
 *
 * Le ratio de la recette DOIT être respecté : le fichier d'impression est recadré en `cover` sur
 * du 3:4 (PrintFileService). Une sortie 2:3 y perdrait 11 % de sa hauteur, moitié en haut moitié
 * en bas — exactement là où ces posters portent le titre et les légendes. Et rien ne le
 * signalerait : l'aperçu de la cliente et le juge voient l'image ENTIÈRE, le rognage n'apparaît
 * qu'à l'impression, payée.
 *
 * Tailles reprises telles quelles de l'ArtworkResizer, éprouvées en production sur ce même modèle
 * (commit 889de23) : largeur et hauteur divisibles par 16, ratio exact.
 */
export const SIZE_BY_ASPECT: Record<string, string> = {
  '3:4': '1152x1536',
  '1:1': '1024x1024',
  '4:3': '1536x1152',
}

/**
 * gpt-image-2 est LENT : ~112 s par décor et 120-180 s au retaillage, mesuré dans ce dépôt. Les
 * 45 s calibrées pour Gemini flash annuleraient donc chaque appel avant sa réponse. Budget propre,
 * et reprises du SDK coupées : réessayer est le rôle de la chaîne de providers, le doubler ne
 * ferait que tripler l'attente et la facture (une requête annulée reste facturable).
 */
const OPENAI_TIMEOUT_MS = 240000

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

  // Client construit À LA DEMANDE, pas à l'initialisation du champ : le SDK OpenAI LÈVE si la clé
  // est absente, si bien qu'un simple `makeProvider('openai:…')` faisait planter TOUTE la
  // résolution de chaîne au lieu de laisser `isAvailable()` écarter le maillon. Le filet de
  // secours (« un maillon non configuré est ignoré, pas fatal ») n'existait donc pas pour OpenAI.
  private client: OpenAI | null = null
  private model: string

  private get openai(): OpenAI {
    if (!this.client) this.client = new OpenAI({ apiKey: Env.get('OPENAI_API_KEY'), maxRetries: 0 })
    return this.client
  }

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

    // Ratio non couvert : on LÈVE plutôt que de rendre une taille voisine. L'appelant écarte
    // alors ce maillon et passe au suivant — mieux vaut un autre modèle qu'un poster rogné.
    const size = SIZE_BY_ASPECT[params.aspect || '3:4']
    if (!size) {
      throw new Error(
        `gpt-image ne couvre pas le ratio ${params.aspect} (attendus : ${Object.keys(SIZE_BY_ASPECT).join(', ')})`
      )
    }

    const apiParams: any = {
      model: this.model,
      image: images,
      prompt: params.prompt,
      size,
      quality: 'high',
      n: 1,
    }

    try {
      const rsp = await this.openai.images.edit(apiParams, { timeout: OPENAI_TIMEOUT_MS })
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
