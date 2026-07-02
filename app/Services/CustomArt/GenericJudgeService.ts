// ⚠️ MODULE PUR (aucune dépendance @ioc/Adonis) : chargé dans le process applicatif (dev)
// ET dans le PROCESS ENFANT isolé (prod, judge-child.ts) — même contrainte que JudgeService.
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import sharp from 'sharp'
import type { JudgeResult } from './JudgeService'

/**
 * Juge des candidats GÉNÉRIQUES (contrat growth/STUDIO-GENERATION-RECIPE-CONTRACT.md §7) —
 * produits pilotés par recette (`studio.recipe`), 1er porteur : poster famille line-art
 * full Gemini (textes rendus PAR l'IA, aucun compositing). Le juge est LE filet : jamais
 * un candidat au texte fautif montré au client.
 *
 * UNE passe structurée (≠ foot et ses 2 passes) : fidélité des textes + comptage des
 * figures + score qualité global. La passe anatomie foot (4 quadrants) ne s'applique PAS
 * ici — calibrée photoréalisme/footballeur solo, elle générerait des faux positifs en
 * rafale sur des silhouettes line-art minimalistes (décision actée Q6).
 *
 * Style calibré conservé (§0.14 foot) : le modèle DÉCRIT (textes lus verbatim, comptage,
 * positions), le CODE conclut les 5 codes — déterministe, débuggable, télémétrisable :
 *   text_missing | text_misspelled | text_order | text_residual | figure_count
 * pass = aucun code ET qualité >= QUALITY_PASS_MIN. Codes stockés dans verdicts.textCodes.
 */

// Estimation indicative €/jugement (1 passe, 1 image) — ledger de coûts / cap quotidien
export const GENERIC_JUDGE_EST_COST_EUR = 0.05

// Plancher qualité du pass (rendu cassé/illisible recalé même avec des textes exacts)
const QUALITY_PASS_MIN = 6

// Le texte doit rester lisible par le juge : résolution supérieure au 896 du foot
const JUDGE_IMAGE_MAX_PX = 1120

export type GenericTextCode =
  | 'text_missing'
  | 'text_misspelled'
  | 'text_order'
  | 'text_residual'
  | 'figure_count'

const readingSchema = z.object({
  figure_count: z
    .number()
    .int()
    .min(0)
    .max(30)
    .describe(
      'Nombre de FIGURES humaines (personnages représentés) visibles, comptées UNE PAR UNE de gauche à droite'
    ),
  figures_trace: z
    .string()
    .max(500)
    .describe(
      'Trace du comptage : chaque figure en quelques mots, de gauche à droite (en français)'
    ),
  texts_read: z
    .array(z.string().max(60))
    .max(20)
    .describe(
      "TOUS les textes visibles sur l'image, lus VERBATIM (casse, accents, points et signes compris), dans l'ordre de lecture (haut -> bas, gauche -> droite)"
    ),
  token_reads: z
    .array(
      z.object({
        expected: z.string().max(40).describe('Le texte attendu, recopié tel quel'),
        found: z
          .boolean()
          .describe("Ce texte (ou une variante proche) est-il présent sur l'image ?"),
        read_as: z
          .string()
          .max(60)
          .describe('Le texte tel que réellement LU sur l’image (verbatim), chaîne vide si absent'),
        exact: z
          .boolean()
          .describe(
            'Lecture EXACTEMENT identique au texte attendu, lettre par lettre — casse, accents, ' +
              'points compris ? Un point au-dessus d’un I majuscule (« İ ») ou tout diacritique ' +
              'non demandé = false'
          ),
        position: z
          .number()
          .int()
          .min(0)
          .max(30)
          .describe(
            'Position 1-based de ce texte parmi les textes PAR PERSONNE lus de GAUCHE à DROITE (0 si absent)'
          ),
      })
    )
    .max(10)
    .describe('Un élément par texte ATTENDU (liste fournie), dans l’ordre fourni'),
  title_found: z
    .boolean()
    .describe('Le TITRE attendu est-il présent ? (false si aucun titre attendu)'),
  title_read_as: z
    .string()
    .max(80)
    .describe('Le titre tel que réellement LU (verbatim), chaîne vide si absent'),
  title_exact: z
    .boolean()
    .describe(
      'Titre EXACTEMENT identique au titre attendu, lettre par lettre, casse et accents compris ?'
    ),
  extra_texts: z
    .array(z.string().max(60))
    .max(12)
    .describe(
      "Textes visibles qui ne sont NI l'un des textes attendus NI le titre attendu (verbatim) — y compris tout texte résiduel de la référence de style ou texte parasite"
    ),
  quality_score: z
    .number()
    .min(0)
    .max(10)
    .describe(
      'Qualité globale du rendu, 0-10 (10 = irréprochable) : propreté et régularité du trait, composition équilibrée, lettrage net et homogène, aucun artefact (traits cassés, taches, membres aberrants, texte déformé)'
    ),
  quality_notes: z
    .string()
    .max(300)
    .describe('Défauts de qualité relevés (1-2 phrases, en français), ou "RAS"'),
  verdict: z.string().max(300).describe('Verdict global en 1 phrase, en français'),
})

type Reading = z.infer<typeof readingSchema>

export interface GenericJudgeInput {
  candidateBuffer: Buffer
  /** Textes attendus par personne, gauche -> droite */
  tokens: string[]
  /** Titre attendu (assemblé), null si non configuré */
  title: string | null
  /** Nombre de personnes attendu (= tokens.length) */
  n: number
  /** Textes présents dans l'image de RÉFÉRENCE (ne doivent PLUS apparaître) */
  referenceTexts: { title: string | null; slots: string[] }
  /** Contrôles actifs (recette §4 judge) */
  checks: { text: boolean; figureCount: boolean }
  /** Modèle Claude — résolu par l'appelant (Env override ou DEFAULT_JUDGE_MODEL) */
  model: string
}

export default class GenericJudgeService {
  // Client injecté (jamais lu via @ioc) : worker depuis Env, process enfant depuis process.env.
  constructor(private anthropic: Anthropic) {}

  public async judge(input: GenericJudgeInput): Promise<JudgeResult> {
    const content: any[] = [
      { type: 'text', text: this.prompt(input) },
      await this.imageBlock(input.candidateBuffer),
    ]

    const reading = await this.structuredCall(input.model, content)

    // ------ Le CODE conclut (le modèle n'a fait que décrire) ------
    const codes = new Set<GenericTextCode>()
    const details: string[] = []

    if (input.checks.text) {
      const byExpected = new Map(reading.token_reads.map((t) => [t.expected, t]))
      for (const token of input.tokens) {
        const read = byExpected.get(token)
        if (!read || !read.found) {
          codes.add('text_missing')
          details.push(`« ${token} » absent`)
        } else if (read.read_as !== token || !read.exact) {
          codes.add('text_misspelled')
          details.push(`« ${token} » lu « ${read.read_as} »`)
        }
      }

      // Ordre gauche -> droite : les positions des tokens trouvés doivent croître
      // strictement dans l'ordre de la liste attendue.
      const positioned = input.tokens
        .map((token) => byExpected.get(token))
        .filter((t): t is NonNullable<typeof t> => Boolean(t && t.found && t.position > 0))
      for (let i = 1; i < positioned.length; i++) {
        if (positioned[i].position <= positioned[i - 1].position) {
          codes.add('text_order')
          details.push(
            `ordre gauche->droite non respecté (« ${positioned[i].expected} » avant « ${positioned[i - 1].expected} »)`
          )
          break
        }
      }

      if (input.title) {
        if (!reading.title_found) {
          codes.add('text_missing')
          details.push(`titre « ${input.title} » absent`)
        } else if (reading.title_read_as !== input.title || !reading.title_exact) {
          codes.add('text_misspelled')
          details.push(`titre lu « ${reading.title_read_as} »`)
        }
      }

      // Résiduels de la référence + parasites : TOUT texte non demandé est un échec (§7).
      const referencePool = [input.referenceTexts.title, ...input.referenceTexts.slots]
        .filter((t): t is string => Boolean(t))
        .map((t) => this.norm(t))
      for (const extra of reading.extra_texts || []) {
        const text = String(extra).trim()
        if (!text) continue
        codes.add('text_residual')
        details.push(
          referencePool.includes(this.norm(text))
            ? `texte de la référence « ${text} » a fuité`
            : `texte parasite « ${text} »`
        )
      }
    }

    if (input.checks.figureCount && reading.figure_count !== input.n) {
      codes.add('figure_count')
      details.push(`${reading.figure_count} figure(s) au lieu de ${input.n}`)
    }

    const quality = reading.quality_score
    const pass = codes.size === 0 && quality >= QUALITY_PASS_MIN

    const reason =
      codes.size > 0
        ? `ÉCHEC TEXTE/FIGURES (${details.join(' ; ')}) — ${reading.verdict}`
        : quality < QUALITY_PASS_MIN
          ? `QUALITÉ INSUFFISANTE (${quality}/10) — ${reading.verdict}`
          : reading.verdict

    return {
      scores: { quality },
      verdicts: {
        // Champs génériques (télémétrie §7 : savoir CE QUI rate pour itérer la recette)
        textCodes: [...codes],
        textDetails: details,
        textsRead: reading.texts_read,
        tokenReads: reading.token_reads,
        titleRead: input.title
          ? {
              found: reading.title_found,
              readAs: reading.title_read_as,
              exact: reading.title_exact,
            }
          : null,
        extraTexts: reading.extra_texts,
        figureCount: reading.figure_count,
        figuresTrace: reading.figures_trace,
        qualityScore: quality,
        qualityNotes: reading.quality_notes,
        // Compat classement existant (Worker.rankCandidates départage sur textExact)
        textExact: ![...codes].some((c) => c.startsWith('text_')),
        // Champs foot absents à dessein (faceLikeness, kitFidelity…) — jamais lus côté générique
      } as any,
      pass,
      // Classement du lot : la qualité globale (les échecs texte sont déjà éliminatoires)
      score: quality,
      suspicion: 0,
      reason,
    }
  }

  // --------------------------------------------------------------------------
  // Prompt (le modèle DÉCRIT, en français — le verdict est calculé par programme)
  // --------------------------------------------------------------------------

  private prompt(input: GenericJudgeInput): string {
    const tokenLines = input.tokens.map((t, i) => `  ${i + 1}. « ${t} »`).join('\n')
    const referencePool = [
      ...(input.referenceTexts.title ? [input.referenceTexts.title] : []),
      ...input.referenceTexts.slots,
    ]
    const referenceBlock =
      referencePool.length > 0
        ? `\nTextes de l'IMAGE DE RÉFÉRENCE DE STYLE (ils ont dû être REMPLACÉS — s'ils apparaissent encore, liste-les dans extra_texts) : ${referencePool.map((t) => `« ${t} »`).join(', ')}.`
        : ''
    const titleBlock = input.title
      ? `\nTITRE attendu (unique, généralement en plus grand) : « ${input.title} ».`
      : `\nAucun titre n'est attendu : title_found=false, title_read_as vide, title_exact=false.`

    return `Tu es le contrôleur qualité d'une œuvre personnalisée générée par IA (illustration imprimée, produit premium). Ton rôle est UNIQUEMENT de DÉCRIRE ce que tu VOIS — le verdict est calculé par programme à partir de tes descriptions. ATTENTION : le générateur fait des fautes d'orthographe subtiles (lettre doublée, accent absent ou ajouté, point sur un I majuscule « İ », casse différente) — lis chaque texte LETTRE PAR LETTRE.

Tu reçois UNE image : le CANDIDAT à évaluer.

La composition attendue compte EXACTEMENT ${input.n} personne(s), chacune accompagnée de son texte, dans cet ordre de GAUCHE à DROITE :
${tokenLines || '  (aucun texte par personne attendu)'}
${titleBlock}${referenceBlock}

PROCÉDURE :
1. COMPTE les figures humaines une par une (gauche -> droite) et rédige figures_trace AVANT de conclure figure_count. Une figure = un personnage représenté (quel que soit le style), pas les objets ni les animaux.
2. LIS tous les textes visibles, verbatim, dans texts_read.
3. Pour CHAQUE texte attendu de la liste (dans l'ordre fourni), remplis un élément de token_reads : found, read_as (verbatim), exact (lettre par lettre, casse et accents compris), position (rang 1-based du texte parmi les textes PAR PERSONNE lus de gauche à droite ; 0 si absent).
4. Pour le titre attendu : title_found / title_read_as / title_exact (mêmes exigences).
5. extra_texts : TOUT texte visible qui n'est ni un texte attendu ni le titre attendu — textes de la référence qui auraient fuité, doublons, mots parasites, filigranes.
6. quality_score : juge la QUALITÉ GLOBALE du rendu (propreté du trait, composition, homogénéité du lettrage, artefacts). Sois exigeant : c'est un produit premium.
Décris exactement ce qui est VISIBLE, pas ce qui serait attendu — au doute sur une lettre, réponds exact=false et recopie ce que tu vois. Réponds uniquement via le format structuré demandé, en français.`
  }

  private norm(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
  }

  // --------------------------------------------------------------------------
  // Image + appel structuré (mêmes patterns que JudgeService, module indépendant)
  // --------------------------------------------------------------------------

  private async imageBlock(buffer: Buffer) {
    return {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: (
          await sharp(buffer)
            .resize(JUDGE_IMAGE_MAX_PX, JUDGE_IMAGE_MAX_PX, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({ quality: 88 })
            .toBuffer()
        ).toString('base64'),
      },
    }
  }

  private async structuredCall(model: string, content: any[]): Promise<Reading> {
    const jsonSchema: any = zodToJsonSchema(readingSchema as any)
    if (!jsonSchema.type) jsonSchema.type = 'object'

    return this.retryOperation(async () => {
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 2500,
        tools: [
          {
            name: 'read_generic_candidate',
            description:
              'Décrit les textes et figures visibles d’un candidat généré (le verdict est calculé par programme)',
            input_schema: jsonSchema,
          },
        ],
        tool_choice: { type: 'tool', name: 'read_generic_candidate' },
        messages: [{ role: 'user', content }],
      })

      const toolUse = response.content.find((c) => c.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error("Le juge générique n'a pas retourné de sortie structurée")
      }
      const parsed = readingSchema.safeParse(toolUse.input)
      if (!parsed.success) {
        throw new Error(`Sortie du juge générique invalide: ${parsed.error.message}`)
      }
      return parsed.data
    })
  }

  /** Retry backoff (même politique que JudgeService) : 429 retry-after, 529 exponentiel, 3 essais. */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error
        if (error.status === 429) {
          const retryAfter = parseInt(error.headers?.['retry-after'] || delayMs.toString())
          console.error(`custom-art generic judge rate limited, retry dans ${retryAfter}ms`)
          await new Promise((resolve) => setTimeout(resolve, retryAfter))
          continue
        }
        if (error.status === 529) {
          const backoff = delayMs * Math.pow(2, attempt - 1)
          console.error(`custom-art generic judge overloaded (529), retry dans ${backoff}ms`)
          await new Promise((resolve) => setTimeout(resolve, backoff))
          continue
        }
        throw error
      }
    }
    throw lastError || new Error('Max retries exceeded')
  }
}
