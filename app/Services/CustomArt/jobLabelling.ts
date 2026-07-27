import type CustomArtJob from 'App/Models/CustomArtJob'

/**
 * Comment une création est NOMMÉE pour les humains : e-mail de l'atelier, file de revue, fichier
 * d'impression, e-mail client. Fonction PURE (aucune base, aucun réseau) — le nom d'équipe des jobs
 * historiques est résolu par l'appelant et passé en argument.
 *
 * POURQUOI CENTRALISER
 * Cinq endroits reconstruisaient ce libellé chacun de leur côté, avec les mêmes replis recopiés
 * (`job.playerName || job.displayLabel`, `job.teamId !== null ? … : null`). Le chantier
 * d'unification (PLAN-UNIFICATION-STUDIO-FOOT.md, lot P6) doit cesser d'écrire les colonnes
 * historiques `player_name` / `player_number` / `team_id` : sans un point de passage unique, il
 * faudrait corriger cinq endroits en même temps, et en oublier un se verrait sur une commande
 * PAYÉE — un bon de production sans prénom, un e-mail d'atelier sans rien pour identifier l'œuvre.
 *
 * NE JAMAIS RENDRE UN LIBELLÉ VIDE. Si aucune source ne donne de nom, on retombe sur l'identifiant
 * de la création et on lève le drapeau `incomplete` : l'atelier voit toujours de quoi retrouver la
 * commande, et l'anomalie est signalable. Un blanc silencieux serait pire que les deux.
 */
export interface JobLabelling {
  /** Ce qui identifie la création : prénom floqué (foot), titre ou textes (générique). */
  displayName: string
  /** Numéro floqué sur l'œuvre, `null` pour un produit qui n'en a pas. */
  number: number | null
  /** Équipe / option choisie, `null` pour un produit sans choix. */
  optionName: string | null
  /**
   * `true` = aucune source n'a donné de nom et `displayName` est un repli technique. À signaler
   * (log/alerte) plutôt qu'à masquer : c'est le symptôme d'une recette mal configurée.
   */
  incomplete: boolean
}

/**
 * @param job          la création
 * @param legacyTeamName nom d'équipe déjà résolu pour un job HISTORIQUE (`team_id` non nul),
 *                       `null` sinon. L'appelant fait la requête ; cette fonction reste pure.
 */
export function describeJob(job: CustomArtJob, legacyTeamName: string | null = null): JobLabelling {
  // 1) Job historique (foot legacy) : les colonnes font foi, à l'identique d'aujourd'hui.
  if (job.playerName) {
    return {
      displayName: job.playerName,
      number: job.playerNumber ?? null,
      optionName: job.teamId !== null ? legacyTeamName : null,
      incomplete: false,
    }
  }

  // 2) Job piloté par recette : le libellé vient des entrées validées.
  const fields = job.inputs?.fields
  let optionName: string | null = null
  let number: number | null = null
  if (fields) {
    for (const value of Object.values(fields)) {
      // Le libellé de l'option est FIGÉ à la commande : une équipe renommée ensuite ne réécrit
      // pas le passé.
      if (value.type === 'choice' && optionName === null) optionName = value.label || value.value
      if (value.type === 'number' && number === null) {
        const parsed = Number(value.value)
        if (Number.isFinite(parsed)) number = parsed
      }
    }
  }

  const displayName = job.displayLabel || ''
  if (displayName.trim().length > 0) {
    return { displayName, number, optionName, incomplete: false }
  }

  // 3) Rien d'exploitable : on nomme la création par son identifiant plutôt que de rendre un blanc,
  // et on signale l'anomalie.
  return {
    displayName: `création ${String(job.uuid || '').slice(0, 8) || 'sans identifiant'}`,
    number,
    optionName,
    incomplete: true,
  }
}
