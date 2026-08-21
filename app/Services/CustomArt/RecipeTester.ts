import Logger from '@ioc:Adonis/Core/Logger'
import sharp from 'sharp'
import RecipeService from 'App/Services/CustomArt/RecipeService'
import JudgeRunner from 'App/Services/CustomArt/JudgeRunner'
import { buildGenericPrompt } from 'App/Services/CustomArt/genericPrompt'
import { resolveProviderChain } from 'App/Services/CustomArt/providers'
import { finalizeRecipeFromDesign } from 'App/Services/ShopifyProductPublisher/finalizeRecipe'

/**
 * « Tester le prompt » du Publisher : une génération d'essai AVANT publication.
 *
 * POURQUOI : jusqu'ici, la seule façon de savoir ce qu'un design allait rendre était de publier le
 * produit puis de passer commande dans le studio. Chaque réglage de prompt coûtait donc une
 * publication — et les rejets du juge n'apparaissaient qu'à ce moment-là.
 *
 * FIDÉLITÉ : on emprunte le MÊME chemin que la production, pas une imitation —
 *   finalizeRecipeFromDesign (textes lus sur le design + fragments imposés)
 *   -> RecipeService.parseRecipe -> buildGenericPrompt -> chaîne de providers -> JudgeRunner.
 * Un test qui passerait à côté de ces étapes mentirait précisément là où on a besoin de vérité.
 *
 * Différences ASSUMÉES avec une vraie commande : un seul candidat (au lieu de 3), aucun job en
 * base, aucune mise en situation, aucun e-mail. On veut voir une image et un verdict, vite.
 */
export interface RecipeTestResult {
  image: string
  prompt: string
  pass: boolean
  score: number | null
  reason: string | null
  warnings: string[]
}

export default class RecipeTester {
  public async run(input: {
    /** Design (data URI) — sert de référence de style, comme studio.references en production. */
    artwork: string
    /** Photo « cliente » (data URI). */
    photo: string
    studioConfig: any
    studioRecipe: any
    /** Valeurs des champs texte, par payloadKey (ex { personalMessage: 'Best mom ever' }). */
    values: Record<string, string>
  }): Promise<RecipeTestResult> {
    const warnings: string[] = []

    // 1) La recette telle qu'elle SERA publiée (titre et légendes lus sur le design).
    const finalized = await finalizeRecipeFromDesign({
      studioConfig: input.studioConfig,
      studioRecipe: input.studioRecipe,
      referenceBase64: input.artwork,
      warnings,
    })
    const recipe = RecipeService.parseRecipe(JSON.stringify(finalized))

    // 2) Entrées client : prénoms découpés depuis le champ source, titre assemblé par template.
    const values = input.values || {}
    const tokens = recipe.tokens
      ? String(values[recipe.tokens.from] || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, recipe.tokens.max)
      : []
    let title: string | null = null
    if (recipe.title) {
      title = recipe.title.template.replace(/\{([^{}]+)\}/g, (_m, k) =>
        String(values[k] || '').trim()
      )
      if (!title.trim()) {
        title = null
        warnings.push(
          'Le titre est vide : renseigne le champ qui le compose pour éprouver son remplacement.'
        )
      }
    }

    const prompt = buildGenericPrompt({ recipe, tokens, title })

    // 3) Une image, par la chaîne de providers configurée (mêmes modèles qu'en production).
    const photoBuffer = await this.toBuffer(input.photo)
    const refBuffer = await this.toBuffer(input.artwork)
    const providers = resolveProviderChain()
    let imageBuffer: Buffer | null = null
    for (const provider of providers) {
      try {
        const result = await provider.generate({
          photoBuffer,
          kitRefBuffers: [refBuffer],
          sceneRefBuffer: null,
          prompt,
          aspect: recipe.aspect,
        })
        if (result.providerMeta.refused || !result.imageBuffer) {
          warnings.push(`${provider.key} a refusé la photo (${result.providerMeta.refused}).`)
          continue
        }
        imageBuffer = result.imageBuffer
        break
      } catch (e: any) {
        warnings.push(`${provider.key} : ${e?.message || e}`)
      }
    }
    if (!imageBuffer) throw new Error('Aucun rendu produit — voir les avertissements.')

    // 4) Le MÊME juge que la production : c'est lui qui accepte ou refuse en vrai.
    let pass = true
    let score: number | null = null
    let reason: string | null = null
    try {
      const outcome = await new JudgeRunner().judgeGeneric({
        candidateBuffer: imageBuffer,
        tokens,
        title,
        n: tokens.length,
        referenceTexts: recipe.referenceTexts,
        checks: recipe.judge,
        photoBuffer: recipe.judge.seesReferences ? photoBuffer : undefined,
        references: recipe.judge.seesReferences ? [refBuffer] : undefined,
        label: null,
      } as any)
      pass = Boolean(outcome.verdict?.pass)
      score = outcome.verdict?.score ?? null
      reason = outcome.verdict?.reason || null
    } catch (e: any) {
      warnings.push(`Jugement indisponible (${e?.message || e}) — l'image reste affichée.`)
    }

    const jpeg = await sharp(imageBuffer).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    Logger.info('recipe-test pass=%s score=%s prompt=%s car.', pass, score, prompt.length)
    return {
      image: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
      prompt,
      pass,
      score,
      reason,
      warnings,
    }
  }

  private async toBuffer(dataUri: string): Promise<Buffer> {
    const m = /^data:(.+?);base64,(.+)$/s.exec(dataUri)
    const raw = Buffer.from(m ? m[2] : dataUri, 'base64')
    // Normalisation identique à l'entrée d'un vrai job : EXIF appliqué, borné à 2048 px.
    return sharp(raw)
      .rotate()
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer()
  }
}
