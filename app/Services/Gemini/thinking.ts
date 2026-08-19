/**
 * Consigne de « réflexion » à joindre à un appel TEXTE Gemini.
 *
 * POURQUOI CE FICHIER EXISTE — incident du 19/08/2026. Nos appels texte sont tous des extracteurs
 * JSON (lire les textes d'un design, écrire des fragments de prompt, réécrire une consigne) : la
 * réflexion du modèle ne leur apporte rien, et leur `maxOutputTokens` a été taillé pour la SEULE
 * réponse. Sur gemini-2.5 la réflexion était éteinte par `thinkingBudget: 0` — mais la garde était
 * écrite `if (model.startsWith('gemini-2.5'))`, donc quand GEMINI_TEXT_MODEL est passé à
 * gemini-3.6-flash, la réflexion s'est rallumée PARTOUT. Or sur les modèles 3.x elle se déduit du
 * MÊME plafond : mesuré sur le prompt-director, 1253 à 1483 tokens de réflexion pour un plafond de
 * 1400 → `finishReason: MAX_TOKENS`, JSON tronqué, service muet. Symptôme côté Publisher :
 * « Analyse échouée » sans autre explication.
 *
 * Et on ne peut pas simplement étendre l'ancienne garde : sur gemini-3.6-flash `thinkingBudget: 0`
 * est REFUSÉ (400 INVALID_ARGUMENT). L'équivalent qui marche est `thinkingLevel: 'low'` (mesuré :
 * 0 token de réflexion, qualité des fragments inchangée).
 *
 * D'où cette fonction : UN SEUL endroit à corriger le jour où le modèle changera encore.
 */
export function noThinking(model: string): Record<string, unknown> {
  // gemini-2.5 : la seule famille qui accepte thinkingBudget (et refuse thinkingLevel).
  if (model.startsWith('gemini-2.5')) return { thinkingBudget: 0 }
  // 3.x et suivants : 'low' est le plancher accepté.
  return { thinkingLevel: 'low' }
}

/**
 * Marge à ajouter à un plafond de sortie pour qu'une réflexion résiduelle ne TRONQUE jamais la
 * réponse. Les tokens ne sont facturés que s'ils sont produits : cette marge ne coûte rien tant
 * que le modèle se tait, et évite qu'un futur modèle ignorant `noThinking` ne casse le service en
 * silence. À appliquer aux appels dont la réponse est longue (analyse de design).
 */
export const THINKING_HEADROOM_TOKENS = 2000
