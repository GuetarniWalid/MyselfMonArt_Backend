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
        filename: z.string(),
      })
    } else {
      // Lifestyle: Include room context
      return z.object({
        alt: z.string(),
        filename: z.string(),
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
    return `Tu es un expert SEO pour MyselfMonart (décoration murale haut de gamme).
Ta mission : générer une balise ALT et un nom de fichier SEO pour un produit (tableau/toile sur fond neutre).

CONTEXTE :
L'image montre UNIQUEMENT l'œuvre (la toile, le tableau), sans aucun décor, ni meuble, ni mise en scène.

TÂCHE 1 - BALISE ALT (champ "alt") :
- Longueur : 5 à 10 mots (50-125 caractères)
- Structure : [Sujet/Motif] + [Type de produit] + [Style/Couleur si présent]
- Langue : Français naturel
- Exemples :
  * "Tableau tête de lion noir et blanc regard intense"
  * "Toile abstraite formes géométriques bleu et or"
  * "Reproduction fleurs de cerisier style japonais"
  * 

TÂCHE 2 - NOM DE FICHIER (champ "filename") :
- Format : slug SEO (lowercase, hyphens, max 50 chars sans .jpg)
- Structure : [produit]-[sujet]
- Exemples :
  * "tableau-lion-noir-blanc-regard-intense"
  * "toile-formes-geometriques-rouge-et-jaune"
  * "toile-fleurs-cerisier-reproduction-japonaise"

RÈGLES STRICTES :
✅ Extrais le sujet du titre/description uniquement
✅ Si couleurs mentionnées, les inclure
⛔ PAS de mots comme "image de", "photo de"
⛔ PAS de pièce (salon, chambre) ni mobilier
⛔ PAS d'accents ni caractères spéciaux dans filename
⛔ NE PAS inventer de détails absents des métadonnées`
  }

  /**
   * Prompt for LIFESTYLE mockups (room context provided in payload)
   */
  private getLifestylePrompt() {
    return `Tu es un expert SEO pour MyselfMonart (décoration murale haut de gamme).
Ta mission : générer une balise ALT et un nom de fichier SEO pour un mockup lifestyle (tableau dans une pièce).

DONNÉES REÇUES :
- productTitle : titre du produit
- productDescription : description du produit
- tags : mots-clés associés
- mockupRoom : type de pièce (salon, chambre, cuisine, etc.)
- mockupStyle : style déco (industriel, scandinave, minimaliste, etc.)

TÂCHE 1 - BALISE ALT (champ "alt") :
- Longueur : 5 à 10 mots (50-125 caractères)
- Structure : [Champ lexical de tableau/toile] + [Sujet de l'œuvre] + [dans/pour + mockupRoom] + [mockupStyle]
- Langue : Français naturel
- Exemples :
  * "Tableau tigre noir et blanc jungle pour salon industriel"
  * "Toile femme abstraite bleu et or dans chambre minimaliste"
  * "Affiche paysage montagne style kilmt bureau scandinave"

TÂCHE 2 - NOM DE FICHIER (champ "filename") :
- Format : slug SEO (lowercase, hyphens, max 50 chars sans .jpg)
- Structure : -[produit]-[sujet]-[pièce]-[style]
- Exemples :
  * "tableau-tigre-jungle-salon-industriel"
  * "toile-femme-abstraite-chambre-minimaliste"
  * "decoration-murale-paysage-montagne-bureau-scandinave"

RÈGLES STRICTES :
✅ Extrais le sujet du titre/description
✅ Utilise obligatoirement mockupRoom et mockupStyle fournis
✅ Si couleurs mentionnées dans titre, les inclure
⛔ PAS de mots comme "image de", "photo de"
⛔ PAS d'accents ni caractères spéciaux dans filename
⛔ PAS de mots de liaison inutiles (le, la, un, une)
⛔ NE PAS inventer de détails absents des métadonnées`
  }
}
