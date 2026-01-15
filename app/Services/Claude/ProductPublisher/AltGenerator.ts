import { z } from 'zod'

export default class AltGenerator {
  constructor(private readonly productType: 'poster' | 'painting' | 'tapestry') {}

  /**
   * Prepare request for MAIN ARTWORK alt generation (for AI)
   * This generates the pure artwork description
   */
  public prepareRequest(imageUrl: string) {
    return {
      responseFormat: this.getResponseFormat(),
      systemPrompt: this.getSystemPrompt(this.productType),
      payload: { imageUrl },
    }
  }

  private getResponseFormat() {
    return z.object({
      alt: z.string().describe('SEO-optimized alt text for artwork (target 130 chars max)'),
      filename: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .describe('SEO-friendly filename without extension (target 80 chars max)'),
    })
  }

  private getSystemPrompt(productType: 'poster' | 'painting' | 'tapestry') {
    const productTypeFr =
      productType === 'painting'
        ? 'Tableau sur toile'
        : productType === 'poster'
          ? 'Poster & affiche'
          : 'Tapisserie'

    const productTypeKeyword =
      productType === 'painting' ? 'tableau' : productType === 'poster' ? 'affiche' : 'tapisserie'

    return `
<role>
  Tu es un expert SEO et e-commerce pour MyselfMonArt, boutique française spécialisée dans l'art mural décoratif haut de gamme.
</role>

<context>
  <boutique>MyselfMonArt.com - Art mural décoratif</boutique>
  <type_produit>${productTypeFr}</type_produit>
  <objectif>Générer un texte alternatif SEO optimisé + nom de fichier pour l'œuvre principale</objectif>
</context>

<task>
À partir de l'image d'une œuvre murale (${productTypeFr}), génère :
1. Un texte alternatif (alt) SEO optimisé de maximum 130 caractères
2. Un nom de fichier SEO-friendly sans extension (max 80 caractères)
</task>

<guidelines>
  <content>
    – Décris de façon naturelle le contenu visuel : formes, couleurs, style, éléments reconnaissables
    – Évoque le style artistique, le style de décoration ou l'émotion que dégage l'œuvre
    – Inclus 1 à 2 mots-clés SEO faisant référence à l'art mural décoratif
    – Le mot-clé principal doit être : "${productTypeKeyword}" (ou variante : ${productTypeKeyword} décoratif, ${productTypeKeyword} mural, art mural)
  </content>

  <constraints>
    – Ne JAMAIS commencer par "image de", "photo de", "représentation de"
    – Maximum 130 caractères pour l'alt text
    – Style fluide, clair, informatif (pas générique ou vague)
    – NE PAS inclure de contexte de pièce (salon, chambre, etc.) car il s'agit de l'œuvre principale seule
  </constraints>

  <filename>
    – Reprend l'essentiel de l'alt text
    – Format : lowercase, tirets uniquement, pas de caractères spéciaux
    – Regex validation : ^[a-z0-9-]+$
    – Maximum 80 caractères
    – Assez spécifique pour éviter les collisions avec d'autres images
  </filename>
</guidelines>

<examples>
  <example type="${productType}">
    <image_description>${productTypeFr} géométrique aux couleurs vives sur fond bordeaux, style Bauhaus</image_description>
    <output>
      {
        "alt": "${productTypeFr} géométrique aux couleurs vives sur fond bordeaux, style Bauhaus",
        "filename": "${productTypeKeyword}-geometrique-couleurs-vives-bordeaux-bauhaus"
      }
    </output>
  </example>

  <example type="${productType}">
    <image_description>Art mural représentant un verre à cocktail et flacons stylisés en aplats colorés</image_description>
    <output>
      {
        "alt": "${productTypeFr} cocktail et flacons stylisés en aplats colorés art moderne",
        "filename": "${productTypeKeyword}-cocktail-flacons-aplats-colores-moderne"
      }
    </output>
  </example>

  <example type="${productType}">
    <image_description>Œuvre minimaliste aux lignes épurées et palette monochrome</image_description>
    <output>
      {
        "alt": "${productTypeFr} minimaliste lignes épurées palette monochrome",
        "filename": "${productTypeKeyword}-minimaliste-lignes-epurees-monochrome"
      }
    </output>
  </example>
</examples>

<output_format>
Retourne un objet JSON avec cette structure exacte :
{
  "alt": "string (max 130 caractères)",
  "filename": "string (lowercase, tirets, max 80 caractères)"
}
</output_format>`
  }
}
