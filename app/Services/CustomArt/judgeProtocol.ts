/**
 * Contrat d'échange entre le worker et le PROCESSUS ENFANT du juge.
 *
 * POURQUOI CE MODULE EXISTE (et pourquoi il est vide de logique)
 * Le jugement tourne dans un processus jetable pour isoler sharp/libvips et le SDK Anthropic du
 * process applicatif (un SIGSEGV natif n'y tue que l'enfant). L'enfant doit donc rester chargeable
 * HORS Adonis : il ne peut pas importer JudgeRunner, qui dépend de l'IoC. Ce module minuscule et
 * pur est le seul endroit que les deux côtés peuvent partager.
 *
 * ÉCHOUER FERMÉ, JAMAIS OUVERT
 * Avant l'introduction de ce discriminant, l'enfant aiguillait sur `input.kind === 'generic'` et
 * retombait SILENCIEUSEMENT sur le chemin foot pour toute autre valeur, avec des contrôles par
 * défaut (`input.checks || { text: true, figureCount: true }`). Un enfant en retard d'une version
 * sur son parent aurait donc jugé un candidat sur des règles qui ne sont pas les siennes — et
 * laissé passer jusqu'à l'impression ce qu'il aurait dû recaler.
 *
 * Un enfant qui ne comprend PAS ce qu'on lui envoie doit sortir en erreur : le parent traite déjà
 * ce cas (candidat écarté), c'est une dégradation éprouvée. Un jugement à l'aveugle, non.
 *
 * RÈGLE : toute évolution du contenu de `input.json` incrémente PROTOCOL. Parent et enfant étant
 * livrés dans la même image, ils ne peuvent pas diverger en temps normal — ce garde-fou couvre les
 * cas anormaux (image partiellement reconstruite, rollback partiel, exécution manuelle).
 */

/** Version du contrat. À incrémenter à CHAQUE changement de forme de `input.json`. */
export const JUDGE_CHILD_PROTOCOL = 1

/** Chemins de jugement connus. Une valeur inconnue doit faire sortir l'enfant en erreur. */
export const JUDGE_CHILD_KINDS = ['foot', 'generic'] as const

export type JudgeChildKind = (typeof JUDGE_CHILD_KINDS)[number]

/** Codes de sortie de l'enfant (le parent ne distingue que zéro / non-zéro). */
export const JUDGE_CHILD_EXIT = {
  BAD_USAGE: 2,
  NO_API_KEY: 3,
  /** `input.json` incompréhensible : protocole ou chemin de jugement inconnu. */
  BAD_PROTOCOL: 4,
} as const
