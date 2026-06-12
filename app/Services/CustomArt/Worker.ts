import Env from '@ioc:Adonis/Core/Env'
import Database from '@ioc:Adonis/Lucid/Database'
import Logger from '@ioc:Adonis/Core/Logger'
import axios from 'axios'
import { DateTime } from 'luxon'
import CustomArtJob, { CustomArtCandidate } from 'App/Models/CustomArtJob'
import CustomArtTeam from 'App/Models/CustomArtTeam'
import { mapResizeError } from 'App/Services/ArtworkResizer/jobStore'
import CustomArtStorage from './Storage'
import { affectedRows } from './db'
import MockupRenderer from './MockupRenderer'
import WatermarkService from './WatermarkService'
import JudgeService, { JUDGE_EST_COST_EUR } from './JudgeService'
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
    CustomArtWorker.started = true
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
   * Re-scan (boot + périodique) : les jobs coincés en generating/judging repartent en
   * pending. Seuil d'ancienneté sur updated_at : un job traité activement par une autre
   * instance (cluster) est sauvegardé à chaque transition, donc jamais assez vieux ici.
   */
  private static async recoverOrphans(): Promise<void> {
    const staleBefore = DateTime.now()
      .minus({ minutes: ORPHAN_MIN_AGE_MIN })
      .toSQL({ includeOffset: false }) as string
    const recovered = affectedRows(
      await Database.from('custom_art_jobs')
        .whereIn('status', ['generating', 'judging'])
        .where('updated_at', '<', staleBefore)
        .update({ status: 'pending', updated_at: new Date() })
    )
    if (recovered > 0) {
      Logger.warn(
        'custom-art: %s job(s) orphelin(s) relancé(s) (inactifs > %s min)',
        recovered,
        ORPHAN_MIN_AGE_MIN
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

  private static async process(job: CustomArtJob): Promise<void> {
    const t0 = Date.now()
    try {
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

  /** Juge chaque candidat produit, uploade HD privé + preview watermarkée publique. */
  private static async judgeAndStore(
    job: CustomArtJob,
    inputs: JobInputs,
    produced: Array<{ result: GenerateResult; provider: CustomArtProvider }>
  ): Promise<void> {
    const judge = new JudgeService()
    const existing = job.candidates || []

    const judged = await Promise.all(
      produced.map(async ({ result, provider }, i) => {
        const buffer = result.imageBuffer as Buffer
        const index = existing.length + i

        let verdict
        if (fakeProviderEnabled()) {
          // Mode factice (M10) : jugement court-circuité, verdict « pass » sans appel
          // Claude (payant). Score légèrement dégressif -> classement déterministe.
          verdict = CustomArtWorker.fakeVerdict(index)
        } else {
          try {
            verdict = await judge.judge({
              candidateBuffer: buffer,
              photoBuffer: inputs.photoBuffer,
              kitRefBuffers: inputs.kitRefBuffers,
              kitRefFiles: inputs.kitRefFiles,
              playerName: job.playerName,
              playerNumber: job.playerNumber,
              fidelityNotes: inputs.fidelityNotes,
            })
            job.addCost('judge', JUDGE_EST_COST_EUR, 'claude')
          } catch (error) {
            // Juge indisponible : candidat conservé mais non-pass (sécurité qualité)
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

        // HD privé (jamais d'URL publique avant achat) + preview watermarkée publique
        const path = `custom-art/jobs/${job.uuid}/candidate-${index}.jpg`
        const previewPath = `custom-art/jobs/${job.uuid}/preview-${index}.jpg`
        await CustomArtStorage.put(path, buffer, { isPublic: false })
        const preview = await WatermarkService.makePreview(buffer)
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
      })
    )

    job.candidates = [...existing, ...judged]
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
