import Env from '@ioc:Adonis/Core/Env'
import Application from '@ioc:Adonis/Core/Application'
import Logger from '@ioc:Adonis/Core/Logger'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { CustomArtProvider, GenerateParams, GenerateResult } from './types'

// Matière première : les 120 tableaux du bench M1 (déjà payés et stockés en local).
// Surchargeable par env CUSTOM_ART_FAKE_IMAGES_DIR (chemin absolu ou relatif au repo).
const DEFAULT_IMAGES_DIR = 'scripts/bench/results/fiabilite-g31-v2/images'

/**
 * Provider FACTICE (M10, réutilisé par les tests de charge M12) : renvoie une image
 * statique du bench (scripts/bench/results) SANS AUCUN appel API — zéro coût.
 * Activé par env CUSTOM_ART_FAKE_PROVIDER=true (IGNORÉ en production, voir index.ts) :
 * la chaîne de providers est alors réduite à ce seul maillon et le juge vision est
 * court-circuité par un verdict factice « pass » (App/Services/CustomArt/Worker).
 *
 * Sert à rejouer en local le parcours complet (caps anti-abus, reveal, save, webhook
 * orders/paid) et les tests de charge, sans dépendre des clés ni payer une génération.
 */
export default class FakeProvider implements CustomArtProvider {
  public readonly name = 'fake'
  public readonly key = 'fake'
  public readonly acceptsPersonRefs = true

  /** Liste des images du dossier, cachée au premier appel (process-wide). */
  private static imageFiles: string[] | null = null

  public isAvailable(): boolean {
    return true // aucune clé API requise — la disponibilité est pilotée par l'env flag
  }

  public async generate(params: GenerateParams): Promise<GenerateResult> {
    const t0 = Date.now()
    void params // les entrées sont volontairement ignorées (aucun appel extérieur)

    const files = await FakeProvider.listImages()
    if (files.length === 0) {
      throw new Error(
        `Provider factice : aucune image dans ${FakeProvider.imagesDir()} ` +
          '(CUSTOM_ART_FAKE_IMAGES_DIR pour pointer un autre dossier)'
      )
    }

    // Tirage aléatoire : les 3 candidats d'un même round sortent (presque toujours)
    // différents, ce qui rend le reveal-next testable visuellement.
    const file = files[Math.floor(Math.random() * files.length)]
    const imageBuffer = await fs.readFile(join(FakeProvider.imagesDir(), file))

    return {
      imageBuffer,
      providerMeta: {
        model: 'fake-static',
        latencyMs: Date.now() - t0,
        estCostEur: 0, // rien n'est appelé, rien n'est payé
      },
    }
  }

  private static imagesDir(): string {
    const configured = Env.get('CUSTOM_ART_FAKE_IMAGES_DIR') || DEFAULT_IMAGES_DIR
    // Chemin relatif = relatif à la racine du repo (les scripts/bench n'existent qu'en local)
    return configured.match(/^([a-zA-Z]:[\\/]|\/)/)
      ? configured
      : join(Application.appRoot, configured)
  }

  private static async listImages(): Promise<string[]> {
    if (FakeProvider.imageFiles) return FakeProvider.imageFiles
    try {
      const entries = await fs.readdir(FakeProvider.imagesDir())
      FakeProvider.imageFiles = entries.filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    } catch (error) {
      Logger.error(
        'custom-art fake provider : dossier images illisible (%s) — %s',
        FakeProvider.imagesDir(),
        (error as any)?.message || error
      )
      FakeProvider.imageFiles = []
    }
    return FakeProvider.imageFiles
  }
}
