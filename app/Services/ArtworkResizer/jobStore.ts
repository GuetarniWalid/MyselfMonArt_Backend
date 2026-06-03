import Logger from '@ioc:Adonis/Core/Logger'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import ArtworkResizer from './index'

/**
 * Stockage de jobs de redimensionnement sur disque + exécution en arrière-plan.
 *
 * POURQUOI : le redimensionnement haute qualité (gpt-image-2) prend ~120-180s.
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
  patch: { status: Status; image?: string; error?: string }
): Promise<void> {
  try {
    const raw = await fs.readFile(file(id), 'utf8').catch(() => null)
    const base: Job = raw ? (JSON.parse(raw) as Job) : { status: 'pending', createdAt: Date.now() }
    await safeWrite(file(id), JSON.stringify({ ...base, ...patch }))
  } catch (e) {
    Logger.error('resize jobStore.finish id=%s: %s', id, (e as Error).message)
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
// gpt-image-2 est payant et lourd (sharp + buffers) -> on refuse au-delà plutôt que de tout lancer.
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

// Traduit une erreur OpenAI/réseau en message clair pour l'utilisateur.
export function mapResizeError(error: any): string {
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
    status === 400 &&
    (msg.includes('safety') ||
      msg.includes('moderation') ||
      msg.includes('content policy') ||
      code === 'moderation_blocked' ||
      code === 'content_policy_violation')
  ) {
    return "L'image a été refusée par la modération d'OpenAI. Essaie avec une autre œuvre."
  }
  if (status === 401 || status === 403) {
    return "Problème d'authentification avec le service de génération (clé API)."
  }
  if (typeof status === 'number' && status >= 500) {
    return 'Le service de génération est momentanément indisponible. Réessaye.'
  }
  return error?.message || 'Échec du redimensionnement.'
}
