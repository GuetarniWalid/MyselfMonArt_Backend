import Env from '@ioc:Adonis/Core/Env'
import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'
import sharp from 'sharp'
import { DateTime } from 'luxon'
import CustomArtJob, { CustomArtCandidate } from 'App/Models/CustomArtJob'
import CustomArtTeam from 'App/Models/CustomArtTeam'
import { mapResizeError } from 'App/Services/ArtworkResizer/jobStore'
import CustomArtStorage from './Storage'
import { affectedRows } from './db'
import MockupRenderer from './MockupRenderer'
import PreviewService from './PreviewService'
import { JUDGE_EST_COST_EUR } from './JudgeService'
import JudgeRunner from './JudgeRunner'
import ReviewMailer from './ReviewMailer'
import { buildMasterPrompt } from './prompt'
import { resolveProviderChain, resolveForcedProvider, fakeProviderEnabled } from './providers'
import type { CustomArtProvider, GenerateParams, GenerateResult } from './providers/types'

// Cadence de scrutation des jobs pending (le polling client est à 2 s aussi)
const POLL_MS = 2000
// Jobs traités en parallèle (chaque job lance 3 générations + 3 jugements)
const MAX_INFLIGHT_JOBS = 2
// 3 candidats par round (plan §5)
const CANDIDATES_PER_ROUND = 3
// Round 2 silencieux si 0 pass, puis fallback artiste (plan §5 + décision §0.15)
const MAX_ROUNDS = 2
// Ancienneté minimale (updated_at) avant de considérer un job generating/judging comme
// orphelin : en cluster PM2 (>1 instance), un sibling vivant peut traiter un job récent.
const ORPHAN_MIN_AGE_MIN = 10
// Re-scan périodique des orphelins (un crash ne doit pas laisser un job coincé jusqu'au
// prochain redéploiement)
const ORPHAN_SCAN_MS = 60_000
// Re-scan du backlog mockups Photopea (plan §8) : rattrape les mises en situation
// laissées pending quand le moteur (PC) était down au moment du reveal
const MOCKUP_BACKLOG_SCAN_MS = 60_000
// Plafond de relances orphelines PAR JOB : au-delà, le job part en manual_review au lieu
// de repartir en pending. Garde-fou anti-boucle infinie si un job crashe systématiquement
// le process (SIGSEGV libvips non rattrapable par try/catch) — incident coûts 13/06.
const MAX_RECOVERIES = 1
// Plafond de coût quotidien (€) si CUSTOM_ART_DAILY_COST_CAP_EUR absent — disjoncteur du
// worker (en plus du cap à la création de job dans le contrôleur).
const DAILY_COST_CAP_FALLBACK = 30
// Jugements d'un round menés EN PARALLÈLE, chacun dans un process enfant isolé. Plafond de
// concurrence (défaut 3 = les 3 candidats jugés ensemble) : il borne la MÉMOIRE (N enfants
// node+sharp simultanés dans le conteneur app). Surchargeable par CUSTOM_ART_JUDGE_CONCURRENCY
// pour redescendre sans redéploiement si le conteneur tangente l'OOM.
const JUDGE_CONCURRENCY_DEFAULT = 3

interface JobInputs {
  photoBuffer: Buffer
  kitRefBuffers: Buffer[]
  /** URLs des réfs maillot (mêmes index que kitRefBuffers) : annonce FACE/DOS au prompt/juge */
  kitRefFiles: string[]
  sceneRefBuffer: Buffer | null
  teamName: string
  /** Notes de fidélité maillot (décision §0.13) — prompt de génération + juge */
  fidelityNotes: string | null
}

/** Issue d'une génération de candidat (toute la chaîne de providers tentée). */
type GenerationOutcome =
  | { kind: 'ok'; result: GenerateResult; provider: CustomArtProvider }
  | { kind: 'refused' } // toute la chaîne a refusé (modération / filtre d'entrée IMAGE_SAFETY)
  | { kind: 'failed' } // au moins un échec technique (timeout, erreur API) sans image produite

/**
 * Worker in-process DB-backed (plan §2) : consomme les custom_art_jobs `pending`,
 * lance 3 générations en parallèle, fait juger chaque candidat par Claude vision
 * (calibration §0.14 : gate dur compteurs/defect + score de suspicion), range les
 * candidats (meilleur score PUIS moindre suspicion) et révèle le mieux classé.
 *
 * Chaîne de providers (arbitrage bench M1, 2026-06-11) :
 *   round 1 = chaîne complète (primaire gemini-3.1-flash-image en tête),
 *   round 2 silencieux = chaîne de secours (gemini-3-pro-image puis 2.5-flash).
 * Photo refusée par TOUS les modèles (IMAGE_SAFETY) -> 1 round de rattrapage avec la
 * chaîne de secours (le dernier maillon 2.5-flash a le filtre d'entrée le moins strict).
 * Toujours rien (ou 2 rounds 0 pass) -> status=manual_review (fallback artiste, §0.15)
 * + email de notification à Walid (file admin /custom-art-review).
 *
 * Démarré par AppProvider.ready() (process web uniquement). Sûr en cluster PM2
 * (instances > 1) : chaque job pending est réclamé par un UPDATE conditionnel
 * (un seul process gagne, pas de double génération), et la récupération des
 * orphelins `generating|judging` (crash/redeploy) ne touche que les jobs dont
 * updated_at est plus vieux que ORPHAN_MIN_AGE_MIN (pas de vol de jobs vivants).
 */
export default class CustomArtWorker {
  private static started = false
  private static inflight = new Set<Promise<void>>()
  private static sceneRefCache: Buffer | null = null
  private static sceneRefFetched = false
  private static lastOrphanScanAt = 0
  private static lastMockupScanAt = 0

  public static start(): void {
    if (CustomArtWorker.started) return

    // Kill-switch d'urgence (env + restart, sans déploiement) : coupe tout traitement de
    // job. Posé suite à l'incident coûts du 13/06 (juge Opus en boucle).
    if (Env.get('CUSTOM_ART_WORKER_DISABLED')) {
      Logger.warn(
        'custom-art worker DÉSACTIVÉ (CUSTOM_ART_WORKER_DISABLED=true) — aucun job traité'
      )
      return
    }

    // Une SEULE instance lance le worker. En PM2 cluster (instances:'max'), AppProvider
    // démarrerait sinon une boucle + un re-scan d'orphelins par CPU (~12). Le claim DB est
    // déjà atomique (pas de double génération), mais inutile de multiplier les re-scans —
    // c'est ce qui a amplifié la boucle du 13/06. NODE_APP_INSTANCE est posé par PM2
    // ('0' = première instance) ; absent hors PM2 (dev) -> on démarre.
    const pm2Instance = process.env.NODE_APP_INSTANCE
    if (pm2Instance !== undefined && pm2Instance !== '0') {
      Logger.info(
        'custom-art worker non démarré sur cette instance (NODE_APP_INSTANCE=%s)',
        pm2Instance
      )
      return
    }

    CustomArtWorker.started = true
    // Durcissement sharp/libvips en conteneur (SIGSEGV au premier job prod le 12/06,
    // pendant la passe anatomie multi-crops du juge) : un seul thread vips par process
    // cluster + cache d'opérations désactivé. Quelques % plus lent, mais stable sous
    // PM2 multi-instances.
    sharp.concurrency(1)
    sharp.cache(false)
    Logger.info(
      'custom-art worker démarré (poll %sms, inflight max %s)',
      POLL_MS,
      MAX_INFLIGHT_JOBS
    )
    CustomArtWorker.recoverOrphans()
      .catch((e) => Logger.error('custom-art recover: %s', e?.message || e))
      .finally(() => CustomArtWorker.loop())
  }

  /**
   * Re-scan (boot + périodique) : les jobs coincés en generating/judging sont relancés —
   * MAIS avec un plafond PAR JOB (MAX_RECOVERIES). Au-delà, le job part en manual_review
   * (terminal) au lieu de repartir en pending : un job qui crashe systématiquement le
   * process (SIGSEGV libvips, non rattrapable par le try/catch de process()) ne peut plus
   * boucler indéfiniment et re-facturer génération + jugement (incident coûts 13/06).
   *
   * UPDATE atomique unique (CASE MySQL) -> sûr en cluster : `recovery_count` est incrémenté
   * et le statut basculé en une seule requête, quel que soit le nombre d'instances.
   * Seuil d'ancienneté sur updated_at : un job traité activement par un sibling est sauvé
   * à chaque transition, donc jamais assez vieux pour être volé ici.
   */
  private static async recoverOrphans(): Promise<void> {
    const staleBefore = DateTime.now()
      .minus({ minutes: ORPHAN_MIN_AGE_MIN })
      .toSQL({ includeOffset: false }) as string
    const result = await Database.rawQuery(
      `UPDATE custom_art_jobs
       SET recovery_count = recovery_count + 1,
           status = IF(recovery_count + 1 > :max, 'manual_review', 'pending'),
           error = IF(recovery_count + 1 > :max, :reason, error),
           updated_at = NOW()
       WHERE status IN ('generating', 'judging') AND updated_at < :stale`,
      {
        max: MAX_RECOVERIES,
        reason:
          'Génération interrompue plusieurs fois (incident technique). Notre équipe la réalise à la main.',
        stale: staleBefore,
      }
    )
    const recovered = result?.[0]?.affectedRows ?? 0
    if (recovered > 0) {
      Logger.warn(
        'custom-art: %s job(s) orphelin(s) traité(s) (inactifs > %s min ; >%s relances -> manual_review)',
        recovered,
        ORPHAN_MIN_AGE_MIN,
        MAX_RECOVERIES
      )
    }
  }

  /** Boucle de scrutation : récursive (setTimeout) pour ne jamais s'empiler. */
  private static loop(): void {
    setTimeout(async () => {
      try {
        await CustomArtWorker.tick()
      } catch (error) {
        Logger.error('custom-art worker tick: %s', (error as any)?.message || error)
      } finally {
        CustomArtWorker.loop()
      }
    }, POLL_MS)
  }

  private static async tick(): Promise<void> {
    // Re-scan périodique des orphelins (un crash d'instance ne bloque pas les jobs)
    if (Date.now() - CustomArtWorker.lastOrphanScanAt > ORPHAN_SCAN_MS) {
      CustomArtWorker.lastOrphanScanAt = Date.now()
      await CustomArtWorker.recoverOrphans()
    }

    // Rattrapage du backlog mockups (60 s) — fire-and-forget : les rendus séquentiels
    // peuvent être longs, le tick de 2 s ne doit pas attendre (garde interne anti-doublon)
    if (Date.now() - CustomArtWorker.lastMockupScanAt > MOCKUP_BACKLOG_SCAN_MS) {
      CustomArtWorker.lastMockupScanAt = Date.now()
      MockupRenderer.processBacklog().catch((e) =>
        Logger.error('custom-art mockups backlog: %s', e?.message || e)
      )
    }

    while (CustomArtWorker.inflight.size < MAX_INFLIGHT_JOBS) {
      const job = await CustomArtJob.query().where('status', 'pending').orderBy('id', 'asc').first()
      if (!job) return

      // Verrou DB : claim conditionnel. Si plusieurs process web tournent (PM2 cluster),
      // un seul gagne le job ; les perdants passent au suivant (pas de double génération).
      const claimed = affectedRows(
        await Database.from('custom_art_jobs')
          .where('id', job.id)
          .where('status', 'pending')
          .update({ status: 'generating', updated_at: new Date() })
      )
      if (claimed !== 1) continue

      job.status = 'generating'

      const p = CustomArtWorker.process(job)
        .catch((e) => Logger.error('custom-art process uuid=%s: %s', job.uuid, e?.message || e))
        .then(() => undefined)
      CustomArtWorker.inflight.add(p)
      p.finally(() => CustomArtWorker.inflight.delete(p))
    }
  }

  /**
   * Disjoncteur de dépense : somme des coûts des jobs du jour vs plafond quotidien
   * (CUSTOM_ART_DAILY_COST_CAP_EUR). Bloque le worker AVANT de générer/juger un job — en
   * plus du cap à la création de job dans le contrôleur — pour qu'aucun emballement (boucle
   * orpheline résiduelle, afflux) ne dépasse durablement le plafond. Best-effort : en cas
   * d'erreur DB on n'empêche pas le traitement (le cap contrôleur reste la 1re barrière).
   */
  private static async dailyCostExceeded(): Promise<boolean> {
    try {
      const cap = Number(Env.get('CUSTOM_ART_DAILY_COST_CAP_EUR')) || DAILY_COST_CAP_FALLBACK
      const startOfDay = DateTime.now().startOf('day').toSQL({ includeOffset: false }) as string
      const rows = await Database.from('custom_art_jobs')
        .where('created_at', '>=', startOfDay)
        .select('costs')
      const total = rows.reduce((sum, r) => {
        try {
          const c = typeof r.costs === 'string' ? JSON.parse(r.costs) : r.costs
          return sum + (c?.totalEur || 0)
        } catch {
          return sum
        }
      }, 0)
      if (total >= cap) {
        Logger.warn(
          'custom-art DISJONCTEUR coût: %s€ >= %s€ — traitement suspendu',
          total.toFixed(2),
          cap
        )
        return true
      }
      return false
    } catch {
      return false
    }
  }

  private static async process(job: CustomArtJob): Promise<void> {
    const t0 = Date.now()
    try {
      // Disjoncteur de dépense : si le plafond du jour est atteint, on ne génère/juge pas
      // (le job bascule en revue manuelle plutôt que d'alimenter une dérive de coûts).
      if (await CustomArtWorker.dailyCostExceeded()) {
        await CustomArtWorker.toManualReview(
          job,
          '',
          'Plafond de coût quotidien atteint — bascule en revue manuelle.',
          t0
        )
        return
      }

      const inputs = await CustomArtWorker.loadInputs(job)

      // Chaîne de providers : imposée depuis la file admin (« relancer avec X »), sinon
      // chaîne configurée/défauts bench. Round 2 = chaîne de secours (sans le primaire).
      let fullChain: CustomArtProvider[]
      if (job.forcedProvider) {
        const forced = resolveForcedProvider(job.forcedProvider)
        if (!forced) {
          throw new Error(`Provider imposé introuvable ou non configuré: ${job.forcedProvider}`)
        }
        fullChain = [forced]
      } else {
        fullChain = resolveProviderChain()
      }
      if (fullChain.length === 0) {
        throw new Error('Aucun provider de génération configuré (clés API absentes).')
      }
      const fallbackChain = fullChain.length > 1 ? fullChain.slice(1) : fullChain

      // Un seul round de rattrapage si la photo est refusée par tous les modèles
      let safetyRetryUsed = false

      while (true) {
        const chain = job.round >= 2 || safetyRetryUsed ? fallbackChain : fullChain

        job.status = 'generating'
        await job.save()

        // 3 générations en parallèle, chacune avec fallback automatique sur échec/refus
        const generations = await Promise.all(
          Array.from({ length: CANDIDATES_PER_ROUND }, () =>
            CustomArtWorker.generateOne(chain, inputs, job)
          )
        )
        const produced = generations.filter(
          (g): g is Extract<GenerationOutcome, { kind: 'ok' }> => g.kind === 'ok'
        )
        const allRefused = produced.length === 0 && generations.every((g) => g.kind === 'refused')

        // Photo refusée par TOUS les modèles (filtre d'entrée type IMAGE_SAFETY) :
        // 1 round de rattrapage avec la chaîne de secours (la modération est en partie
        // stochastique, et le dernier maillon a le filtre le moins strict).
        if (allRefused && !safetyRetryUsed) {
          safetyRetryUsed = true
          Logger.warn(
            'custom-art uuid=%s photo refusée par toute la chaîne — rattrapage avec la chaîne de secours',
            job.uuid
          )
          continue
        }
        if (produced.length === 0 && allRefused) {
          await CustomArtWorker.toManualReview(
            job,
            inputs.teamName,
            'Photo refusée par les filtres de tous les modèles (IMAGE_SAFETY)',
            t0
          )
          return
        }

        job.status = 'judging'
        await job.save()

        if (produced.length > 0) {
          await CustomArtWorker.judgeAndStore(job, inputs, produced)
        }

        const candidates = job.candidates || []
        const best = CustomArtWorker.rankCandidates(candidates)
        await job.save()

        if (best && best.pass) {
          job.chosenIndex = candidates.indexOf(best)
          job.revealedCount = 1
          job.provider = best.provider
          job.status = 'ready'
          job.error = null
          // Durée réelle création -> ready : alimente l'estimation glissante de la barre
          // du studio (JobEstimate). Posée UNIQUEMENT ici (passage ready automatique) —
          // les jobs ready à la main (file artiste) gardent NULL et sont exclus de la stat.
          if (job.createdAt) {
            job.readyDurationMs = Math.max(0, Math.round(Date.now() - job.createdAt.toMillis()))
          }
          await job.save()
          Logger.info(
            'custom-art READY uuid=%s round=%s score=%s suspicion=%s provider=%s %ss',
            job.uuid,
            job.round,
            best.score,
            best.suspicion ?? 0,
            best.provider,
            Math.round((Date.now() - t0) / 1000)
          )
          // Mises en situation Photopea (M7, plan §8) : post-reveal, en tâche de fond —
          // le flux client ne dépend jamais du moteur (le reveal s'appuie sur le WebGL).
          // renderForJob ne throw jamais (dégradation gracieuse + backlog interne).
          // Mode factice (M10) : pas de mockups — le moteur (PC) n'est pas le sujet des
          // tests caps/charge, et on n'accumule pas de backlog artificiel.
          if (!fakeProviderEnabled()) {
            void MockupRenderer.renderForJob(job)
          }
          return
        }

        if (job.round >= MAX_ROUNDS) {
          // 2 rounds sans pass : fallback artiste (décision §0.15), plus de status failed
          await CustomArtWorker.toManualReview(
            job,
            inputs.teamName,
            `Aucun candidat validé par le juge après ${MAX_ROUNDS} rounds (${candidates.length} candidat(s) jugé(s))`,
            t0
          )
          return
        }

        // Round 2 silencieux : le front continue d'afficher le storytelling d'attente
        job.round = job.round + 1
        await job.save()
        Logger.warn('custom-art round 2 silencieux uuid=%s (0 pass au round 1)', job.uuid)
      }
    } catch (error) {
      job.status = 'failed'
      job.error = mapResizeError(error)
      await job.save().catch(() => {})
      Logger.error(
        'custom-art FAIL uuid=%s %ss: %s',
        job.uuid,
        Math.round((Date.now() - t0) / 1000),
        (error as any)?.message || error
      )
    }
  }

  /**
   * Bascule en manual_review (fallback artiste, décision §0.15) : la raison technique
   * est gardée dans `error` pour la file admin (le client, lui, voit l'écran soigné
   * « Faire réaliser par un artiste ») + notification email à Walid (best-effort).
   */
  private static async toManualReview(
    job: CustomArtJob,
    teamName: string,
    reason: string,
    t0: number
  ): Promise<void> {
    job.status = 'manual_review'
    job.error = reason
    await job.save()
    Logger.warn(
      'custom-art MANUAL_REVIEW uuid=%s %ss: %s',
      job.uuid,
      Math.round((Date.now() - t0) / 1000),
      reason
    )
    await new ReviewMailer().send({ job, teamName, reason }).catch(() => {})
  }

  /**
   * Une génération : parcourt la chaîne de providers (fallback automatique sur échec
   * OU refus modération). Le prompt est reconstruit PAR provider : Gemini 3.x refuse
   * toute image de référence contenant une personne -> la réf scène est retirée et la
   * pose est décrite uniquement en texte (acceptsPersonRefs).
   */
  private static async generateOne(
    providers: CustomArtProvider[],
    inputs: JobInputs,
    job: CustomArtJob
  ): Promise<GenerationOutcome> {
    let sawError = false
    for (const provider of providers) {
      try {
        const useScene = provider.acceptsPersonRefs && Boolean(inputs.sceneRefBuffer)
        const params: GenerateParams = {
          photoBuffer: inputs.photoBuffer,
          kitRefBuffers: inputs.kitRefBuffers,
          sceneRefBuffer: useScene ? inputs.sceneRefBuffer : null,
          prompt: buildMasterPrompt({
            teamName: inputs.teamName,
            playerName: job.playerName,
            playerNumber: job.playerNumber,
            kitRefFiles: inputs.kitRefFiles,
            useSceneRef: useScene,
            fidelityNotes: inputs.fidelityNotes,
          }),
          playerName: job.playerName,
          playerNumber: job.playerNumber,
        }

        const result = await provider.generate(params)
        if (result.providerMeta.refused || !result.imageBuffer) {
          Logger.warn(
            'custom-art uuid=%s provider=%s refus: %s',
            job.uuid,
            provider.key,
            result.providerMeta.refused
          )
          continue // fallback automatique
        }
        job.addCost('generation', result.providerMeta.estCostEur, provider.key)
        return { kind: 'ok', result, provider }
      } catch (error) {
        sawError = true
        Logger.warn(
          'custom-art uuid=%s provider=%s échec: %s',
          job.uuid,
          provider.key,
          (error as any)?.message || error
        )
        // fallback automatique sur le provider suivant
      }
    }
    // Toute la chaîne épuisée : 'refused' UNIQUEMENT si aucun échec technique — c'est le
    // signal « photo refusée partout » qui déclenche le rattrapage puis le fallback artiste.
    return sawError ? { kind: 'failed' } : { kind: 'refused' }
  }

  /** Juge chaque candidat produit, uploade HD privé + aperçu réduit public. */
  private static async judgeAndStore(
    job: CustomArtJob,
    inputs: JobInputs,
    produced: Array<{ result: GenerateResult; provider: CustomArtProvider }>
  ): Promise<void> {
    // JudgeRunner = jugement isolé en process enfant (anti-SIGSEGV, voir JudgeRunner.ts) :
    // si le jugement d'un candidat crashe l'enfant, l'erreur est rattrapée plus bas
    // (verdict non-pass) et le worker survit — pas de job coincé, pas de boucle.
    const judge = new JudgeRunner()
    const existing = job.candidates || []

    // Jugement PARALLÈLE plafonné. Chaque jugement tourne dans un PROCESS ENFANT isolé
    // (JudgeRunner -> judge-child.js, sharp en concurrency(1)) : le SIGSEGV du 13/06 venait
    // de pipelines libvips concurrentes DANS LE PROCESS PRINCIPAL — ici le worker ne fait
    // AUCUN sharp, et chaque enfant est indépendant. Le seul coût de la concurrence est la
    // MÉMOIRE (N enfants node+images), d'où le plafond CUSTOM_ART_JUDGE_CONCURRENCY et le
    // conteneur app remonté à 768 Mo (marge libérée par la suppression du n8n). Un enfant
    // tué par l'OOM-killer -> ce candidat non-pass (rattrapé ci-dessous), le worker survit.
    // Le classement (best-of-3) reste identique : on attend les N verdicts avant de ranger.
    const concurrency = Number(Env.get('CUSTOM_ART_JUDGE_CONCURRENCY')) || JUDGE_CONCURRENCY_DEFAULT
    const judged = await CustomArtWorker.mapWithConcurrency(
      produced,
      concurrency,
      async (item, i): Promise<CustomArtCandidate | null> => {
        const { result, provider } = item
        const buffer = result.imageBuffer as Buffer
        const index = existing.length + i

        let verdict: any
        // L'aperçu est produit DANS l'enfant (zéro sharp côté worker sur le chemin
        // réel) ; null si le juge enfant a crashé (candidat non-pass, jamais révélé).
        let preview: Buffer | null = null
        if (fakeProviderEnabled()) {
          // Mode factice (M10/M12) : jugement court-circuité, verdict « pass » sans appel
          // Claude (payant). Petites images statiques du bench -> aperçu en main process OK.
          verdict = CustomArtWorker.fakeVerdict(index)
          preview = await PreviewService.makePreview(buffer)
        } else {
          try {
            const outcome = await judge.judge({
              candidateBuffer: buffer,
              photoBuffer: inputs.photoBuffer,
              kitRefBuffers: inputs.kitRefBuffers,
              kitRefFiles: inputs.kitRefFiles,
              playerName: job.playerName,
              playerNumber: job.playerNumber,
              fidelityNotes: inputs.fidelityNotes,
            })
            verdict = outcome.verdict
            preview = outcome.preview
            job.addCost('judge', JUDGE_EST_COST_EUR, 'claude')
          } catch (error) {
            // Juge enfant crashé/indisponible : candidat conservé mais non-pass (sécurité
            // qualité). Le worker survit (process enfant isolé) — les autres continuent.
            Logger.error('custom-art judge KO uuid=%s: %s', job.uuid, (error as any)?.message)
            verdict = {
              scores: {},
              verdicts: { judgeError: true },
              pass: false,
              score: 0,
              suspicion: 0,
              reason: 'Juge indisponible',
            } as any
          }
        }

        // Candidat non jugeable : le juge enfant a crashé (SIGSEGV/OOM/timeout) et n'a
        // produit AUCUN aperçu. Il est non-pass (classé dernier) et son /preview/{rank-1}
        // renverrait un 404 (fichier jamais uploadé). On l'ÉCARTE du lot : ainsi TOUT
        // candidat de job.candidates est réellement affichable, et `total` /
        // `remainingReveals` / reveal-next / le fichier d'impression ne pointent QUE vers
        // des aperçus existants (pas de flèche « version suivante » cassée côté studio).
        if (!preview) {
          Logger.warn(
            'custom-art uuid=%s candidat #%s écarté (juge KO, aucun aperçu)',
            job.uuid,
            index
          )
          return null
        }

        // HD privé (jamais d'URL publique avant achat) + aperçu réduit public.
        const path = `custom-art/jobs/${job.uuid}/candidate-${index}.jpg`
        const previewPath = `custom-art/jobs/${job.uuid}/preview-${index}.jpg`
        await CustomArtStorage.put(path, buffer, { isPublic: false })
        await CustomArtStorage.put(previewPath, preview, { isPublic: true })

        const candidate: CustomArtCandidate = {
          path,
          previewPath,
          provider: provider.key,
          model: result.providerMeta.model,
          latencyMs: result.providerMeta.latencyMs,
          estCostEur: result.providerMeta.estCostEur,
          score: verdict.score,
          pass: verdict.pass,
          suspicion: verdict.suspicion ?? 0,
          verdicts: { ...verdict.verdicts, reason: verdict.reason },
          rank: 0, // recalculé sur l'ensemble juste après
        }
        return candidate
      }
    )

    // Les candidats sans aperçu (juge enfant KO) ont été écartés (null) : on ne conserve
    // que les candidats réellement servables. rankCandidates (appelé ensuite par process)
    // recalcule des rangs denses 1..N sur cet ensemble nettoyé.
    job.candidates = [...existing, ...judged.filter((c): c is CustomArtCandidate => c !== null)]
  }

  /**
   * map parallèle à concurrence BORNÉE, qui préserve l'ordre des résultats. Lance au plus
   * `limit` exécutions de `fn` à la fois (pool de runners qui tirent le prochain index) :
   * sert à juger les candidats en parallèle sans dépasser un nombre fixe de process enfants
   * simultanés (garde-fou mémoire). Une exécution qui rejette propage (rattrapé par fn).
   */
  private static async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const results = new Array<R>(items.length)
    let next = 0
    const poolSize = Math.min(Math.max(1, Math.floor(limit) || 1), items.length)
    const runners = Array.from({ length: poolSize }, async () => {
      while (true) {
        const i = next++
        if (i >= items.length) return
        results[i] = await fn(items[i], i)
      }
    })
    await Promise.all(runners)
    return results
  }

  /**
   * Range tous les candidats et réécrit les rank, retourne le meilleur.
   * Ordre (calibration §0.14) : pass d'abord, puis MEILLEUR SCORE, puis MOINDRE
   * SUSPICION (les signaux de zone départagent — on révèle le moins suspect),
   * puis ORTHOGRAPHE exacte nom/numéro (textExact) en ultime départage : à égalité
   * parfaite, on révèle d'abord le candidat sans faute de flocage (observé en réel :
   * « WALÍD » classé devant « WALID » à score et suspicion identiques).
   * Public : réutilisé par la file admin (upload d'un résultat artiste).
   */
  public static rankCandidates(candidates: CustomArtCandidate[]): CustomArtCandidate | null {
    if (candidates.length === 0) return null
    const textExactOf = (c: CustomArtCandidate) => (c.verdicts?.textExact ? 1 : 0)
    const sorted = [...candidates].sort((a, b) => {
      if (a.pass !== b.pass) return a.pass ? -1 : 1
      if (b.score !== a.score) return b.score - a.score
      if ((a.suspicion ?? 0) !== (b.suspicion ?? 0)) {
        return (a.suspicion ?? 0) - (b.suspicion ?? 0)
      }
      return textExactOf(b) - textExactOf(a)
    })
    sorted.forEach((c, i) => {
      c.rank = i + 1
    })
    return sorted[0]
  }

  /**
   * Verdict factice du mode CUSTOM_ART_FAKE_PROVIDER (M10) : « pass » sans appel au
   * juge Claude (payant). Score légèrement dégressif par index pour un classement
   * stable des 3 candidats (reveal-next testable).
   */
  private static fakeVerdict(index: number) {
    const score = Math.round((8.5 - index * 0.1) * 100) / 100
    return {
      scores: { faceLikeness: 8, kitFidelity: 8, anatomy: 9, framingStyle: 9 },
      verdicts: { fake: true, textExact: true },
      pass: true,
      score,
      suspicion: 0,
      reason:
        'Verdict factice (CUSTOM_ART_FAKE_PROVIDER) — juge court-circuité, aucun appel payant',
    } as any
  }

  /** Charge la photo source, les références maillot de l'équipe et la référence scène. */
  private static async loadInputs(job: CustomArtJob): Promise<JobInputs> {
    const photoBuffer = await CustomArtStorage.get(job.photoPath)

    const team = await CustomArtTeam.find(job.teamId)
    if (!team) throw new Error(`Équipe introuvable (id=${job.teamId})`)

    // Mode factice (M10) : ni réfs maillot ni réf scène — rien n'est envoyé à un
    // modèle, et une équipe locale sans kit ne doit pas faire échouer le scénario.
    if (fakeProviderEnabled()) {
      return {
        photoBuffer,
        kitRefBuffers: [],
        kitRefFiles: [],
        sceneRefBuffer: null,
        teamName: team.name,
        fidelityNotes: null,
      }
    }

    const kitUrls = (team.kitRefUrls || []).slice(0, 2)
    if (kitUrls.length === 0) {
      throw new Error(`Aucune image de maillot de référence pour l'équipe "${team.name}"`)
    }
    const kitRefBuffers = await Promise.all(kitUrls.map((url) => CustomArtWorker.fetchBuffer(url)))

    return {
      photoBuffer,
      kitRefBuffers,
      kitRefFiles: kitUrls,
      sceneRefBuffer: await CustomArtWorker.loadSceneRef(),
      teamName: team.name,
      fidelityNotes: team.fidelityNotes || null,
    }
  }

  /**
   * Référence scène/pose figée J1 (env CUSTOM_ART_SCENE_REF_URL), cachée en mémoire.
   * ⚠️ Elle contient une personne : elle n'est jointe qu'aux providers acceptsPersonRefs
   * (jamais à Gemini 3.x, dont le filtre d'entrée la refuse).
   */
  private static async loadSceneRef(): Promise<Buffer | null> {
    if (CustomArtWorker.sceneRefFetched) return CustomArtWorker.sceneRefCache
    CustomArtWorker.sceneRefFetched = true
    const url = Env.get('CUSTOM_ART_SCENE_REF_URL')
    if (!url) return null
    try {
      CustomArtWorker.sceneRefCache = await CustomArtWorker.fetchBuffer(url)
    } catch (error) {
      Logger.warn(
        'custom-art scène ref inaccessible (%s), génération sans',
        (error as any)?.message
      )
      CustomArtWorker.sceneRefCache = null
    }
    return CustomArtWorker.sceneRefCache
  }

  private static async fetchBuffer(url: string): Promise<Buffer> {
    const rsp = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 })
    return Buffer.from(rsp.data)
  }
}
