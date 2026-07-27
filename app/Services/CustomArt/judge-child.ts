/**
 * Process ENFANT du juge custom-art — exécuté en standalone (`node judge-child.js`), JAMAIS
 * importé par l'app. Isole le jugement (sharp/libvips + SDK Anthropic) du process applicatif
 * principal : un SIGSEGV natif intermittent (incident 13/06) n'y tue que cet enfant, le
 * worker le rattrape et le job se termine proprement (candidat non-pass). Voir JudgeRunner.ts.
 *
 * Protocole (sans @ioc, pour rester chargeable hors Adonis) — version dans judgeProtocol.ts.
 * `protocol` et `kind` sont OBLIGATOIRES : tout ce que cet enfant ne reconnaît pas le fait sortir
 * en erreur, jamais retomber sur un chemin ou des réglages par défaut (cf. judgeProtocol.ts).
 *   argv[2] = chemin d'un JSON d'entrée —
 *     foot        : { protocol:2, kind:'foot', candidatePath, photoPath, kitPaths[], kitFiles[],
 *                     playerName, playerNumber, fidelityNotes, model }
 *     générique   : { protocol:2, kind:'generic', candidatePath, tokens[], title, n,
 *                     referenceTexts{title,slots[]}, checks{text,figureCount}, model,
 *                     photoPath?, refPaths?[{path,role}], label? }
 *   argv[3] = chemin où écrire le JSON de résultat (JudgeResult)
 *   argv[4] = chemin où écrire l'APERÇU (JPEG) du candidat
 *   clé API : process.env.ANTHROPIC_API_KEY (injectée par le parent)
 *   sortie  : exit 0 + fichiers résultat/aperçu ; toute erreur/crash => exit != 0 (rattrapé par le parent)
 *
 * On produit AUSSI l'aperçu ici (et pas dans le worker) : TOUT le traitement
 * d'image (sharp/libvips) du chemin candidat doit se faire dans cet enfant jetable. Dans le
 * process applicatif principal (long-vécu, multi-modules natifs), une opération sharp tardive
 * segfaultait par pression mémoire cumulée (incident 13/06) — même après l'isolation du juge,
 * c'est la génération de l'aperçu côté worker qui crashait.
 */
import fs from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import JudgeService from './JudgeService'
import GenericJudgeService from './GenericJudgeService'
import PreviewService from './PreviewService'
import { JUDGE_CHILD_PROTOCOL, JUDGE_CHILD_KINDS, JUDGE_CHILD_EXIT } from './judgeProtocol'

async function main() {
  const inputPath = process.argv[2]
  const outputPath = process.argv[3]
  const previewPath = process.argv[4]
  if (!inputPath || !outputPath || !previewPath) {
    console.error('judge-child: usage node judge-child.js <input.json> <output.json> <preview.jpg>')
    process.exit(2)
  }

  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))

  // ÉCHOUER FERMÉ (cf. judgeProtocol.ts) : un enfant qui ne comprend pas ce qu'on lui envoie sort
  // en erreur. Le parent traite déjà ce cas (candidat écarté) ; juger à l'aveugle avec des règles
  // qui ne sont pas celles demandées laisserait passer jusqu'à l'impression ce qu'il faut recaler.
  if (input.protocol !== JUDGE_CHILD_PROTOCOL) {
    console.error(
      `judge-child: protocole ${JSON.stringify(input.protocol)} non supporté ` +
        `(attendu ${JUDGE_CHILD_PROTOCOL}) — enfant en retard sur son parent ?`
    )
    process.exit(JUDGE_CHILD_EXIT.BAD_PROTOCOL)
  }
  if (!JUDGE_CHILD_KINDS.includes(input.kind)) {
    console.error(
      `judge-child: chemin de jugement ${JSON.stringify(input.kind)} inconnu ` +
        `(attendu ${JUDGE_CHILD_KINDS.join(' | ')})`
    )
    process.exit(JUDGE_CHILD_EXIT.BAD_PROTOCOL)
  }

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
  const anthropic = new Anthropic({ apiKey })

  // Chemin GÉNÉRIQUE (recette produit, §7) : candidat seul + contexte texte — la passe
  // anatomie foot ne s'applique pas (décision Q6).
  if (input.kind === 'generic') {
    // Photo et références (protocole 2) : relues depuis les fichiers écrits par le parent.
    // Absentes => le juge ne voit que le candidat, exactement comme en protocole 1.
    const genericPhoto = input.photoPath ? fs.readFileSync(input.photoPath) : undefined
    const genericRefs = (input.refPaths || []).map((r: { path: string; role: string }) => ({
      buffer: fs.readFileSync(r.path),
      role: r.role,
    }))

    const result = await new GenericJudgeService(anthropic).judge({
      candidateBuffer,
      photoBuffer: genericPhoto,
      references: genericRefs.length > 0 ? genericRefs : undefined,
      label: input.label ?? null,
      tokens: input.tokens || [],
      title: input.title ?? null,
      n: Number(input.n) || 0,
      referenceTexts: input.referenceTexts || { title: null, slots: [] },
      // PAS de repli silencieux sur des contrôles par défaut : `checks` fait partie du contrat
      // (protocole 1) et le parent le transmet toujours. Un défaut appliqué ici jugerait le
      // candidat sur des règles que personne n'a demandées.
      checks: input.checks,
      model: input.model,
    })
    const preview = await PreviewService.makePreview(candidateBuffer)
    fs.writeFileSync(previewPath, preview)
    fs.writeFileSync(outputPath, JSON.stringify(result))
    process.exit(0)
  }

  const photoBuffer = fs.readFileSync(input.photoPath)
  const kitRefBuffers: Buffer[] = (input.kitPaths || []).map((p: string) => fs.readFileSync(p))

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

  // Aperçu réduit (même process enfant : aucun sharp ne revient au worker)
  const preview = await PreviewService.makePreview(candidateBuffer)
  fs.writeFileSync(previewPath, preview)
  fs.writeFileSync(outputPath, JSON.stringify(result))
  process.exit(0)
}

main().catch((err) => {
  console.error('judge-child: échec —', err?.message || err)
  process.exit(1)
})
