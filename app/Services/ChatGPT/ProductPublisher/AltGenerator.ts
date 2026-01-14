import { z } from 'zod'

export default class AltGenerator {
  /**
   * Prepare request for MAIN ARTWORK alt generation (for AI)
   * This generates the pure painting description
   */
  public prepareRequest(imageUrl: string) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(imageUrl),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  /**
   * Generate mockup alt text programmatically (no AI call needed)
   * Combines mockup context with artwork description
   */
  public generateMockupAlt(
    mockupContext: string,
    artworkDescription: string
  ): {
    alt: string
    filename: string
  } {
    const combinedAlt = this.combineMockupWithArtwork(mockupContext, artworkDescription)
    const filename = this.generateFilenameFromAlt(combinedAlt)

    return { alt: combinedAlt, filename }
  }

  /**
   * Intelligently combine mockup context with artwork description
   */
  private combineMockupWithArtwork(mockupContext: string, artworkDescription: string): string {
    // Clean up descriptions
    const cleanContext = mockupContext.trim()
    const cleanArtwork = artworkDescription.trim()

    // If mockupContext already includes "dans", "pour", or "sur", use it as suffix
    if (cleanContext.toLowerCase().match(/\b(dans|pour|sur)\b/)) {
      const combined = `${cleanArtwork} ${cleanContext}`
      return this.truncateToMaxLength(combined, 130)
    }

    // Otherwise, add "dans" connector
    const combined = `${cleanArtwork} dans ${cleanContext}`
    return this.truncateToMaxLength(combined, 130)
  }

  /**
   * Truncate text to maximum length
   */
  private truncateToMaxLength(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text
    }
    return text.substring(0, maxLength - 3) + '...'
  }

  /**
   * Generate SEO-friendly filename from alt text
   */
  private generateFilenameFromAlt(alt: string): string {
    return alt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Remove duplicate hyphens
      .substring(0, 80) // Limit length
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

  /**
   * Updated prompt for main artwork (no mockup context)
   */
  private getSystemPrompt() {
    return `Tu es un expert SEO et e-commerce pour MyselfMonart, une marque française de tableaux décoratifs muraux haut de gamme.
À partir de l'URL d'une image représentant un tableau décoratif mural (l'œuvre d'art principale, sans contexte de pièce).

Ta mission est de générer une balise alt optimisée pour le référencement, sous forme de phrase courte et descriptive, sans langage promotionnel, ainsi que le nom du fichier.

Contraintes éditoriales :
– Le texte doit décrire de façon naturelle le contenu visuel de l'image (formes, couleurs, style, éléments reconnaissables)
– Il doit évoquer le style artistique, le style de décoration ou l'émotion que dégage l'œuvre
– Tu dois y inclure 1 à 2 mots-clés SEO faisant référence au champ lexical d'un tableau de décoration
– Ne commence jamais par "image de" ou "photo de"
– Ne dépasse pas 130 caractères
– Utilise un style fluide, clair, informatif (pas de phrases trop génériques ou floues)
– Le nom du fichier doit reprendre l'essentiel du alt mais être suffisamment court pour éviter un nom trop générique qui pourrait avoir des collisions avec d'autres images
– Le nom du fichier ne doit pas contenir de caractères spéciaux
– NE PAS inclure de contexte de pièce (salon, chambre, etc.) car il s'agit de l'œuvre principale

Exemples de bons alt :
– Tableau décoratif mural géométrique aux couleurs vives sur fond bordeaux, style Bauhaus
– Art mural contemporain représentant un verre à cocktail et des flacons stylisés en aplats colorés
– Œuvre artistique minimaliste aux lignes épurées et palette monochrome`
  }
}
