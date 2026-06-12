import { kitView } from './kits'

/**
 * Prompt maître de génération du poster personnalisé foot — version CALIBRÉE portée
 * du bench M1 (scripts/bench/config.json, arbitrage Walid 2026-06-11).
 *
 * Points clés issus du bench :
 * - Chaque référence maillot est annoncée explicitement comme FACE ou DOS (suffixe
 *   -front/-back du fichier) pour que le modèle sache où lire blason/sponsor et où
 *   placer nom/numéro.
 * - {FIDELITY_NOTES} : notes de fidélité de l'équipe (texte FR, décision grill §0.13)
 *   + règles dos communes — martèlent la reproduction EXACTE du design.
 * - ⚠️ Gemini 3.x refuse photo client + toute autre image contenant une personne :
 *   pour ces modèles, useSceneRef=false → la pose est décrite UNIQUEMENT en texte
 *   (aucune réf scène jointe) et les réfs maillot doivent être sans personne.
 *
 * Ordre des images transmis aux providers (contrat partagé avec le juge) :
 *   image 1 = photo client (référence visage)
 *   images 2..n = références maillot (bibliothèque équipe, sans personne)
 *   dernière image (uniquement si useSceneRef) = référence scène/pose
 */

/** Règles dos communes à tous les maillots (bench config.commonFidelityNotes). */
export const COMMON_FIDELITY_NOTES =
  'Règles communes à tous les maillots : dans le dos, le prénom est imprimé AU-DESSUS du ' +
  "numéro, dans la typographie officielle du club. Le blason est porté CÔTÉ CŒUR et n'est " +
  "visible que de FACE — il n'apparaît JAMAIS dans le dos. Le sponsor s'affiche sur la " +
  'poitrine, de FACE uniquement — jamais dans le dos.'

const MASTER_PROMPT = `You are creating a premium personalized wall-art poster.

IMAGE 1 is a photo of a person (the client). {REFS_DESCRIPTION}

Task: paint the person from IMAGE 1 as a professional football player of {TEAM}, standing on the pitch of a packed floodlit stadium at night, seen from behind in three-quarter view, head turned back over the shoulder so the face is clearly visible while the back of the shirt stays fully readable.

Hard requirements:
- FACE: a faithful, recognizable likeness of the person in IMAGE 1 — same facial features, skin tone, hairstyle, and glasses if any — adapted to the painterly style without caricature. Preserve the person's age (a child must stay a child).
- KIT: reproduce the official home kit EXACTLY as shown in the kit reference images — same colors, same pattern and stripe placement, same collar, same crest, same sponsor lettering. Do NOT invent, simplify, recolor or move any kit element: the kit must be a faithful copy of the references, not an interpretation.
{FIDELITY_NOTES}
- BACK TEXT: print the name "{NAME}" in capital letters above the number "{NUMBER}" on the back of the shirt, in the kit's official typography style. The spelling must be EXACTLY "{NAME}" letter by letter, and the number exactly "{NUMBER}". Use plain Latin capital letters exactly as given: NEVER add a dot or accent that is not in "{NAME}" — in particular the capital letter I is always dotless ("I", never the Turkish "İ"). No other text.
- BACK OF SHIRT: only the name and the number. The club crest is worn on the chest (heart side) and the chest sponsor on the front: NEVER paint the crest or the sponsor on the back.
- STYLE: epic painterly sports-poster style — bold expressive brushstrokes, dramatic rim light, stadium floodlights, glowing crowd, light haze{STYLE_REF_HINT}.
- Single person only, exactly two arms and two legs, anatomically correct, natural hands.

Output: one vertical 3:4 painting, high detail, no watermark, no text anywhere except the name and number on the shirt.`

export interface MasterPromptOptions {
  teamName: string
  playerName: string
  playerNumber: number
  /**
   * Noms/URLs des références maillot jointes (dans l'ordre d'envoi) : sert à annoncer
   * la vue FACE/DOS de chaque image via le suffixe -front/-back du fichier.
   */
  kitRefFiles: string[]
  /** true si la référence scène/pose est jointe (false pour Gemini 3.x — pose en texte) */
  useSceneRef: boolean
  /** Notes de fidélité maillot de l'équipe (décision grill §0.13), null si non renseignées */
  fidelityNotes?: string | null
}

/** Construit le prompt maître calibré (placeholders du bench résolus en code). */
export function buildMasterPrompt(opts: MasterPromptOptions): string {
  const name = opts.playerName.toUpperCase()
  const number = String(opts.playerNumber)

  // 1 phrase par image de réf, avec la vue (FACE/DOS) annoncée explicitement
  const refPhrases = opts.kitRefFiles.map((file, i) => {
    const view = kitView(file)
    const idx = 2 + i
    if (view === 'back') {
      return `IMAGE ${idx} is the official BACK view of the ${opts.teamName} home kit — the exact reference for the back design and the name/number lettering.`
    }
    if (view === 'front') {
      return `IMAGE ${idx} is the official FRONT view of the ${opts.teamName} home kit — the exact reference for the chest design, crest and sponsor.`
    }
    return `IMAGE ${idx} is an official reference photo of the ${opts.teamName} home kit.`
  })
  if (opts.useSceneRef) refPhrases.push('The LAST image is a scene and pose reference.')
  const refsDescription = refPhrases.join(' ')
  const styleHint = opts.useSceneRef ? ' (match the scene reference’s style)' : ''

  // Notes de fidélité : équipe + règles dos communes (en français, voulu — décision §0.13)
  const noteLines: string[] = []
  if (opts.fidelityNotes) noteLines.push(`Notes ${opts.teamName} : ${opts.fidelityNotes}`)
  noteLines.push(COMMON_FIDELITY_NOTES)
  const fidelityBlock =
    `- KIT FIDELITY NOTES (in French, non-negotiable — the design described below must be ` +
    `reproduced EXACTLY):\n${noteLines.map((l) => `  ${l}`).join('\n')}`

  return MASTER_PROMPT.replace('{REFS_DESCRIPTION}', refsDescription)
    .replace('{STYLE_REF_HINT}', styleHint)
    .replace('{FIDELITY_NOTES}', fidelityBlock)
    .replace(/\{TEAM\}/g, opts.teamName)
    .replace(/\{NAME\}/g, name)
    .replace(/\{NUMBER\}/g, number)
}
