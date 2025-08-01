import { z } from 'zod'

export default class DescriptionGenerator {
  public prepareRequest(imageUrl: string) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(imageUrl),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      description: z.string(),
    })
  }

  private getPayload(imageUrl: string) {
    return {
      imageUrl,
    }
  }

  private getSystemPrompt() {
    return `🎯 Objectif :
Rédiger une fiche produit immersive, émotionnelle, et optimisée SEO, à partir d’un tableau décoratif mural.
La fiche doit guider une personne sensible à l’art et à la décoration, qui doute, compare, cherche à se projeter et à se rassurer.

🟨 ÉTAPE 0. Analyse visuelle : type de pièce et mot-clé SEO principal
Analyse d’abord l’image du tableau pour déterminer à quelle pièce de la maison il correspond naturellement, parmi ces quatre options :
  - Chambre d’enfant
  - Cuisine
  - Salon / Chambre adulte
  - Salle de bain / Toilettes

⚠️ Cette classification est essentielle : elle détermine le ton global du texte à suivre.
Par exemple :

  - Un tableau mignon ou éducatif = chambre d’enfant
  - Un motif culinaire ou graphique = cuisine
  - Un visuel abstrait, élégant ou artistique = salon ou chambre
  - Une affiche légère, fleurie ou humoristique = salle de bain ou toilettes

Ensuite, identifie le sujet principal du tableau (ex. : calligraphie arabe, animal rigolo, scène florale, portrait stylisé…).

Enfin, déduis le mot-clé SEO principal le plus pertinent que les gens pourraient taper dans Google.
✅ Le mot-clé doit toujours commencer par tableau ou affiche.

Exemples valides :

  - tableau calligraphie arabe
  - tableau lion enfant
  - affiche cuisine légumes
  - tableau abstrait bleu
  - tableau zen chambre

🟨 ÉTAPE 1. Liste des bénéfices concrets
<h2>Pourquoi choisir ce tableau ?</h2>
<ul>
  <li>[Bénéfice 1 : ambiance dans une pièce]</li>
  <li>[Bénéfice 2 : style ou émotion]</li>
  <li>[Bénéfice 3 : effet positif ou sensation ressentie]</li>
  <li>[Bénéfice 4 : qualité ou formats disponibles]</li>
</ul>

🟨 ÉTAPE 2. Titre accrocheur
<h2>[Un titre simple, évocateur, qui donne envie de lire la suite]</h2>
Le titre doit évoquer en une phrase ce que l’œuvre apporte à la pièce (ex. : apaisement, lumière, chaleur, énergie douce…).
Pas de termes techniques ni de formules abstraites.

🟨 ÉTAPE 3. Paragraphe descriptif immersif (170 à 200 mots)
<p>[Un seul paragraphe fluide, naturel, visuel et émotionnel]</p>
Suis cet ordre logique :

Description visuelle simple
→ Ce que montre le tableau : formes, couleurs, composition, s’il y a une inspiration culturelle ou une technique identifiable, explique-la simplement.

Effet dans la pièce
→ Ce que cela crée visuellement (mouvement doux, équilibre, apaisement, effet central, sensation de calme, etc.).

Couleurs et ambiance
→ Que provoquent-elles dans la pièce ? (lumière, chaleur, douceur, profondeur, élégance…)

Suggestion d’emplacement dans la maison
→ Exemples concrets : au-dessus du canapé, dans une chambre, dans l’entrée, etc.

Impact décoratif global
→ Ce que le tableau apporte à la décoration : style, personnalité, harmonie, sans en faire trop.

Formats disponibles
→ Termine par : Disponible en poster, toile, aluminium ou plexiglass, selon vos envies.

🟨 ÉTAPE 4. Structure HTML final imposée :
<h2>Pourquoi choisir ce tableau ?</h2>
<ul>
  <li>[Bénéfice 1 : ambiance dans une pièce]</li>
  <li>[Bénéfice 2 : style ou émotion]</li>
  <li>[Bénéfice 3 : energie ou bien-être caché que l'oeuvre apporte à la personne]</li>
  <li>[Bénéfice 4 : qualité ou format]</li>
</ul>

<h2>[Titre poétique et orienté bénéfice client]</h2>
<p>[Paragraphe immersif respectant les contraintes ci-dessus]</p>


🟥 CONTRAINTE DE STYLE – Mots interdits
Les mots ou expressions suivants sont interdits car trop techniques, flous, jargonneux ou trop décorateurs d’intérieur.
Ils ne correspondent ni au vocabulaire, ni à la sensibilité du persona visé.

Ne jamais utiliser :
  - point focal
  - contemporain
  - sophistication / sophistiqué(e)
  - graphique (en tant que style décoratif)
  - chromatique
  - palette (dans "palette de couleurs")
  - contratse (isolé ou dans "contraste graphique")
  - structure / structurer
  - symétrie / asymétrie
  - impact (visuel ou décoratif)
  - équilibre (sans contexte concret)
  - dynamique visuelle
  - transforme l’espace
  - valorise l’intérieur
  - composition audacieuse
  - narration visuelle
  - univers chromatique
  - épure contemporaine

🟡 Si un mot est abstrait, technique ou décoratif sans signification claire pour une personne non-initiée, réécris la phrase avec des mots simples, humains et visuels.


🟥 Le texte final doit être en html, avec les balises h2, p, ul, li et ne contenir aucun markdown.`
  }
}
