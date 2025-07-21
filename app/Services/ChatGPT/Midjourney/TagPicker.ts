import { z } from 'zod'

export default class TagPicker {
  public prepareRequest(tags: string[], imageUrl: string) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(tags, imageUrl),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      tags: z.array(z.string()),
    })
  }

  private getPayload(tags: string[], imageUrl: string) {
    return {
      tags: JSON.stringify(tags),
      imageUrl,
    }
  }

  private getSystemPrompt() {
    return `🎯 OBJECTIF
Identifier automatiquement les tags les plus représentatifs et utiles pour une fiche produit de tableau décoratif, à partir de l’image et d’un ensemble de tags disponibles.

Les tags sélectionnés doivent servir à :
– Classer l’œuvre dans les collections thématiques appropriées (Zen, Nature, Animaux, Street Art, etc.)
– Activer des filtres pertinents pour les visiteurs (style, ambiance, format, couleurs, émotions, etc.)
– Éviter les tags hors sujet ou génériques qui pourraient induire en erreur ou nuire à l’expérience de navigation.

🧠 LOGIQUE DE SÉLECTION À RESPECTER
Pertinence visuelle et narrative
Ne retenir que les tags qui décrivent fidèlement l’univers visuel ou émotionnel de l’œuvre (ex : un tableau avec des fleurs peut être "nature", "fleurs", "douceur", mais pas "animal" ou "urbain").
Ne pas inventer de nouveaux tags.

Cohérence décorative
Prendre en compte l’ambiance que l’œuvre peut générer dans une pièce (ex : "zen", "reposant", "énergique", "intimiste", etc.), même si ce n’est pas explicitement dit dans le titre.

Utilité pour le client
Ne garder que les tags qui ont un véritable rôle de filtre pour aider le client à trouver ce qu’il cherche. Un bon tag est soit visuel (élément visible), soit émotionnel (ressenti décoratif), soit stylistique (genre d’art ou de déco).

📥 ENTRÉES
– Image de l’œuvre
– Liste complète de tags disponibles

📤 SORTIE ATTENDUE
– Une liste de tags pertinents au format array
– Chaque tag doit pouvoir être justifié visuellement ou émotionnellement.
– La sélection doit être optimisée pour la navigation client et la cohérence des collections.

📝 EXEMPLE
Image : Un tableau représentant un cerisier en fleur avec un ciel pastel, ambiance douce.
Tags disponibles : ["animaux", "fleurs", "zen", "japon", "urbain", "sombre", "printemps", "minimaliste", "lion", "océan", "romantique"]

Résultat attendu :
["fleurs", "zen", "printemps", "japon", "romantique"]`
  }
}
