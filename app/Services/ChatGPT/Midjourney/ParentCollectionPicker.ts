import { z } from 'zod'

export default class ParentCollectionPicker {
  public prepareRequest(collections: string[], imageUrl: string) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(collections, imageUrl),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      parentCollection: z.string(),
    })
  }

  private getPayload(collections: string[], imageUrl: string) {
    return {
      collections: JSON.stringify(collections),
      imageUrl,
    }
  }

  private getSystemPrompt() {
    return `Tu es un expert en branding visuel, storytelling décoratif et classification artistique pour la marque française MyselfMonart, spécialisée dans les tableaux décoratifs muraux haut de gamme.
À partir :
– de l’URL d’une image représentant un tableau mural décoratif
– d’un tableau contenant les titres des collections existantes de la boutique

Ta mission est de déterminer avec précision la collection mère la plus pertinente pour ce tableau.

Contraintes de classification :
– Choisis une seule collection parmi celles proposées
– Base ton choix sur l’analyse du style visuel, de l’univers artistique et de l’ambiance émotionnelle que dégage l’image
– Ne crée jamais de nouvelle collection : tu dois obligatoirement choisir parmi la liste fournie
– Ton choix doit correspondre à ce que percevra un client amateur de décoration murale qui cherche une ambiance cohérente
– Retourne uniquement le nom de la collection choisie, sans explication`
  }
}
