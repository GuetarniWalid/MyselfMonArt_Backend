import { z } from 'zod'

export default class ImageAnalyzer {
  public prepareRequest(imageUrl: string) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(imageUrl),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      style: z.string(),
      elementsVisuels: z.array(z.string()),
      origineCulturelle: z.string(),
      courantArtistique: z.string(),
      couleurs: z.array(z.string()),
      emotions: z.array(z.string()),
      ambiance: z.string(),
    })
  }

  private getPayload(imageUrl: string) {
    return {
      imageUrl,
    }
  }

  private getSystemPrompt() {
    return `Tu es un expert en analyse artistique visuelle. Ta mission est d’observer une image de tableau décoratif mural.

Tu dois extraire uniquement les informations suivantes, de manière concise et factuelle, sans interprétation excessive.

Rends la réponse au format JSON exactement comme indiqué ci-dessous :

{
  "style": "[Décris le style artistique général : zen, pop art, abstrait, manga, nature, street art, arabe, ethnique, calligraphie, etc.]",
  "origine_culturelle": "[Si identifiable : culture, pays ou région d’inspiration de l’œuvre (ex : Japon, Afrique de l’Ouest, art amérindien, Europe baroque…) Sinon, note : 'Non identifiable']",
  "courant_artistique": "[Courant artistique ou influence visuelle dominante : ex. street art, impressionnisme, photographie contemporaine, art tribal, art numérique, surréalisme…]",
  "éléments_visuels": ["liste descriptive des éléments visuels présents dans l’image"],
  "couleurs": ["principales couleurs dominantes"],
  "émotions": ["émotions ressenties en regardant l’image"],
  "ambiance": "[ambiance que ce tableau apporte à une pièce intérieure]"
}`
  }
}
