/**
 * Blocklist des prénoms non imprimables (M10) — le prénom saisi est PEINT sur
 * l'œuvre livrée (flocage du maillot) : injures et termes inappropriés FR/EN
 * sérieux uniquement, pas de censure morale au-delà.
 *
 * Matching NORMALISÉ : minuscules, accents retirés, leetspeak basique replié
 * (0->o, 1->i, 3->e, 4->a, 5->s, 7->t, 8->b, @->a, $->s, !->i), séparateurs
 * supprimés (« fils de pute » == « FilsDePute » == « f1ls-de-put3 »).
 *
 * Deux niveaux pour éviter les faux positifs sur de vrais prénoms :
 *   - BLOCKED_EXACT : termes courts ou contenus dans des prénoms légitimes
 *     (« con » dans Constance, « nique » dans Monique, « nazi » dans Nazim,
 *     « anus » dans Janus…) -> bloqués uniquement en correspondance EXACTE.
 *   - BLOCKED_SUBSTRING : termes sans collision plausible avec un prénom ->
 *     bloqués aussi en sous-chaîne (« connard », « ENCULÉ DU 93 »…).
 *
 * Le refus côté API est un 422 au message NEUTRE (« Ce prénom ne peut pas être
 * imprimé. ») : on ne répète jamais le terme, on ne moralise pas.
 */

// Correspondance exacte uniquement (collisions possibles avec de vrais prénoms)
const BLOCKED_EXACT: string[] = [
  // FR — injures courtes / sigles
  'con',
  'cul',
  'pd',
  'fdp',
  'ntm',
  'tg',
  'vtff',
  'pute',
  'nique', // contenu dans Monique / Dominique / Véronique
  'pede',
  'zob',
  'zgeg',
  'teub',
  'suce',
  'garce', // contenu dans le prénom Garcelle
  'chatte',
  'bite',
  'couille',
  'cretin',
  'debile',
  'attarde',
  'retard',
  'raton',
  'bicot',
  'viol', // contenu dans Violette
  'sexe',
  'sex',
  'anus', // contenu dans Janus
  'penis',
  'vagin',
  'porno',
  'nazi', // contenu dans Nazim / Nazima
  'kkk',
  'rape', // EN — contenu possible dans des noms composés
  'slut',
  'twat',
  'prick',
  'cock',
  'dick',
  'fag',
  'ass',
  'arse',
  'shit', // contenu dans Shital
  'cunt',
  'skank',
  'hoe',
]

// Bloqués aussi en sous-chaîne (aucun prénom légitime ne les contient)
const BLOCKED_SUBSTRING: string[] = [
  // FR — injures et vulgarité
  'connard',
  'connasse',
  'conard',
  'salope',
  'salaud',
  'salopard',
  'putain',
  'filsdepute',
  'encule',
  'enkule',
  'batard',
  'enfoire',
  'ducon',
  'trouduc',
  'merdeux',
  'merdique',
  'petasse',
  'pouffiasse',
  'grognasse',
  'branleur',
  'branlette',
  'niquetamere',
  'niktamere',
  'niquer', // « Monique » ne le contient pas : pas de collision
  'niquez',
  'suceuse',
  'suceur',
  'chibre',
  'zboub',
  'foutre',
  'bordel',
  // FR — slurs racistes / homophobes / validistes
  'negre',
  'negresse',
  'bougnoule',
  'youpin',
  'chinetoque',
  'niakoue',
  'tapette',
  'tarlouze',
  'tarlouse',
  'travelo',
  'gouine',
  'mongolien',
  'trisomique',
  // FR/EN — haine, violence
  'hitler',
  'terroriste',
  'terrorist',
  'violeur',
  'rapist',
  'pedophile',
  'pedofile',
  // EN — injures et vulgarité
  'fuck',
  'motherfuck',
  'bitch',
  'asshole',
  'bastard',
  'dickhead',
  'pussy',
  'whore',
  'wanker',
  'nigger',
  'nigga',
  'faggot',
  'retarded',
  'blowjob',
  'handjob',
  'jackass',
  'dumbass',
  'douchebag',
  'shithead',
  'bullshit',
]

// Leetspeak basique : chiffres/symboles repliés vers la lettre la plus proche
const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  '$': 's',
  '!': 'i',
}

/**
 * Forme canonique d'un prénom pour le matching : minuscules, sans accents,
 * leetspeak replié, tout caractère non alphabétique supprimé (espaces, tirets…).
 */
export function normalizeFirstName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents/diacritiques retirés (plage Unicode combinante)
    .replace(/[0134578@$!]/g, (c) => LEET_MAP[c] || c)
    .replace(/[^a-z]/g, '')
}

/**
 * true si le prénom (normalisé) est une injure / un terme inapproprié connu.
 * Utilisé par la règle de validation `printableFirstName` (CustomArtJobValidator).
 */
export function isBlockedFirstName(name: string): boolean {
  const normalized = normalizeFirstName(name)
  if (!normalized) return false
  if (BLOCKED_EXACT.includes(normalized)) return true
  return BLOCKED_SUBSTRING.some((term) => normalized.includes(term))
}
