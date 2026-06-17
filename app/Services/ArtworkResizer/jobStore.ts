import Logger from '@ioc:Adonis/Core/Logger'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import ArtworkResizer from './index'
import DecorGenerator, { DecorOptions } from '../DecorGenerator'
import ArtworkInserter, { InsertOptions } from '../ArtworkInserter'
import MockupCleaner, { CleanOptions } from '../MockupCleaner'

/**
 * Stockage de jobs de redimensionnement sur disque + exécution en arrière-plan.
 *
 * POURQUOI : un rendu haute qualité peut être long (jadis ~120-180 s sur gpt-image-2 ;
 * encore des dizaines de secondes en 2K sur Gemini, et la marge ne coûte rien).
 * backend.myselfmonart.com est derrière Cloudflare, qui coupe toute requête dont
 * l'origine ne répond pas sous ~100s -> erreur 524. On NE PEUT donc PAS répondre
 * de façon synchrone. On lance le travail en arrière-plan et le front interroge
 * l'état via /api/resize-artwork/result (chaque appel est instantané, jamais de 524).
 */

type Target = 'portrait' | 'square' | 'landscape'
type Status = 'pending' | 'done' | 'error'
interface Job {
  status: Status
  image?: string
  scene?: string // décor uniquement : brief art-director utilisé (rejoué pour les autres ratios)
  error?: string
  createdAt: number
}

// 15 min : au-delà, un job sans résultat est considéré périmé (et nettoyé).
const TTL_MS = 15 * 60 * 1000

function dir(): string {
  return join(tmpdir(), 'mma-resize-jobs')
}
function file(id: string): string {
  return join(dir(), `${id.replace(/[^a-zA-Z0-9-]/g, '')}.json`)
}

async function safeWrite(path: string, content: string): Promise<void> {
  // écriture atomique : on écrit dans un .tmp puis on renomme (évite de lire un fichier à moitié écrit)
  const tmp = `${path}.${randomUUID()}.tmp`
  await fs.writeFile(tmp, content)
  await fs.rename(tmp, path)
}

export async function create(id: string): Promise<void> {
  await fs.mkdir(dir(), { recursive: true })
  const job: Job = { status: 'pending', createdAt: Date.now() }
  await safeWrite(file(id), JSON.stringify(job))
  cleanup().catch(() => {}) // nettoyage best-effort des vieux jobs
}

export async function read(id: string): Promise<Job | null> {
  try {
    const raw = await fs.readFile(file(id), 'utf8')
    const job = JSON.parse(raw) as Job
    if (job.status === 'pending' && Date.now() - job.createdAt > TTL_MS) {
      return {
        status: 'error',
        error: 'Le redimensionnement a expiré. Réessaye.',
        createdAt: job.createdAt,
      }
    }
    return job
  } catch {
    return null
  }
}

export async function remove(id: string): Promise<void> {
  await fs.unlink(file(id)).catch(() => {})
}

async function finish(
  id: string,
  patch: { status: Status; image?: string; scene?: string; error?: string }
): Promise<void> {
  try {
    const raw = await fs.readFile(file(id), 'utf8').catch(() => null)
    const base: Job = raw ? (JSON.parse(raw) as Job) : { status: 'pending', createdAt: Date.now() }
    await safeWrite(file(id), JSON.stringify({ ...base, ...patch }))
  } catch (e) {
    Logger.error('jobStore.finish id=%s: %s', id, (e as Error).message)
  }
}

// Supprime les fichiers de jobs plus vieux que le TTL (évite l'accumulation).
export async function cleanup(): Promise<void> {
  try {
    const names = await fs.readdir(dir()).catch(() => [] as string[])
    const now = Date.now()
    for (const n of names) {
      const p = join(dir(), n)
      try {
        const job = JSON.parse(await fs.readFile(p, 'utf8')) as Job
        if (now - job.createdAt > TTL_MS) await fs.unlink(p).catch(() => {})
      } catch {
        await fs.unlink(p).catch(() => {}) // fichier illisible/corrompu -> on jette
      }
    }
  } catch {
    // best-effort
  }
}

const inflight = new Set<Promise<void>>()
// Plafond de jobs simultanés : garde-fou anti-emballement (double-clic, boucle abusive).
// La génération est payante et lourde (sharp + buffers) -> on refuse au-delà plutôt que de tout lancer.
const MAX_INFLIGHT = 8

/**
 * Lance le redimensionnement en arrière-plan. NE PAS attendre cette fonction
 * dans le controller (sinon Cloudflare coupe à ~100s). Le résultat est écrit
 * dans le fichier de job, lu ensuite via read().
 */
export function start(
  id: string,
  image: string,
  target: Target,
  quality: 'low' | 'high',
  mode: 'recompose' | 'enhance' = 'recompose'
): void {
  if (inflight.size >= MAX_INFLIGHT) {
    finish(id, {
      status: 'error',
      error: 'Service de génération occupé. Réessaie dans quelques secondes.',
    }).catch(() => {})
    Logger.warn('resize REFUSED job=%s (inflight=%s >= %s)', id, inflight.size, MAX_INFLIGHT)
    return
  }
  const p = (async () => {
    const t0 = Date.now()
    try {
      const resizer = new ArtworkResizer()
      const resized = await resizer.resize(image, target, quality, mode)
      await finish(id, { status: 'done', image: resized })
      Logger.info('resize OK job=%s q=%s %ss', id, quality, Math.round((Date.now() - t0) / 1000))
    } catch (error) {
      await finish(id, { status: 'error', error: mapResizeError(error) })
      Logger.error(
        'resize FAIL job=%s q=%s %ss: %s',
        id,
        quality,
        Math.round((Date.now() - t0) / 1000),
        (error && (error as any).message) || String(error)
      )
    }
  })()
  inflight.add(p)
  p.finally(() => inflight.delete(p))
}

/**
 * Lance la génération d'un DÉCOR (Nano Banana 2/Gemini) en arrière-plan. Même réserve que start() :
 * NE PAS attendre (le travail tourne détaché, le résultat est écrit dans le fichier de job).
 */
export function startDecor(
  id: string,
  artwork: string,
  target: Target,
  opts: DecorOptions = {}
): void {
  if (inflight.size >= MAX_INFLIGHT) {
    finish(id, {
      status: 'error',
      error: 'Service de génération occupé. Réessaie dans quelques secondes.',
    }).catch(() => {})
    Logger.warn('decor REFUSED job=%s (inflight=%s >= %s)', id, inflight.size, MAX_INFLIGHT)
    return
  }
  const p = (async () => {
    const t0 = Date.now()
    try {
      const generator = new DecorGenerator()
      const { image, scene } = await generator.generate(artwork, target, opts)
      await finish(id, { status: 'done', image, scene })
      Logger.info('decor OK job=%s %ss', id, Math.round((Date.now() - t0) / 1000))
    } catch (error) {
      await finish(id, { status: 'error', error: mapResizeError(error) })
      Logger.error(
        'decor FAIL job=%s %ss: %s',
        id,
        Math.round((Date.now() - t0) / 1000),
        (error && (error as any).message) || String(error)
      )
    }
  })()
  inflight.add(p)
  p.finally(() => inflight.delete(p))
}

/**
 * Lance l'INSERTION de l'oeuvre dans le décor (Nano Banana/Gemini) en arrière-plan. Même réserve :
 * NE PAS attendre dans le controller (le travail tourne détaché, le résultat est écrit dans le job).
 */
export function startInsert(
  id: string,
  decor: string,
  artwork: string,
  target: Target,
  opts: InsertOptions = {}
): void {
  if (inflight.size >= MAX_INFLIGHT) {
    finish(id, {
      status: 'error',
      error: 'Service de génération occupé. Réessaie dans quelques secondes.',
    }).catch(() => {})
    Logger.warn('insert REFUSED job=%s (inflight=%s >= %s)', id, inflight.size, MAX_INFLIGHT)
    return
  }
  const p = (async () => {
    const t0 = Date.now()
    try {
      const inserter = new ArtworkInserter()
      const out = await inserter.insert(decor, artwork, target, opts)
      await finish(id, { status: 'done', image: out })
      Logger.info('insert OK job=%s %ss', id, Math.round((Date.now() - t0) / 1000))
    } catch (error) {
      await finish(id, { status: 'error', error: mapResizeError(error) })
      Logger.error(
        'insert FAIL job=%s %ss: %s',
        id,
        Math.round((Date.now() - t0) / 1000),
        (error && (error as any).message) || String(error)
      )
    }
  })()
  inflight.add(p)
  p.finally(() => inflight.delete(p))
}

/**
 * Lance le NETTOYAGE d'une photo de mockup importée (Nano Banana 2) en arrière-plan. Même réserve :
 * NE PAS attendre dans le controller (le travail tourne détaché, le résultat est écrit dans le job).
 */
export function startClean(
  id: string,
  image: string,
  target: Target,
  opts: CleanOptions = {}
): void {
  if (inflight.size >= MAX_INFLIGHT) {
    finish(id, {
      status: 'error',
      error: 'Service de génération occupé. Réessaie dans quelques secondes.',
    }).catch(() => {})
    Logger.warn('clean REFUSED job=%s (inflight=%s >= %s)', id, inflight.size, MAX_INFLIGHT)
    return
  }
  const p = (async () => {
    const t0 = Date.now()
    try {
      const cleaner = new MockupCleaner()
      const out = await cleaner.clean(image, target, opts)
      await finish(id, { status: 'done', image: out })
      Logger.info('clean OK job=%s %ss', id, Math.round((Date.now() - t0) / 1000))
    } catch (error) {
      await finish(id, { status: 'error', error: mapResizeError(error) })
      Logger.error(
        'clean FAIL job=%s %ss: %s',
        id,
        Math.round((Date.now() - t0) / 1000),
        (error && (error as any).message) || String(error)
      )
    }
  })()
  inflight.add(p)
  p.finally(() => inflight.delete(p))
}

// Traduit une erreur OpenAI/Gemini/réseau en message clair pour l'utilisateur.
export function mapResizeError(error: any): string {
  // Un service peut fournir un message utilisateur DÉJÀ finalisé (FR, actionnable) : on le respecte tel
  // quel plutôt que de le ré-écraser par un générique (ex. l'insertion qui détaille la raison du refus).
  if (error?.userMessage) return String(error.userMessage)

  const status = error?.status || error?.response?.status
  const code = error?.code || error?.error?.code || ''
  const msg = (error?.message || '').toLowerCase()

  if (
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNABORTED'
  ) {
    return 'La génération a mis trop de temps côté service. Réessaye dans un instant.'
  }
  if (status === 429 || code === 'rate_limit_exceeded') {
    return 'Trop de demandes en même temps. Patiente quelques secondes puis réessaye.'
  }
  if (
    msg.includes('blocked') ||
    msg.includes('prohibited') ||
    msg.includes('image_safety') ||
    code === 'PROHIBITED_CONTENT'
  ) {
    return 'Le rendu a été refusé par la modération (réessaie ou change d’œuvre).'
  }
  if (
    status === 400 &&
    (msg.includes('safety') ||
      msg.includes('moderation') ||
      msg.includes('content policy') ||
      code === 'moderation_blocked' ||
      code === 'content_policy_violation')
  ) {
    return "L'image a été refusée par la modération du service de génération. Essaie avec une autre œuvre."
  }
  if (status === 401 || status === 403) {
    return "Problème d'authentification avec le service de génération (clé API)."
  }
  if (typeof status === 'number' && status >= 500) {
    return 'Le service de génération est momentanément indisponible. Réessaye.'
  }
  return error?.message || 'Échec du redimensionnement.'
}
