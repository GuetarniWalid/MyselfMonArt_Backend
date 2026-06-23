import Env from '@ioc:Adonis/Core/Env'
import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'
import CustomArtJob, { CustomArtMockup } from 'App/Models/CustomArtJob'
import CustomArtSession from 'App/Models/CustomArtSession'
import CustomArtStorage from './Storage'
import { affectedRows } from './db'
import MockupsReadyMailer from './MockupsReadyMailer'

// Moteur Photopea externe (PC exposé via tunnel Cloudflare) — même défaut que /publisher
const DEFAULT_ENGINE_URL = 'https://render.myselfmonart.com'
// Health-check léger : timeout court + cache — on ne ralentit jamais le flux client
// pour savoir si le PC est allumé (plan §8 : dégradation gracieuse)
const HEALTH_TIMEOUT_MS = 3000
const HEALTH_CACHE_MS = 60_000
// Un rendu Photopea peut prendre de longues secondes sur le PC (PSD lourds, smart objects)
const RENDER_TIMEOUT_MS = 120_000
// Téléchargement du fichier rendu depuis le moteur (jpg ~1-3 Mo via le tunnel)
const DOWNLOAD_TIMEOUT_MS = 30_000
// Jobs rattrapés par passage de scan backlog (le worker re-scanne toutes les 60 s)
const BACKLOG_BATCH = 10

/**
 * Mises en situation Photopea (M7, plan §8) — rendues APRÈS le reveal, en streaming :
 * le reveal client s'appuie sur le WebGL (instantané, aucune dépendance au PC), puis
 * les cellules mockups se remplissent au fil de l'eau via le polling GET /jobs/:uuid.
 *
 * Contrat moteur (public/publisher/app.js + extension-Midjourney/webapp/server.js) :
 *   GET  {RENDER_ENGINE_URL}/api/health -> { ok, engineReady }
 *   POST {RENDER_ENGINE_URL}/api/render { psd: '/mockups/...psd', image: dataURL,
 *        mockupContext } -> { success, url: '/uploads/xxx.jpg' } (relative au moteur)
 *
 * L'image insérée est l'aperçu ÉLU (résolution bridée à 1024 px, jamais la HD avant
 * achat — aucun watermark). Chaque rendu est rapatrié et stocké chez nous
 * (custom-art/jobs/<uuid>/mockup-N.jpg, public) : les URLs servies au client ne
 * dépendent jamais de la disponibilité du PC.
 *
 * Dégradation gracieuse : moteur down -> cellules laissées en 'pending' + flag
 * mockups_pending (backlog), re-scanné par le worker (60 s). Au rattrapage complet :
 * email « vos aperçus en situation sont prêts » si la session a un email.
 */
export default class MockupRenderer {
  /** Cache du health-check : { at, up } — évite un GET par job/scan. */
  private static health = { at: 0, up: false }
  /** Jobs en cours de rendu DANS CE PROCESS (flux immédiat et backlog ne se doublent pas). */
  private static inflight = new Set<number>()
  /** Un seul scan backlog à la fois par process (les rendus séquentiels peuvent être longs). */
  private static backlogRunning = false

  // --------------------------------------------------------------------------
  // Config + health-check
  // --------------------------------------------------------------------------

  private static engineBase(): string {
    return String(Env.get('RENDER_ENGINE_URL') || DEFAULT_ENGINE_URL).replace(/\/$/, '')
  }

  /** PSD configurés (env CUSTOM_ART_MOCKUP_PSDS, séparés par ';'). Vide = aucun rendu. */
  public static configuredPsds(): string[] {
    return String(Env.get('CUSTOM_ART_MOCKUP_PSDS') || '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  /**
   * Moteur joignable ? GET /api/health (timeout 3 s), résultat caché 60 s.
   * engineReady=false (Photopea en cours de boot sur le PC) compte comme down :
   * le backlog rattrapera dans la minute qui suit.
   */
  public static async engineUp(): Promise<boolean> {
    if (Date.now() - MockupRenderer.health.at < HEALTH_CACHE_MS) return MockupRenderer.health.up
    let up = false
    try {
      const rsp = await axios.get(`${MockupRenderer.engineBase()}/api/health`, {
        timeout: HEALTH_TIMEOUT_MS,
      })
      up = rsp.data?.ok === true && rsp.data?.engineReady !== false
    } catch {
      up = false
    }
    MockupRenderer.health = { at: Date.now(), up }
    return up
  }

  /** Échec réseau en plein rendu : le cache santé passe down immédiatement. */
  private static markEngineDown(): void {
    MockupRenderer.health = { at: Date.now(), up: false }
  }

  // --------------------------------------------------------------------------
  // Flux immédiat (post-ready)
  // --------------------------------------------------------------------------

  /**
   * Point d'entrée post-ready (worker + file admin) — fire-and-forget, ne throw jamais.
   * Initialise les cellules (skeletons visibles au polling dès le 1er save) puis rend
   * séquentiellement. Le flag mockups_pending est posé AVANT les rendus : un crash en
   * cours de route laisse le backlog rattraper (les cellules 'done' sont conservées).
   */
  public static async renderForJob(job: CustomArtJob): Promise<void> {
    const psds = MockupRenderer.configuredPsds()
    if (psds.length === 0) return
    if (MockupRenderer.inflight.has(job.id)) return
    MockupRenderer.inflight.add(job.id)
    try {
      if (!job.mockups || job.mockups.length === 0) {
        job.mockups = psds.map((psd) => ({ psd, status: 'pending' as const }))
      }
      job.mockupsPending = true
      await job.save()

      await MockupRenderer.renderPending(job)

      // Flux immédiat terminé sans reste : flag levé (claim conditionnel, cohérent avec
      // le backlog), SANS email — le client est encore devant le studio, les mockups
      // lui sont arrivés en streaming.
      if (!(job.mockups || []).some((m) => m.status === 'pending')) {
        await MockupRenderer.clearPendingFlag(job)
      }
    } catch (error) {
      // Erreur inattendue (storage…) : flag déjà posé -> le backlog retentera
      Logger.error('custom-art mockups uuid=%s: %s', job.uuid, (error as any)?.message || error)
    } finally {
      MockupRenderer.inflight.delete(job.id)
    }
  }

  // --------------------------------------------------------------------------
  // Backlog de rattrapage (appelé par le worker toutes les 60 s)
  // --------------------------------------------------------------------------

  /**
   * Rattrape les jobs ready dont des mockups restent pending (moteur down au reveal,
   * rendu interrompu). Au rattrapage COMPLET d'un job : flag levé atomiquement (une
   * seule instance gagne en cluster) + email « aperçus prêts » si la session a un email
   * (lien de reprise ca_job — touchpoint de relance bonus, plan §8).
   */
  public static async processBacklog(): Promise<void> {
    if (MockupRenderer.backlogRunning) return
    MockupRenderer.backlogRunning = true
    try {
      if (MockupRenderer.configuredPsds().length === 0) return
      if (!(await MockupRenderer.engineUp())) return

      const jobs = await CustomArtJob.query()
        .where('mockups_pending', true)
        .where('status', 'ready')
        .orderBy('id', 'asc')
        .limit(BACKLOG_BATCH)

      for (const job of jobs) {
        if (MockupRenderer.inflight.has(job.id)) continue
        MockupRenderer.inflight.add(job.id)
        try {
          const complete = await MockupRenderer.renderPending(job)
          if (!complete) continue // moteur retombé en cours de route : prochain scan

          // Claim atomique : en cluster PM2, une seule instance lève le flag ET notifie
          if (!(await MockupRenderer.clearPendingFlag(job))) continue
          await MockupRenderer.notifyMockupsReady(job)
        } catch (error) {
          Logger.error(
            'custom-art mockups rattrapage uuid=%s: %s',
            job.uuid,
            (error as any)?.message || error
          )
        } finally {
          MockupRenderer.inflight.delete(job.id)
        }
      }
    } finally {
      MockupRenderer.backlogRunning = false
    }
  }

  // --------------------------------------------------------------------------
  // Rendu séquentiel
  // --------------------------------------------------------------------------

  /**
   * Rend séquentiellement toutes les cellules encore 'pending' de job.mockups, en
   * poussant chaque résultat au fil de l'eau (un save par cellule -> visible au polling).
   * Retourne true si plus aucune cellule pending (toutes 'done' ou 'error').
   *
   * Classement des échecs :
   *  - le moteur a RÉPONDU en erreur (PSD introuvable, rendu KO) -> 'error' définitif ;
   *  - erreur réseau (PC éteint, tunnel coupé, timeout) -> cellule laissée 'pending',
   *    cache santé invalidé, on s'arrête là (le backlog reprendra).
   */
  private static async renderPending(job: CustomArtJob): Promise<boolean> {
    let cells: CustomArtMockup[] = [...(job.mockups || [])]
    const stillPending = () => cells.some((c) => c.status === 'pending')
    if (!stillPending()) return true

    if (!(await MockupRenderer.engineUp())) return false

    const candidates = job.candidates || []
    const chosen = job.chosenIndex !== null ? candidates[job.chosenIndex] : null
    if (!chosen) {
      // Pas de candidat élu (ne devrait pas arriver sur un job ready) : on solde en
      // 'error' pour ne pas faire tourner le backlog à vide.
      Logger.warn('custom-art mockups uuid=%s: aucun candidat élu, cellules soldées', job.uuid)
      cells = cells.map((c) => (c.status === 'pending' ? { ...c, status: 'error' as const } : c))
      job.mockups = cells
      await job.save()
      return true
    }

    // L'œuvre insérée = aperçu élu (résolution bridée) — jamais la HD avant achat
    const preview = await CustomArtStorage.get(chosen.previewPath)
    const dataUrl = `data:image/jpeg;base64,${preview.toString('base64')}`
    const base = MockupRenderer.engineBase()

    for (let i = 0; i < cells.length; i++) {
      if (cells[i].status !== 'pending') continue
      const psd = cells[i].psd
      const t0 = Date.now()
      try {
        const rsp = await axios.post(
          `${base}/api/render`,
          { psd, image: dataUrl, mockupContext: `custom-art:${job.uuid}` },
          { timeout: RENDER_TIMEOUT_MS }
        )
        if (!rsp.data?.success || !rsp.data?.url) {
          throw Object.assign(new Error(rsp.data?.error || 'rendu refusé par le moteur'), {
            response: rsp, // moteur joignable : échec définitif (même branche que les 4xx/5xx)
          })
        }

        // Rapatriement chez nous : l'URL servie au client ne dépend plus du PC
        const fileRsp = await axios.get(`${base}${rsp.data.url}`, {
          responseType: 'arraybuffer',
          timeout: DOWNLOAD_TIMEOUT_MS,
        })
        const key = `custom-art/jobs/${job.uuid}/mockup-${i}.jpg`
        await CustomArtStorage.put(key, Buffer.from(fileRsp.data), { isPublic: true })

        // Ménage best-effort du dossier uploads du moteur (le PC ne gonfle pas)
        const fname = String(rsp.data.url).split('/').pop()
        if (fname) {
          axios
            .delete(`${base}/api/upload/${encodeURIComponent(fname)}`, { timeout: 10_000 })
            .catch(() => {})
        }

        cells = cells.map((c, idx) =>
          idx === i ? { ...c, status: 'done' as const, url: CustomArtStorage.publicUrl(key) } : c
        )
        job.mockups = cells // réaffectation : Lucid ne détecte pas une mutation en place
        await job.save()
        Logger.info(
          'custom-art mockup uuid=%s %s/%s %ss',
          job.uuid,
          i + 1,
          cells.length,
          Math.round((Date.now() - t0) / 1000)
        )
      } catch (error) {
        const e = error as any
        if (e?.response) {
          // Le moteur a répondu (400/500…) : ce PSD ne passera pas mieux demain
          Logger.warn(
            'custom-art mockup uuid=%s psd=%s erreur moteur: %s',
            job.uuid,
            psd,
            e.response?.data?.error || e.message
          )
          cells = cells.map((c, idx) => (idx === i ? { ...c, status: 'error' as const } : c))
          job.mockups = cells
          await job.save()
        } else {
          // Réseau KO (PC éteint, tunnel coupé, timeout) : on garde 'pending' et on
          // s'arrête — le backlog (60 s) reprendra au retour du moteur
          Logger.warn(
            'custom-art mockup uuid=%s moteur injoignable (%s) — backlog',
            job.uuid,
            e?.message || e
          )
          MockupRenderer.markEngineDown()
          return false
        }
      }
    }

    return !stillPending()
  }

  // --------------------------------------------------------------------------
  // Helpers privés
  // --------------------------------------------------------------------------

  /**
   * Lève le flag mockups_pending par claim conditionnel (UPDATE ... WHERE pending=true) :
   * retourne true UNIQUEMENT pour l'instance qui a réellement levé le flag — c'est elle
   * (et elle seule) qui envoie l'éventuel email de rattrapage.
   */
  private static async clearPendingFlag(job: CustomArtJob): Promise<boolean> {
    const claimed = affectedRows(
      await Database.from('custom_art_jobs')
        .where('id', job.id)
        .where('mockups_pending', true)
        .update({ mockups_pending: false, updated_at: new Date() })
    )
    job.mockupsPending = false
    return claimed === 1
  }

  /**
   * Email « vos aperçus en situation sont prêts » (rattrapage uniquement) si la session
   * du job a un email et qu'au moins un mockup est rendu. Best-effort.
   */
  private static async notifyMockupsReady(job: CustomArtJob): Promise<void> {
    const done = (job.mockups || []).filter((m) => m.status === 'done' && m.url)
    if (done.length === 0) return

    const session = await CustomArtSession.find(job.sessionId)
    if (!session?.email) return

    const sent = await new MockupsReadyMailer().send({
      email: session.email,
      jobUuid: job.uuid,
      mockupUrls: done.map((m) => m.url as string),
    })
    if (sent) {
      Logger.info('custom-art mockups rattrapés + email envoyé uuid=%s', job.uuid)
    }
  }
}
