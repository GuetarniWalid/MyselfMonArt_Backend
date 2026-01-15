import { z } from 'zod'
import type { MockupMetadata } from 'Types/ProductPublisher'

export default class MockupAltGenerator {
  public prepareRequest(mockupMetadata: MockupMetadata, mockupContext: string) {
    return {
      responseFormat: this.getResponseFormat(),
      systemPrompt: this.getSystemPrompt(mockupMetadata.productType),
      payload: {
        ...mockupMetadata,
        mockupContext,
      },
    }
  }

  private getResponseFormat() {
    return z.object({
      alt: z
        .string()
        .describe(
          'SEO-optimized alt text combining artwork essence with mockup context (target 130 chars max)'
        ),
      filename: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .describe(
          'SEO-friendly filename slug without extension (lowercase, hyphens only, target 80 chars max)'
        ),
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
  <objectif>Générer un alt text SEO optimisé + nom de fichier pour une image mockup lifestyle</objectif>
</context>

<situation>
  Tu as une œuvre murale (${productTypeFr}) photographiée dans un cadre lifestyle (mockup).
  Tu DOIS générer un texte alternatif et un nom de fichier qui combinent l'essence de l'œuvre avec le contexte mockup.
</situation>

<input_data>
  Tu RECEVRAS les informations suivantes :
  - **mainAlt** : Alt text de l'œuvre principale (${productTypeFr} seul)
  - **description** : Description HTML du produit
  - **title** : Titre du produit
  - **tags** : Tags sélectionnés pour le produit
  - **collectionTitle** : Titre de la collection
  - **productType** : Type de produit (${productType})
  - **mockupContext** : Description du contexte lifestyle (ex: "dans un salon moderne", "au-dessus d'un canapé gris")
</input_data>

<task>
  Génère un alt text et un filename qui :

  1. **Reprennent l'essence de l'œuvre** (sujet, style, couleurs principales)
  2. **Intègrent naturellement le contexte mockup** (lieu, mobilier, ambiance)
  3. **Incluent le mot-clé SEO principal** : "${productTypeKeyword}" ou "${productTypeKeyword} décoratif"
  4. **Sont fluides et descriptifs** (style informatif et commercial)
  5. **Respectent les limites** (alt: 130 chars max, filename: 80 chars max)
</task>

<guidelines>
  <alt_text>
    – Ne JAMAIS commencer par "image de", "photo de", "représentation de"
    – Utiliser des prépositions naturelles : dans, pour, au-dessus de, accroché dans
    – Privilégier les mots-clés du mainAlt (surtout les premiers mots)
    – Inclure "${productTypeKeyword}" ou sa variante
    – Style conversationnel, fluide, pas robotique
    – Rester informatif ET commercial
    – MAX 130 caractères
  </alt_text>

  <filename>
    – Généré depuis l'alt text
    – Format : lowercase, hyphens uniquement
    – Regex validation : ^[a-z0-9-]+$
    – MAX 80 caractères
    – Commencer par "${productTypeKeyword}-" si possible
  </filename>
</guidelines>

<examples type="${productType}">
  <example>
    <input>
      mainAlt: "${productTypeFr} lion noir et blanc style graphique"
      mockupContext: "dans un salon industriel"
      collectionTitle: "Animaux"
    </input>
    <output>
      {
        "alt": "${productTypeFr} lion noir et blanc pour décoration murale salon industriel",
        "filename": "${productTypeKeyword}-lion-noir-blanc-salon-industriel"
      }
    </output>
  </example>

  <example>
    <input>
      mainAlt: "${productTypeFr} abstrait couleurs vives géométrique"
      mockupContext: "au-dessus d'un canapé gris"
      collectionTitle: "Abstrait"
    </input>
    <output>
      {
        "alt": "${productTypeFr} abstrait couleurs vives décoration salon moderne canapé",
        "filename": "${productTypeKeyword}-abstrait-couleurs-vives-salon-moderne"
      }
    </output>
  </example>

  <example>
    <input>
      mainAlt: "${productTypeFr} cerisier japonais rose style aquarelle"
      mockupContext: "pour décoration chambre zen"
      collectionTitle: "Nature"
    </input>
    <output>
      {
        "alt": "${productTypeFr} cerisier japonais rose aquarelle décoration chambre zen",
        "filename": "${productTypeKeyword}-cerisier-japonais-rose-chambre-zen"
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
