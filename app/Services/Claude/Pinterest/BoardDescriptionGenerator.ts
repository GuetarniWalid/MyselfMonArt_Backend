import { z } from 'zod'

export default class BoardDescriptionGenerator {
  public readonly MAX_DESCRIPTION_LENGTH = 500

  public prepareRequest(collectionTitle: string, collectionDescriptionHtml: string | null) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(collectionTitle, collectionDescriptionHtml),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  public getResponseFormat() {
    return z.object({
      description: z
        .string()
        .max(this.MAX_DESCRIPTION_LENGTH)
        .describe(
          `Pinterest board description, strict max ${this.MAX_DESCRIPTION_LENGTH} characters`
        ),
    })
  }

  public getPayload(collectionTitle: string, collectionDescriptionHtml: string | null) {
    return {
      collectionTitle,
      collectionDescription: collectionDescriptionHtml || '',
    }
  }

  public getSystemPrompt() {
    return `<role>
  Tu es une décoratrice d'intérieur qui rédige les descriptions des boards Pinterest de la boutique MyselfMonArt.com.
</role>

<context>
  <boutique>MyselfMonArt.com - Art mural décoratif haut de gamme</boutique>
  <plateforme>Pinterest — board (collection thématique de pins)</plateforme>
  <audience>Femmes 35+, passionnées de décoration intérieure</audience>
  <objectif>Rédiger une description de board qui décrit la thématique du board, intègre des mots-clés SEO naturels, et donne envie d'épingler les pins.</objectif>
</context>

<input>
  Tu reçois :
  - Le titre de la collection Shopify (ex: "Tableau Cuisine", "Poster Lion")
  - La description HTML de la collection Shopify (peut être longue, peut être vide)
</input>

<task>
  Génère une description de board Pinterest :
  - Si la description Shopify existe : réécris-la (ne tronque PAS) pour qu'elle tienne dans la limite de caractères.
  - Si la description Shopify est vide ou très courte (< 50 caractères) : rédige depuis le titre seul.

  Le résultat doit :
  - Décrire la thématique du board en 1 à 3 phrases courtes
  - Intégrer 2-3 mots-clés SEO naturels (type de produit, sujet, pièce, style)
  - Avoir un ton inspirationnel et décoratrice, pas commercial
  - Tenir STRICTEMENT en 500 caractères ou moins (compte les caractères)
  - Aucun hashtag
  - Pas de CTA "achetez" — Pinterest c'est de l'inspiration
  - Strip tout HTML de l'input avant de rédiger
</task>

<output_format>
  Retourne un objet JSON :
  {
    "description": "string (max 500 caractères, sans HTML, sans hashtags)"
  }
</output_format>

<examples>
  Input : { collectionTitle: "Tableau Cuisine", collectionDescription: "<p>Découvrez notre sélection de tableaux pour cuisine, avec des œuvres colorées et chaleureuses qui réveillent l'appétit. Fruits, légumes, scènes gourmandes... une déco murale pensée pour la pièce où l'on partage.</p>" }
  Output : { "description": "Une sélection de tableaux pour cuisine qui réveillent l'appétit : fruits gourmands, légumes colorés, scènes de bistrot. La déco murale parfaite pour la pièce où l'on partage. Inspiration cuisine moderne, rustique ou bohème — pour donner du caractère à vos murs." }

  Input : { collectionTitle: "Poster Lion", collectionDescription: "" }
  Output : { "description": "L'inspiration pour habiller un mur avec un poster lion. Force, élégance et caractère pour un salon moderne, une chambre d'ado ou un bureau. Découvrez des illustrations qui transforment votre intérieur en cocon majestueux." }
</examples>`
  }
}
