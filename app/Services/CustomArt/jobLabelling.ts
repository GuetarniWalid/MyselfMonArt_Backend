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
 *
 * LES TROIS MORCEAUX SONT RENDUS SÉPARÉS, JAMAIS DÉJÀ ASSEMBLÉS.
 * Tous les consommateurs composent eux-mêmes : « WALID n°10 (Paris Saint-Germain) », « WALID · n°10
 * — Paris Saint-Germain »… Si `displayName` contenait déjà le numéro et l'équipe — ce que fait le
 * libellé brut `job.displayLabel` sur le chemin recette, où il vaut « Paris Saint-Germain WALID
 * 10 » —, chaque consommateur les redirait une deuxième fois : « Paris Saint-Germain WALID 10 n°10
 * (Paris Saint-Germain) », sur un e-mail CLIENT d'une commande PAYÉE. `displayName` est donc
 * toujours NU : le nom, et rien d'autre.
 */
export interface JobLabelling {
  /**
   * Ce qui identifie la création, NU : le prénom floqué (foot), sinon les textes libres saisis.
   * Ne contient jamais le numéro ni l'option — ils sont rendus à part, ci-dessous.
   */
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
 * Le libellé court « NOM NUMÉRO » des e-mails d'atelier (ligne « Création : … », objet de l'e-mail
 * de reprise). L'option n'y figure PAS : ces e-mails l'affichent déjà sur leur propre ligne
 * « Équipe ».
 *
 * Sortie identique à celle d'aujourd'hui sur le chemin historique (« WALID 10 »), d'où le passage
 * par ce seul assembleur plutôt que par `job.displayLabel` — qui, lui, préfixe l'option sur le
 * chemin recette et donnerait « Paris Saint-Germain WALID 10 » juste au-dessus d'une ligne
 * « Équipe : Paris Saint-Germain ».
 */
export function shortLabel(label: JobLabelling): string {
  return label.number !== null ? `${label.displayName} ${label.number}` : label.displayName
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
  const texts: string[] = []
  if (fields) {
    for (const value of Object.values(fields)) {
      // Le libellé de l'option est FIGÉ à la commande : une équipe renommée ensuite ne réécrit
      // pas le passé.
      if (value.type === 'choice' && optionName === null) optionName = value.label || value.value
      if (value.type === 'number' && number === null) {
        const parsed = Number(value.value)
        if (Number.isFinite(parsed)) number = parsed
      }
      // Le NOM, c'est le texte libre saisi — pas le choix (rendu par `optionName`) ni le nombre
      // (rendu par `number`). Les reprendre ici les ferait dire deux fois chez l'appelant.
      if (value.type === 'text' && typeof value.value === 'string' && value.value.trim()) {
        texts.push(value.value.trim())
      }
    }
  }

  // Le libellé brut du modèle (`displayLabel`) reste le repli des recettes sans texte libre : un
  // titre composé par la recette, ou les textes par personne. Ces deux-là sont déjà NUS.
  // Sa DERNIÈRE branche, en revanche, joint les champs déclarés — donc l'option et le nombre. La
  // reprendre ferait tout redire à l'appelant. On la refuse et on tombe sur le nom par
  // identifiant : mieux vaut « création 1a6fb5b2 », signalée comme incomplète, qu'un e-mail
  // client bégayant.
  const brutVientDesChamps =
    Boolean(fields) && !job.inputs?.title && !(job.inputs?.tokens && job.inputs.tokens.length > 0)
  const displayName =
    texts.length > 0 ? texts.join(' ') : brutVientDesChamps ? '' : job.displayLabel || ''
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
