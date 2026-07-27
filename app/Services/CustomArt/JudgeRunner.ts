import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import Anthropic from '@anthropic-ai/sdk'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import JudgeService, { DEFAULT_JUDGE_MODEL, JudgeResult } from './JudgeService'
import GenericJudgeService from './GenericJudgeService'
import PreviewService from './PreviewService'
import { JUDGE_CHILD_PROTOCOL } from './judgeProtocol'

export interface JudgeInput {
  candidateBuffer: Buffer
  photoBuffer: Buffer
  kitRefBuffers: Buffer[]
  kitRefFiles?: string[]
  /**
   * Rôles DÉCLARÉS des références (mêmes index que kitRefBuffers), quand ils sont connus — cas
   * d'un produit piloté par recette. Prioritaires sur la déduction par suffixe de nom de fichier.
   */
  kitRefRoles?: (string | null | undefined)[]
  playerName: string
  playerNumber: number
  fidelityNotes?: string | null
}

/** Entrée du juge GÉNÉRIQUE (recette produit §7) : contexte {tokens, title, n} + réf. */
export interface GenericJudgeRunnerInput {
  candidateBuffer: Buffer
  tokens: string[]
  title: string | null
  n: number
  referenceTexts: { title: string | null; slots: string[] }
  checks: { text: boolean; figureCount: boolean }
  /** Photo du client — jointe seulement si le produit le demande (parité foot). */
  photoBuffer?: Buffer
  /** Images de référence montrées au juge, DANS L'ORDRE, avec leur rôle. */
  references?: { buffer: Buffer; role: 'style' | 'front' | 'back' | 'scene' }[]
  /** Libellé de l'option choisie (ex. « Paris »), pour nommer les références. */
  label?: string | null
}

/** Verdict + aperçu, tous deux produits hors du process principal en prod. */
export interface JudgeOutcome {
  verdict: JudgeResult
  preview: Buffer
}

// Délai max d'un jugement (2 passes Opus multi-images) avant de tuer l'enfant.
const JUDGE_TIMEOUT_MS = 180_000

/**
 * Orchestre le jugement d'un candidat. En PROD, délègue à un PROCESS ENFANT autonome
 * (judge-child.js) : le jugement fait du sharp/libvips + des appels Anthropic, dont la
 * combinaison dans le process applicatif chargé provoquait un SIGSEGV natif intermittent
 * (incident 13/06 : 1er candidat jugé OK puis crash sur le 2e, qui tuait le worker et
 * laissait le job coincé). Isolé en enfant, un crash ne tue QUE l'enfant : on lève une
 * erreur, le worker la rattrape (candidat non-pass) et le job se termine proprement.
 *
 * En DEV (pas de binaire compilé judge-child.js à côté), exécute en in-process — la
 * machine de dev (hors conteneur) ne reproduit pas le crash.
 */
export default class JudgeRunner {
  public async judge(input: JudgeInput): Promise<JudgeOutcome> {
    const t0 = Date.now()
    const model = Env.get('CUSTOM_ART_JUDGE_MODEL') || DEFAULT_JUDGE_MODEL
    const childJs = path.join(__dirname, 'judge-child.js')

    // On teste l'EXISTENCE du binaire enfant SÉPARÉMENT du jugement : ainsi un échec de
    // l'enfant (crash/timeout/résultat manquant) ne peut JAMAIS retomber par erreur sur le
    // chemin in-process (celui qui crashe). Seule l'absence réelle du binaire = mode dev.
    const childExists = await fs
      .access(childJs)
      .then(() => true)
      .catch(() => false)

    let outcome: JudgeOutcome
    const viaChild = childExists
    if (childExists) {
      // Tout échec ici (SIGSEGV de l'enfant, timeout, output absent) est propagé au worker,
      // qui marque le candidat non-pass et continue — le process principal survit.
      outcome = await this.judgeInChild(childJs, model, input)
    } else {
      // DEV (hors conteneur) : juge + aperçu en in-process (pas de crash sur la machine dev).
      const anthropic = new Anthropic({ apiKey: Env.get('ANTHROPIC_API_KEY') })
      const verdict = await new JudgeService(anthropic).judge({ ...input, model })
      const preview = await PreviewService.makePreview(input.candidateBuffer)
      outcome = { verdict, preview }
    }

    const { verdict } = outcome
    Logger.info(
      'custom-art judge %sms pass=%s score=%s suspicion=%s bras=%s mains=%s text="%s"%s (%s)',
      Math.round(Date.now() - t0),
      verdict.pass,
      verdict.score,
      verdict.suspicion,
      verdict.verdicts?.armsVisible,
      verdict.verdicts?.handsVisible,
      verdict.verdicts?.textRead,
      viaChild ? '' : ' [in-process]',
      String(verdict.reason || '').slice(0, 120)
    )
    return outcome
  }

  /**
   * Jugement d'un candidat GÉNÉRIQUE (§7) — même isolation que le foot : process enfant
   * en prod (kind:'generic' dans le protocole), in-process en dev. Un crash de l'enfant
   * est propagé à l'appelant (candidat non-pass), le worker survit.
   */
  public async judgeGeneric(input: GenericJudgeRunnerInput): Promise<JudgeOutcome> {
    const t0 = Date.now()
    const model = Env.get('CUSTOM_ART_JUDGE_MODEL') || DEFAULT_JUDGE_MODEL
    const childJs = path.join(__dirname, 'judge-child.js')

    const childExists = await fs
      .access(childJs)
      .then(() => true)
      .catch(() => false)

    let outcome: JudgeOutcome
    if (childExists) {
      outcome = await this.judgeGenericInChild(childJs, model, input)
    } else {
      const anthropic = new Anthropic({ apiKey: Env.get('ANTHROPIC_API_KEY') })
      const verdict = await new GenericJudgeService(anthropic).judge({ ...input, model })
      const preview = await PreviewService.makePreview(input.candidateBuffer)
      outcome = { verdict, preview }
    }

    const { verdict } = outcome
    Logger.info(
      'custom-art judge(generic) %sms pass=%s score=%s codes=[%s] figures=%s%s (%s)',
      Math.round(Date.now() - t0),
      verdict.pass,
      verdict.score,
      (verdict.verdicts?.textCodes || []).join(','),
      verdict.verdicts?.figureCount,
      childExists ? '' : ' [in-process]',
      String(verdict.reason || '').slice(0, 120)
    )
    return outcome
  }

  /** Variante enfant du juge générique : candidat + contexte texte via input.json. */
  private async judgeGenericInChild(
    childJs: string,
    model: string,
    input: GenericJudgeRunnerInput
  ): Promise<JudgeOutcome> {
    const dir = path.join(os.tmpdir(), `ca-judge-${randomUUID()}`)
    await fs.mkdir(dir, { recursive: true })
    try {
      const candidatePath = path.join(dir, 'candidate.jpg')
      await fs.writeFile(candidatePath, input.candidateBuffer)
      // Photo et références passent par des FICHIERS (comme sur le chemin foot) : `input.json`
      // reste léger et aucune image ne transite en base64 dans un argument de processus.
      let photoPath: string | null = null
      if (input.photoBuffer) {
        photoPath = path.join(dir, 'photo.jpg')
        await fs.writeFile(photoPath, input.photoBuffer)
      }
      const refPaths: { path: string; role: string }[] = []
      for (const [i, ref] of (input.references || []).entries()) {
        const refPath = path.join(dir, `ref-${i}.jpg`)
        await fs.writeFile(refPath, ref.buffer)
        refPaths.push({ path: refPath, role: ref.role })
      }
      const inputPath = path.join(dir, 'input.json')
      const outputPath = path.join(dir, 'output.json')
      const previewPath = path.join(dir, 'preview.jpg')
      await fs.writeFile(
        inputPath,
        JSON.stringify({
          // Discriminants OBLIGATOIRES du contrat (cf. judgeProtocol.ts) : l'enfant sort en erreur
          // sur tout ce qu'il ne reconnaît pas, plutôt que de juger avec des réglages par défaut.
          protocol: JUDGE_CHILD_PROTOCOL,
          kind: 'generic',
          candidatePath,
          tokens: input.tokens,
          title: input.title,
          n: input.n,
          referenceTexts: input.referenceTexts,
          checks: input.checks,
          // Facultatifs (protocole 2) : absents pour un produit qui n'en déclare pas.
          photoPath,
          refPaths,
          label: input.label ?? null,
          model,
        })
      )

      await this.runChild(childJs, inputPath, outputPath, previewPath)
      const [raw, preview] = await Promise.all([
        fs.readFile(outputPath, 'utf8'),
        fs.readFile(previewPath),
      ])
      return { verdict: JSON.parse(raw) as JudgeResult, preview }
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }

  /** Écrit les images en fichiers temp, lance l'enfant, lit verdict + aperçu, nettoie. */
  private async judgeInChild(
    childJs: string,
    model: string,
    input: JudgeInput
  ): Promise<JudgeOutcome> {
    const dir = path.join(os.tmpdir(), `ca-judge-${randomUUID()}`)
    await fs.mkdir(dir, { recursive: true })
    try {
      const candidatePath = path.join(dir, 'candidate.jpg')
      const photoPath = path.join(dir, 'photo.jpg')
      const kitPaths: string[] = []
      await fs.writeFile(candidatePath, input.candidateBuffer)
      await fs.writeFile(photoPath, input.photoBuffer)
      for (let i = 0; i < (input.kitRefBuffers || []).length; i++) {
        const p = path.join(dir, `kit-${i}.jpg`)
        await fs.writeFile(p, input.kitRefBuffers[i])
        kitPaths.push(p)
      }
      const inputPath = path.join(dir, 'input.json')
      const outputPath = path.join(dir, 'output.json')
      const previewPath = path.join(dir, 'preview.jpg')
      await fs.writeFile(
        inputPath,
        JSON.stringify({
          // Le chemin foot était jusqu'ici le DÉFAUT implicite de l'enfant : il est désormais
          // nommé explicitement, pour qu'aucune valeur inconnue ne puisse y retomber par accident.
          protocol: JUDGE_CHILD_PROTOCOL,
          kind: 'foot',
          candidatePath,
          photoPath,
          kitPaths,
          kitFiles: input.kitRefFiles || [],
          // Protocole 3 : rôles déclarés, quand le produit les connaît (recette).
          kitRoles: input.kitRefRoles || [],
          playerName: input.playerName,
          playerNumber: input.playerNumber,
          fidelityNotes: input.fidelityNotes ?? null,
          model,
        })
      )

      await this.runChild(childJs, inputPath, outputPath, previewPath)
      const [raw, preview] = await Promise.all([
        fs.readFile(outputPath, 'utf8'),
        fs.readFile(previewPath),
      ])
      return { verdict: JSON.parse(raw) as JudgeResult, preview }
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }

  private runChild(
    childJs: string,
    inputPath: string,
    outputPath: string,
    previewPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        process.execPath, // le même binaire node
        [childJs, inputPath, outputPath, previewPath],
        {
          env: { ...process.env, ANTHROPIC_API_KEY: Env.get('ANTHROPIC_API_KEY') as string },
          timeout: JUDGE_TIMEOUT_MS,
          killSignal: 'SIGKILL',
          cwd: process.cwd(),
          maxBuffer: 4 * 1024 * 1024, // le résultat passe par un fichier ; stdout reste petit
        },
        (error, _stdout, stderr) => {
          if (error) {
            // Crash natif (SIGSEGV), timeout (SIGKILL) ou exit != 0 : rattrapé par le worker.
            const sig = (error as any).signal ? ` signal=${(error as any).signal}` : ''
            const code = (error as any).code !== undefined ? ` code=${(error as any).code}` : ''
            const tail = String(stderr || '')
              .trim()
              .split('\n')
              .slice(-2)
              .join(' | ')
            reject(new Error(`juge enfant en échec${sig}${code}${tail ? ` — ${tail}` : ''}`))
            return
          }
          resolve()
        }
      )
    })
  }
}
