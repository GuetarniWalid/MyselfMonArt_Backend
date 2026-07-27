import { COMMON_FIDELITY_NOTES } from './prompt'

/**
 * Recette studio du poster foot — la TRANSLITTÉRATION du prompt maître historique.
 *
 * POURQUOI ELLE VIT ICI, DANS LE CODE APPLICATIF
 * Deux consommateurs en ont besoin et doivent voir EXACTEMENT la même chose : le test de parité
 * (qui prouve que le prompt produit est identique à celui du chemin legacy) et la commande qui pose
 * la recette sur un produit. Une copie de chaque côté finirait par diverger — et la divergence ne
 * se verrait qu'au premier client.
 *
 * CORRESPONDANCE avec les repères du prompt maître (app/Services/CustomArt/prompt.ts) :
 *   {REFS_DESCRIPTION} -> {images}              annonces de rôle, une par maillot joint
 *   {TEAM}             -> {teamSlug}            le choix s'interpole par son LIBELLÉ humain
 *   {NAME}             -> {playerName:upper}    le prénom est floqué en capitales
 *   {NUMBER}           -> {playerNumber}
 *   {FIDELITY_NOTES}   -> bloc ci-dessous, {notes} portant la consigne de l'équipe choisie
 *   {STYLE_REF_HINT}   -> vide : aucune référence de scène n'est jointe aux modèles actuels
 *
 * ⚠️ Toute retouche de ce texte casse la parité prouvée. Le test golden compare, pour 60
 * combinaisons, ce que produit cette recette et ce que produit `buildMasterPrompt`. Si les deux
 * doivent évoluer, ils doivent évoluer ENSEMBLE.
 */
export const FOOT_RECIPE_BASE = `You are creating a premium personalized wall-art poster.

IMAGE 1 is a photo of a person (the client). {images}

Task: paint the person from IMAGE 1 as a professional football player of {teamSlug}, standing on the pitch of a packed floodlit stadium at night, seen from behind in three-quarter view, head turned back over the shoulder so the face is clearly visible while the back of the shirt stays fully readable.

Hard requirements:
- FACE: a faithful, recognizable likeness of the person in IMAGE 1 — same facial features, skin tone, hairstyle, and glasses if any — adapted to the painterly style without caricature. Preserve the person's age (a child must stay a child).
- KIT: reproduce the official home kit EXACTLY as shown in the kit reference images — same colors, same pattern and stripe placement, same collar, same crest, same sponsor lettering. Do NOT invent, simplify, recolor or move any kit element: the kit must be a faithful copy of the references, not an interpretation.
- KIT FIDELITY NOTES (in French, non-negotiable — the design described below must be reproduced EXACTLY):
  Notes {teamSlug} : {notes}
  ${COMMON_FIDELITY_NOTES}
- BACK TEXT: print the name "{playerName:upper}" in capital letters above the number "{playerNumber}" on the back of the shirt, in the kit's official typography style. The spelling must be EXACTLY "{playerName:upper}" letter by letter, and the number exactly "{playerNumber}". Use plain Latin capital letters exactly as given: NEVER add a dot or accent that is not in "{playerName:upper}" — in particular the capital letter I is always dotless ("I", never the Turkish "İ"). No other text.
- BACK OF SHIRT: only the name and the number. The club crest is worn on the chest (heart side) and the chest sponsor on the front: NEVER paint the crest or the sponsor on the back.
- STYLE: epic painterly sports-poster style — bold expressive brushstrokes, dramatic rim light, stadium floodlights, glowing crowd, light haze.
- Single person only, exactly two arms and two legs, anatomically correct, natural hands.

Output: one vertical 3:4 painting, high detail, no watermark, no text anywhere except the name and number on the shirt.`

/** Annonces de rôle, formulées comme celles du chemin legacy. */
export const FOOT_RECIPE_REF_FRONT =
  'IMAGE {index} is the official FRONT view of the {teamSlug} home kit — the exact reference for the chest design, crest and sponsor.'
export const FOOT_RECIPE_REF_BACK =
  'IMAGE {index} is the official BACK view of the {teamSlug} home kit — the exact reference for the back design and the name/number lettering.'

/** Une option d'équipe : sa clé, son libellé, sa consigne de fidélité et ses maillots nommés. */
export interface FootTeamOption {
  key: string
  label: string
  notes?: string
  references: { name: string; role: string }[]
}

/**
 * Assemble la recette complète à partir des équipes. Le champ du choix s'appelle `teamSlug` :
 * l'écran client envoie ce slug EN PLUS de l'identifiant numérique historique, ce qui permet à la
 * recette de porter ses propres maillots au lieu de dépendre de la table équipes.
 */
export function buildFootRecipe(options: FootTeamOption[]) {
  return {
    version: 1,
    engine: 'gemini',
    model: 'gemini-3.1-flash-image',
    aspect: '3:4',
    candidates: 3,
    maxAttempts: 2,
    // Filet du foot contre les refus de modération : trois modèles essayés dans l'ordre.
    providers: {
      chain: [
        'gemini:gemini-3.1-flash-image',
        'gemini:gemini-3-pro-image',
        'gemini:gemini-2.5-flash-image',
      ],
    },
    inputs: {
      fields: [
        { name: 'teamSlug', type: 'choice', required: true, options },
        {
          name: 'playerName',
          type: 'text',
          required: true,
          maxLength: 12,
          printOnArtwork: 'back-name',
        },
        {
          name: 'playerNumber',
          type: 'number',
          required: true,
          min: 1,
          max: 99,
          printOnArtwork: 'back-number',
        },
      ],
    },
    prompt: {
      base: FOOT_RECIPE_BASE,
      refFront: FOOT_RECIPE_REF_FRONT,
      refBack: FOOT_RECIPE_REF_BACK,
    },
    // Le jugement est EMPRUNTÉ au foot (déjà calibré) plutôt que réécrit, et le juge doit voir les
    // maillots : sans eux, il noterait la fidélité d'un design qu'il n'a jamais vu.
    judge: { profile: 'foot.v1', seesReferences: true },
  }
}
