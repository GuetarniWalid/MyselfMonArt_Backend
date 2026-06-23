import Drive from '@ioc:Adonis/Core/Drive'
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import Application from '@ioc:Adonis/Core/Application'
import { promises as fs } from 'fs'
import { dirname, join } from 'path'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

export interface PutOptions {
  contentType?: string
  /**
   * true = URL CDN publique (aperçus réduits UNIQUEMENT, plan §5).
   * false = privé (photos sources, candidats HD, fichiers print) — jamais d'URL publique.
   */
  isPublic?: boolean
}

/**
 * Storage CustomArt — miroir du pattern VideoStorage (DO Spaces, retry x3 linéaire),
 * dossier racine custom-art/ ({jobs|teams|print|tmp}/...).
 * Fallback local en dev quand DO Spaces n'est pas configuré :
 *   - public  -> public/assets/custom-art/... (servi statiquement par Adonis)
 *   - privé   -> tmp/custom-art/... (hors webroot)
 */
export default class CustomArtStorage {
  /** DO Spaces configuré ? Sinon fallback local (dev). */
  public static spacesConfigured(): boolean {
    return Boolean(
      Env.get('DO_SPACES_KEY') && Env.get('DO_SPACES_BUCKET') && Env.get('DO_SPACES_CDN_ENDPOINT')
    )
  }

  /** URL publique d'une clé publique (CDN Spaces, ou serveur local en dev). */
  public static publicUrl(key: string): string {
    const safe = CustomArtStorage.sanitize(key)
    if (CustomArtStorage.spacesConfigured()) {
      return `${Env.get('DO_SPACES_CDN_ENDPOINT')}/${safe}`
    }
    // En local, public/ est servi à la racine -> /assets/custom-art/...
    return `${Env.get('BACKEND_URL')}/assets/${safe}`
  }

  /** Écrit un buffer (retry x3 linéaire, pattern VideoStorage). Retourne la clé. */
  public static async put(key: string, buffer: Buffer, options: PutOptions = {}): Promise<string> {
    const safe = CustomArtStorage.sanitize(key)
    const { contentType = 'image/jpeg', isPublic = false } = options

    let lastError: Error | null = null
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (CustomArtStorage.spacesConfigured()) {
          await Drive.use('spaces').put(safe, buffer, {
            contentType,
            visibility: isPublic ? 'public' : 'private',
          })
        } else {
          const path = CustomArtStorage.localPath(safe, isPublic)
          await fs.mkdir(dirname(path), { recursive: true })
          await fs.writeFile(path, buffer)
        }
        return safe
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        Logger.warn(
          'custom-art storage put %s tentative %s/%s: %s',
          safe,
          attempt,
          MAX_RETRIES,
          lastError.message
        )
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt))
        }
      }
    }
    throw lastError || new Error(`Échec d'écriture storage: ${safe}`)
  }

  /** Lit un buffer (clé publique ou privée). */
  public static async get(key: string): Promise<Buffer> {
    const safe = CustomArtStorage.sanitize(key)
    if (CustomArtStorage.spacesConfigured()) {
      return Drive.use('spaces').get(safe)
    }
    // Local : on tente privé puis public
    for (const isPublic of [false, true]) {
      try {
        return await fs.readFile(CustomArtStorage.localPath(safe, isPublic))
      } catch {
        // essaye l'autre emplacement
      }
    }
    throw new Error(`Fichier introuvable en storage local: ${safe}`)
  }

  public static async exists(key: string): Promise<boolean> {
    const safe = CustomArtStorage.sanitize(key)
    try {
      if (CustomArtStorage.spacesConfigured()) {
        return await Drive.use('spaces').exists(safe)
      }
      for (const isPublic of [false, true]) {
        try {
          await fs.access(CustomArtStorage.localPath(safe, isPublic))
          return true
        } catch {
          // essaye l'autre emplacement
        }
      }
      return false
    } catch {
      return false
    }
  }

  /** Suppression best-effort (purge, nettoyage tmp). */
  public static async delete(key: string): Promise<void> {
    const safe = CustomArtStorage.sanitize(key)
    try {
      if (CustomArtStorage.spacesConfigured()) {
        await Drive.use('spaces').delete(safe)
      } else {
        for (const isPublic of [false, true]) {
          await fs.unlink(CustomArtStorage.localPath(safe, isPublic)).catch(() => {})
        }
      }
    } catch (error) {
      Logger.warn('custom-art storage delete %s: %s', safe, (error as Error).message)
    }
  }

  /** Neutralise toute tentative de traversée de chemin dans une clé. */
  private static sanitize(key: string): string {
    return key.replace(/\\/g, '/').replace(/\.\./g, '').replace(/\/+/g, '/').replace(/^\//, '')
  }

  private static localPath(safeKey: string, isPublic: boolean): string {
    return isPublic
      ? join(Application.publicPath('assets'), safeKey)
      : join(Application.tmpPath(), safeKey)
  }
}
