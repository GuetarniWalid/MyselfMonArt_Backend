import { z } from 'zod'

type ProductContext = {
  title: string
  description: string
  templateSuffix: string | null
  tags: string[]
  mockupTemplatePath?: string // e.g., "Cuisine/Grande cuisine" or "Vierge/Toile"
}

export default class MockupAltGenerator {
  public prepareRequest(product: ProductContext) {
    const isVierge = this.isViergeTemplate(product.mockupTemplatePath)

    return {
      responseFormat: this.getResponseFormat(isVierge),
      payload: this.getPayload(product, isVierge),
      systemPrompt: isVierge ? this.getViergePrompt() : this.getLifestylePrompt(),
    }
  }

  /**
   * Check if the mockup template is "Vierge" (product-only, no room context)
   */
  private isViergeTemplate(templatePath?: string): boolean {
    if (!templatePath) return false
    return templatePath.toLowerCase().includes('vierge')
  }

  /**
   * Extract room type and style from template path
   * E.g., "Cuisine/Grande cuisine" → { room: "cuisine", style: "grande cuisine" }
   */
  private extractTemplateInfo(templatePath?: string): { room: string; style: string } | null {
    if (!templatePath || this.isViergeTemplate(templatePath)) return null

    const parts = templatePath.split('/')
    if (parts.length === 2) {
      return {
        room: parts[0].toLowerCase(),
        style: parts[1].toLowerCase(),
      }
    }
    return null
  }

  private getResponseFormat(isVierge: boolean) {
    if (isVierge) {
      // Vierge: Focus on artwork description only
      return z.object({
        alt: z.string(),
        subjectDetected: z.string(),
        artisticStyle: z.string(), // e.g., "aquarelle", "abstrait", "géométrique"
        dominantColors: z.string(), // e.g., "tons chauds", "noir et blanc"
      })
    } else {
      // Lifestyle: Include room context
      return z.object({
        alt: z.string(),
        isLifestyle: z.boolean(),
        roomType: z.string().nullable(),
        subjectDetected: z.string(),
      })
    }
  }

  private getPayload(product: ProductContext, isVierge: boolean) {
    const basePayload = {
      productTitle: product.title,
      productDescription: product.description,
      templateSuffix: product.templateSuffix,
      tags: product.tags,
    }

    if (isVierge) {
      // Vierge: No room context needed
      return basePayload
    } else {
      // Lifestyle: Include template context
      const templateInfo = this.extractTemplateInfo(product.mockupTemplatePath)
      return {
        ...basePayload,
        mockupRoom: templateInfo?.room || 'unknown',
        mockupStyle: templateInfo?.style || 'unknown',
      }
    }
  }

  /**
   * Prompt for VIERGE mockups (product-only, focus on artwork)
   */
  private getViergePrompt() {
    return `Tu es un expert SEO et critique d'art pour MyselfMonart (décoration murale haut de gamme).
Ta mission est de générer une balise ALT pour une image produit sur fond neutre (blanc/détouré).

CONTEXTE :
L'image montre UNIQUEMENT l'œuvre (la toile, le tableau), sans aucun décor, ni meuble, ni mise en scène.

RÈGLES DE RÉDACTION :
1. ANALYSE DU SUJET (Priorité absolue) : Décris précisément ce que représente l'image (ex: animal spécifique, forme géométrique, paysage, portrait).
2. STRUCTURE CIBLE : [Sujet/Motif détaillé] + [Type de produit] + [Style/Technique/Couleur].
3. FORMAT : 5 à 10 mots (Max 125 caractères).
4. LANGUE : Français naturel et fluide.

INTERDICTIONS STRICTES (Anti-Hallucination) :
⛔ NE JAMAIS mentionner de pièce (salon, chambre, cuisine).
⛔ NE JAMAIS mentionner de mobilier (canapé, mur, lit).
⛔ NE PAS commencer par "image de" ou "vue de".

CHAMP LEXICAL ATTENDU :
– Sujets : Nom de l'animal, type de plante, description de l'abstraction, lieu géographique.
– Produits : Tableau, toile, œuvre, impression, art mural.
– Styles : Aquarelle, noir et blanc, peinture à l'huile, pop art, minimaliste, pastel.

EXEMPLES DE RÉSULTATS OPTIMISÉS :
– "Tableau tête de lion noir et blanc regard intense"
– "Toile abstraite formes géométriques bleu et or"
– "Reproduction peinture fleurs de cerisier style japonais"
– "Art mural carte du monde vintage tons sépia"`
  }

  /**
   * Prompt for LIFESTYLE mockups (room context provided in payload)
   */
  private getLifestylePrompt() {
    return `Tu es un expert SEO et décoration d'intérieur pour MyselfMonart, une marque française de tableaux décoratifs muraux haut de gamme.

CONTEXTE :
L'image montre un tableau dans un mockup lifestyle (pièce décorée avec meubles).
Les données fournies incluent : productTitle, productDescription, tags, mockupRoom (pièce), mockupStyle (style déco).

MISSION :
Génère une balise alt optimisée SEO qui décrit l'œuvre + son contexte lifestyle.

RÈGLES D'OR :
1. PRIORITÉ AU SUJET : Décris ce que représente l'œuvre (ex: tigre, femme abstraite, forêt, forme géométrique).
2. UTILISE mockupRoom et mockupStyle : Intègre la pièce (salon, chambre, cuisine) et le style déco (industriel, scandinave, minimaliste).
3. Langue : FRANÇAIS uniquement.
4. Longueur : 5 à 10 mots (50-125 caractères max).
5. Structure cible : [Sujet de l'œuvre] + [Type de produit] + [dans/pour + mockupRoom] + [mockupStyle].

INSTRUCTIONS D'ANALYSE :
– Analyse le visuel pour extraire le sujet principal de l'œuvre.
– Utilise le champ lexical spécifique au sujet (ex: tigre → "tigre", "fauve", "jungle").
– Si mockupRoom est "unknown", analyse l'image pour déterminer le type de pièce visible.
– Intègre obligatoirement mockupRoom (fourni dans les données ou détecté visuellement).
– Mentionne le style déco (mockupStyle) si pertinent.

EXEMPLES D'ALTS VALIDES :
– "Tableau tigre dans la jungle pour salon industriel"
– "Toile femme visage abstrait dans une chambre minimaliste"
– "Affiche paysage montagne noir et blanc bureau scandinave"
– "Décoration murale fleurs vintage salle à manger bohème"

CONTRAINTES TECHNIQUES :
– Évite les mots de liaison inutiles (le, la, un, une).
– Jamais commencer par "image de", "photo de".
– NE PAS dépasser 125 caractères.
– NE PAS utiliser de ponctuation finale.`
  }
}
