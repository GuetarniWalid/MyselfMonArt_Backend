/**
 * Process ENFANT du juge custom-art — exécuté en standalone (`node judge-child.js`), JAMAIS
 * importé par l'app. Isole le jugement (sharp/libvips + SDK Anthropic) du process applicatif
 * principal : un SIGSEGV natif intermittent (incident 13/06) n'y tue que cet enfant, le
 * worker le rattrape et le job se termine proprement (candidat non-pass). Voir JudgeRunner.ts.
 *
 * Protocole (sans @ioc, pour rester chargeable hors Adonis) :
 *   argv[2] = chemin d'un JSON d'entrée { candidatePath, photoPath, kitPaths[], kitFiles[],
 *             playerName, playerNumber, fidelityNotes, model }
 *   argv[3] = chemin où écrire le JSON de résultat (JudgeResult)
 *   clé API : process.env.ANTHROPIC_API_KEY (injectée par le parent)
 *   sortie  : exit 0 + fichier résultat ; toute erreur/crash => exit != 0 (rattrapé par le parent)
 */
import fs from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import JudgeService from './JudgeService'

async function main() {
  const inputPath = process.argv[2]
  const outputPath = process.argv[3]
  if (!inputPath || !outputPath) {
    console.error('judge-child: usage node judge-child.js <input.json> <output.json>')
    process.exit(2)
  }

  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('judge-child: ANTHROPIC_API_KEY absente')
    process.exit(3)
  }

  // Durcissement libvips (même réglage que le worker) : un seul thread vips, pas de cache.
  // (Import dynamique pour ne pas charger sharp si jamais inutile.)
  const sharp = (await import('sharp')).default
  sharp.concurrency(1)
  sharp.cache(false)

  const candidateBuffer = fs.readFileSync(input.candidatePath)
  const photoBuffer = fs.readFileSync(input.photoPath)
  const kitRefBuffers: Buffer[] = (input.kitPaths || []).map((p: string) => fs.readFileSync(p))

  const anthropic = new Anthropic({ apiKey })
  const result = await new JudgeService(anthropic).judge({
    candidateBuffer,
    photoBuffer,
    kitRefBuffers,
    kitRefFiles: input.kitFiles || [],
    playerName: input.playerName,
    playerNumber: input.playerNumber,
    fidelityNotes: input.fidelityNotes ?? null,
    model: input.model,
  })

  fs.writeFileSync(outputPath, JSON.stringify(result))
  process.exit(0)
}

main().catch((err) => {
  console.error('judge-child: échec —', err?.message || err)
  process.exit(1)
})
