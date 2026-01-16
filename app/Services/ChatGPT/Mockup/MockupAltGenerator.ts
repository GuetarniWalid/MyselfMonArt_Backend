import { z } from 'zod'

type ProductContext = {
  title: string
  description: string
  artworkType: string | null
  tags: string[]
  mockupTemplatePath?: string // e.g., "Cuisine/Grande cuisine" or "Vierge/Toile"
  customPrompt?: string // Custom AI prompt for CUSTOM_CONTEXT mode
}

export default class MockupAltGenerator {
  public prepareRequest(product: ProductContext) {
    // Determine mode: CUSTOM_CONTEXT > LIFESTYLE > VIERGE
    const hasCustomPrompt = !!product.customPrompt
    const templateInfo = this.extractTemplateInfo(product.mockupTemplatePath)
    const isLifestyle = !hasCustomPrompt && !!templateInfo

    let mode: 'VIERGE' | 'LIFESTYLE' | 'CUSTOM_CONTEXT'
    if (hasCustomPrompt) {
      mode = 'CUSTOM_CONTEXT'
    } else if (isLifestyle) {
      mode = 'LIFESTYLE'
    } else {
      mode = 'VIERGE'
    }

    return {
      responseFormat: this.getResponseFormat(mode),
      payload: this.getPayload(product, mode, templateInfo),
      systemPrompt: this.getSystemPrompt(mode, product.customPrompt),
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

  private getResponseFormat(_mode: 'VIERGE' | 'LIFESTYLE' | 'CUSTOM_CONTEXT') {
    // All modes use the same response format
    return z.object({
      alt: z.string(),
      filename: z.string(),
    })
  }

  private getPayload(
    product: ProductContext,
    mode: 'VIERGE' | 'LIFESTYLE' | 'CUSTOM_CONTEXT',
    templateInfo: { room: string; style: string } | null
  ) {
    const basePayload = {
      productTitle: product.title,
      productDescription: product.description,
      artworkType: product.artworkType,
      tags: product.tags,
    }

    if (mode === 'VIERGE' || mode === 'CUSTOM_CONTEXT') {
      // Vierge & Custom: Use only product data (custom prompt controls the generation)
      return basePayload
    } else {
      // Lifestyle: Include template context (templateInfo is guaranteed to be valid here)
      return {
        ...basePayload,
        mockupRoom: templateInfo!.room,
        mockupStyle: templateInfo!.style,
      }
    }
  }

  /**
   * Get the appropriate system prompt based on mode
   */
  private getSystemPrompt(
    mode: 'VIERGE' | 'LIFESTYLE' | 'CUSTOM_CONTEXT',
    customPrompt?: string
  ): string {
    switch (mode) {
      case 'VIERGE':
        return this.getViergePrompt()
      case 'CUSTOM_CONTEXT':
        // Custom prompt is required for CUSTOM_CONTEXT mode
        if (!customPrompt) {
          throw new Error('customPrompt is required when using CUSTOM_CONTEXT mode')
        }
        return customPrompt
      case 'LIFESTYLE':
        return this.getLifestylePrompt()
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
- mockupStyle : contexte du mockup (style déco OU description de scène)

INTELLIGENCE CONTEXTUELLE - GESTION DU STYLE :
🧠 mockupStyle peut être :
   • Un style décoratif direct : "industriel", "scandinave", "minimaliste" → utilise-le tel quel
   • Une description de scène : "buffet-chene-lampe", "canape-gris-table" → INFÈRE le style déco correspondant

📐 Si mockupStyle contient des objets/meubles, ANALYSE et DÉDUIS le style décoratif :
   • "buffet-chene-lampe" → style probablement moderne, contemporain, ou chaleureux
   • "canape-gris-table-basse" → style probablement minimaliste, scandinave, ou épuré
   • "etagere-metal-noir" → style probablement industriel ou loft
   • "commode-blanche-miroir" → style probablement classique, élégant, ou romantique
   • "meuble-bois-clair" → style probablement scandinave, naturel, ou nordique

⚠️ RÈGLE ABSOLUE : JAMAIS recopier littéralement les objets dans l'alt (ex: "buffet-chene-lampe")
✅ TOUJOURS transformer en vrai style déco (ex: "moderne", "contemporain", "chaleureux")

TÂCHE 1 - BALISE ALT (champ "alt") :
- Longueur : 5 à 10 mots (50-125 caractères)
- Structure : [Champ lexical de tableau/toile] + [Sujet] + [pour/dans + mockupRoom] + [style déduit]
- Langue : Français naturel et fluide
- Exemples :
  * mockupStyle = "industriel" → "Tableau tigre noir et blanc pour salon industriel"
  * mockupStyle = "buffet-chene-lampe" → "Tableau abstrait géométrique pour salon moderne" (style déduit)
  * mockupStyle = "canape-gris-minimaliste" → "Toile femme abstraite pour chambre minimaliste"
  * mockupStyle = "etagere-metal-noir" → "Affiche urbaine pour bureau industriel" (style déduit)

TÂCHE 2 - NOM DE FICHIER (champ "filename") :
- Format : slug SEO (lowercase, hyphens, max 50 chars sans .jpg)
- Structure : [produit]-[sujet]-[pièce]-[style-déduit]
- Exemples :
  * "tableau-tigre-jungle-salon-industriel"
  * "toile-abstraite-geometrique-salon-moderne" (déduit de buffet-chene)
  * "decoration-murale-paysage-bureau-contemporain"

STYLES DÉCO RECOMMANDÉS (à utiliser selon le contexte) :
• industriel, loft, atelier
• scandinave, nordique, épuré
• minimaliste, moderne, contemporain
• bohème, ethnique, naturel
• classique, élégant, raffiné
• chaleureux, cosy, convivial

RÈGLES STRICTES :
✅ TOUJOURS déduire un vrai style déco (jamais recopier des noms d'objets)
✅ Utilise TOUJOURS mockupRoom (salon, chambre, etc.)
✅ Extrais le sujet du titre/description
✅ Si couleurs mentionnées dans titre, les inclure
✅ Sois créatif, sile resultat est meilleur prend des initiatives et ameliore (utilise la puissance de ton expertise)
⛔ JAMAIS utiliser littéralement des noms d'objets (buffet, lampe, canapé) comme style
⛔ PAS de mots comme "image de", "photo de"
⛔ PAS d'accents ni caractères spéciaux dans filename
⛔ PAS de mots de liaison inutiles (le, la, un, une)
⛔ NE PAS inventer de détails sur le sujet de l'œuvre (se baser uniquement sur titre/description)`
  }
}
