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

/**
 * Version du contrat. À incrémenter à CHAQUE changement de forme de `input.json`.
 *
 * Historique :
 *  1 — contrat initial (foot : photo + maillots ; générique : candidat seul).
 *  2 — le chemin générique peut recevoir `photoPath`, `refPaths[]` (avec rôles) et `label`.
 *      Le bump est INDISPENSABLE bien que ces champs soient facultatifs : un enfant resté en
 *      version 1 les ignorerait en silence et jugerait la fidélité d'une référence qu'on ne lui
 *      aurait jamais montrée — précisément le fail-open que ce discriminant existe pour couper.
 *  3 — le chemin foot accepte `kitRoles[]` : rôles DÉCLARÉS des références (mêmes index que
 *      `kitPaths`), prioritaires sur la déduction par suffixe de nom de fichier. Nécessaire pour
 *      qu'un produit piloté par recette puisse emprunter le jugement foot sans dépendre d'une
 *      convention de nommage de fichiers.
 *  4 — `checks` du chemin générique accepte `monochrome` : le candidat d'un produit vendu « noir
 *      sur blanc » est MESURÉ et recalé s'il est colorié. Un enfant en version 3 ignorerait ce
 *      contrôle en silence et laisserait passer un dessin au trait colorié jusqu'à l'impression.
 */
export const JUDGE_CHILD_PROTOCOL = 4

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
