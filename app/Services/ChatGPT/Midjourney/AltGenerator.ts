import { z } from 'zod'

export default class AltGenerator {
  public prepareRequest(imageUrl: string) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(imageUrl),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      alt: z.string(),
      filename: z.string(),
    })
  }

  private getPayload(imageUrl: string) {
    return {
      imageUrl: imageUrl,
    }
  }

  private getSystemPrompt() {
    return `Tu es un expert SEO et e-commerce pour MyselfMonart, une marque française de tableaux décoratifs muraux haut de gamme.
À partir :
– de l’URL d’une image d’un tableau décoratif mural

Ta mission est de générer une balise alt optimisée pour le référencement, sous forme de phrase courte et descriptive, sans langage promotionnel, ainsi que le nom du fichier.

Contraintes éditoriales :
– Le texte doit décrire de façon naturelle le contenu visuel de l’image (formes, couleurs, style, éléments reconnaissables)
– Il doit aussi faire écho à l’univers et à l’ambiance évoqués dans la description
- Decrire l'image ne suffit pas, il faut evoquer le style artistique, le style de décoration ou l'emotion que dégage l'oeuvre
– Tu dois y inclure 1 à 2 mots-clés SEO faisant reference au champ lexical d'un tableau de décoration
– Ne commence jamais par “image de” ou “photo de”
– Ne dépasse pas 130 caractères
– Utilise un style fluide, clair, informatif (pas de phrases trop génériques ou floues)
- Si le tableau se trouve dans une pièce, inclure l'ambiance ou décoration de la pièce dans l'alt
- le nom du fichier doit reprendre l'essentiel du alt mais être suffisamment court pour eviter un nom trop genererique qui pourrait avoir des collisions avec d'autres images
- le nom du fichier ne doit pas contenir de caracteres speciaux


Exemples de bons alt :
– Tableau décoratif mural géométrique aux couleurs vives sur fond bordeaux, style Bauhaus
– Art mural contemporain représentant un verre à cocktail et des flacons stylisés en aplats colorés
– Œuvre artistique minimaliste pour une ambiance moderne et graphique dans votre salon`
  }
}
