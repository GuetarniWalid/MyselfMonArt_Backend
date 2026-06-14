import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'
import Anthropic from '@anthropic-ai/sdk'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import JudgeService, { DEFAULT_JUDGE_MODEL, JudgeResult } from './JudgeService'

export interface JudgeInput {
  candidateBuffer: Buffer
  photoBuffer: Buffer
  kitRefBuffers: Buffer[]
  kitRefFiles?: string[]
  playerName: string
  playerNumber: number
  fidelityNotes?: string | null
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
  public async judge(input: JudgeInput): Promise<JudgeResult> {
    const model = Env.get('CUSTOM_ART_JUDGE_MODEL') || DEFAULT_JUDGE_MODEL
    const childJs = path.join(__dirname, 'judge-child.js')

    // On teste l'EXISTENCE du binaire enfant SÉPARÉMENT du jugement : ainsi un échec de
    // l'enfant (crash/timeout/résultat manquant) ne peut JAMAIS retomber par erreur sur le
    // chemin in-process (celui qui crashe). Seule l'absence réelle du binaire = mode dev.
    const childExists = await fs
      .access(childJs)
      .then(() => true)
      .catch(() => false)

    let result: JudgeResult
    const viaChild = childExists
    if (childExists) {
      // Tout échec ici (SIGSEGV de l'enfant, timeout, output absent) est propagé au worker,
      // qui marque le candidat non-pass et continue — le process principal survit.
      result = await this.judgeInChild(childJs, model, input)
    } else {
      const anthropic = new Anthropic({ apiKey: Env.get('ANTHROPIC_API_KEY') })
      result = await new JudgeService(anthropic).judge({ ...input, model })
    }

    Logger.info(
      'custom-art judge pass=%s score=%s suspicion=%s bras=%s mains=%s text="%s"%s (%s)',
      result.pass,
      result.score,
      result.suspicion,
      result.verdicts?.armsVisible,
      result.verdicts?.handsVisible,
      result.verdicts?.textRead,
      viaChild ? '' : ' [in-process]',
      String(result.reason || '').slice(0, 120)
    )
    return result
  }

  /** Écrit les images en fichiers temporaires, lance l'enfant, lit le résultat, nettoie. */
  private async judgeInChild(
    childJs: string,
    model: string,
    input: JudgeInput
  ): Promise<JudgeResult> {
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
      await fs.writeFile(
        inputPath,
        JSON.stringify({
          candidatePath,
          photoPath,
          kitPaths,
          kitFiles: input.kitRefFiles || [],
          playerName: input.playerName,
          playerNumber: input.playerNumber,
          fidelityNotes: input.fidelityNotes ?? null,
          model,
        })
      )

      await this.runChild(childJs, inputPath, outputPath)
      const raw = await fs.readFile(outputPath, 'utf8')
      return JSON.parse(raw) as JudgeResult
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  }

  private runChild(childJs: string, inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        process.execPath, // le même binaire node
        [childJs, inputPath, outputPath],
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
