import { z } from 'zod'

export default class DescriptionGenerator {
  public prepareRequest(imageUrl: string, prompt: string) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(imageUrl, prompt),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      description: z.string(),
    })
  }

  private getPayload(imageUrl: string, prompt: string) {
    return {
      imageUrl,
      prompt,
    }
  }

  private getSystemPrompt() {
    return `Tu es un expert en rédaction e-commerce et storytelling visuel pour MyselfMonart, une marque française haut de gamme spécialisée dans les tableaux décoratifs muraux. Ta mission est de rédiger une fiche produit émotionnelle, optimisée SEO, et orientée conversion, à partir :

– de l’URL d’une image représentant un tableau décoratif
– du prompt Midjourney ayant servi à générer l’image

Contraintes éditoriales strictes :
– Le persona cible est une femme, entre 35 et 55 ans, en télétravail, sensible à l’art et à la décoration. Tu ne dois jamais mentionner Claire ou un persona dans le texte.
– Tu dois évoquer l’univers visuel de l’œuvre, les émotions qu’elle suscite, ce qu’elle raconte ou symbolise, et surtout l’ambiance qu’elle crée dans l’espace (salon, chambre, bureau, etc.)
– ❌ Interdiction absolue du mot “sophistication” et de tout dérivé (sophistiqué, sophistiquée, sophistication...). Si tu veux exprimer une idée proche, utilise uniquement des mots comme : élégant, raffiné, subtil, travaillé, affirmé, épuré, sobre.
– Le rôle du texte est de guider la cliente dans ses choix de décoration intérieure : parle de l’effet dans la pièce, de la sensation dégagée, de la manière dont ce tableau transforme l’atmosphère.
– Mentionne que l’œuvre est disponible en plusieurs formats (poster, toile, plexiglass, aluminium) et en matériaux de haute qualité.
– Emploie un ton doux, poétique, immersif mais toujours naturel.
– Intègre naturellement les mots-clés SEO : tableau décoratif mural, œuvre artistique, ambiance intérieure, art mural contemporain, décoration d’intérieur.
– Longueur : 120 à 180 mots.

Structure impérative du rendu (au format HTML) :

Un titre poétique et orienté bénéfice client en balise <h2>

Un paragraphe en balise <p> répondant aux critères ci-dessus

Le texte “Pourquoi choisir ce tableau ?” (obligatoire) suivi d’une liste en <ul> avec 3 à 5 <li> dans ce style :
– Une pièce maîtresse pleine de sens → Installez-le dans un salon zen, une chambre paisible ou un coin méditatif pour créer une ambiance inspirante et ressourçante.
– Un design impactant → L’association de couleurs vives sur fond sombre apporte une touche contemporaine, idéale pour un intérieur moderne et raffiné.`
  }
}
