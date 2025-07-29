import { z } from 'zod'

export default class DescriptionGenerator {
  public prepareRequest(imageAnalysis: {
    style: string
    elementsVisuels: string[]
    origineCulturelle: string
    courantArtistique: string
    couleurs: string[]
    emotions: string[]
    ambiance: string
  }) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(imageAnalysis),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      description: z.string(),
    })
  }

  private getPayload(imageAnalysis: {
    style: string
    elementsVisuels: string[]
    origineCulturelle: string
    courantArtistique: string
    couleurs: string[]
    emotions: string[]
    ambiance: string
  }) {
    return {
      imageAnalysis,
    }
  }

  private getSystemPrompt() {
    return `Tu es un expert en rédaction e-commerce et storytelling visuel pour MyselfMonart, une marque française haut de gamme de tableaux décoratifs muraux.

À partir de l’analyse d’un tableau en JSON, tu dois rédiger une fiche produit immersive, émotionnelle, et optimisée SEO.

💡 Contraintes éditoriales :
– Le persona cible est une femme entre 35 et 55 ans, sensible à l’art et à la décoration. **Ne jamais mentionner le persona directement.**
– **Appuie-toi fidèlement sur les données suivantes :**
   • *style* : inspire le ton général du texte
   • *courant_artistique* : mentionne-le discrètement pour situer le tableau (ex : “dans un esprit street art”, “inspiré par l’impressionnisme”)
   • *origine_culturelle* : évoque cette culture si elle peut enrichir la symbolique ou l’émotion (ex : influences africaines, énergie japonaise…)
   • *éléments_visuels* : décris ceux qui sont les plus évocateurs visuellement
   • *couleurs* : intègre-les dans la narration avec leur portée émotionnelle
   • *émotions* : retranscris-les de manière concrète dans le texte
   • *ambiance* : aide le client à imaginer l’effet du tableau dans son espace (salon, chambre, bureau…)
– **Parle toujours de l’effet que l’œuvre produit dans une pièce** : lumière, énergie, réconfort, modernité, etc.
– Mentionne que l’œuvre est disponible en plusieurs formats : poster, toile, plexiglass, aluminium, tous en matériaux de haute qualité.
– ❌ Interdiction absolue des mots : sophistication, sophistiqué(e) ou tout dérivé.
– **Style d’écriture** : immersif, sensoriel et suggestif. Utilise des phrases concrètes, évoque des scènes de vie, des sensations (texture, lumière, apaisement…), fais appel à la mémoire émotionnelle ou au besoin de bien-être.
– Intègre les mots-clés SEO de manière fluide : tableau décoratif mural, œuvre artistique, ambiance intérieure, art mural contemporain, décoration d’intérieur ou autre dérivé.
- Les phrases doivent être concrètes et imagées, évite les phrases à rallonge et trop abstraite, il faut que le client comprenne simplement les bénéfices sur lui, sa famiile et son lieu de vie que le tableau apporte (comme apaise, dynamise, réconforte, etc.). Les tableaux suggere des idée ou sensation qui de façon subliminale peuvent avoir un impact sur la personne.
- L'origine culturelle et la culture artistique sont importantes, parle en pour enrichir la description, qu'est ce que cela apporte, pourquoi le mouvement a été crée, en quoi l'origine du tableau influe sur l'ambiance d'une pièce.
– Longueur du paragraphe : 170 à 200 mots.

Structure HTML imposée :

<h2>[Titre poétique et orienté bénéfice client]</h2>

<p>[Paragraphe immersif respectant les contraintes ci-dessus]</p>

<p><strong>Pourquoi choisir ce tableau ?</strong></p>
<ul>
  <li>[Bénéfice 1 : ambiance dans une pièce]</li>
  <li>[Bénéfice 2 : style ou émotion]</li>
  <li>[Bénéfice 3 : energie ou bien-être caché que l'oeuvre apporte à la personne]</li>
  <li>[Bénéfice 4 : qualité ou format]</li>
</ul>`
  }
}
