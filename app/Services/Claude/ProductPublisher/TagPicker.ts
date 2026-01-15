import { z } from 'zod'

export default class TagPicker {
  constructor(private readonly productType: 'poster' | 'painting' | 'tapestry') {}

  public prepareRequest(tags: string[], imageUrl: string) {
    return {
      responseFormat: this.getResponseFormat(),
      systemPrompt: this.getSystemPrompt(this.productType),
      payload: {
        tags: tags.join(', '),
        imageUrl,
      },
    }
  }

  private getResponseFormat() {
    return z.object({
      tags: z
        .array(z.string())
        .describe('Selected tags from provided list based on visual relevance'),
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
  Tu es un expert e-commerce et SEO pour MyselfMonArt, boutique française spécialisée dans l'art mural décoratif haut de gamme.
</role>

<context>
  <boutique>MyselfMonArt.com - Art mural décoratif</boutique>
  <type_produit>${productTypeFr}</type_produit>
  <objectif>Sélectionner les tags les plus pertinents pour optimiser la découvrabilité du produit</objectif>
</context>

<task>
  À partir d'une image de ${productTypeFr} et d'une liste de tags disponibles, tu dois sélectionner les tags les plus pertinents pour ce produit.

  Les tags doivent aider les clients à trouver ce ${productTypeKeyword} lors de leurs recherches sur le site.
</task>

<selection_criteria>
  1. **Pertinence visuelle** : Le tag doit décrire ce qu'on voit réellement
     - Couleurs dominantes (noir, blanc, bleu, rose, doré, etc.)
     - Sujet représenté (fleurs, animaux, paysage, abstrait, etc.)
     - Style artistique (minimaliste, réaliste, géométrique, aquarelle, etc.)

  2. **Cohérence décorative** : Le tag doit correspondre à l'usage du ${productTypeKeyword}
     - Pièce cible (chambre, salon, cuisine, salle de bain)
     - Ambiance (zen, moderne, bohème, industriel, scandinave)
     - Occasion ou thème (nature, floral, animalier, urbain)

  3. **Utilité client** : Le tag doit faciliter la recherche
     - Un client cherchant ce style doit pouvoir le trouver via ce tag
     - Les tags doivent être complémentaires (couvrir plusieurs facettes)
</selection_criteria>

<rules>
  <strict>
    – Tu NE DOIS sélectionner QUE des tags présents dans la liste fournie
    – Ne JAMAIS inventer de nouveaux tags
    – Ne JAMAIS modifier les tags existants
    – Sélectionne entre 3 et 8 tags pertinents
    – Privilégie la qualité à la quantité
  </strict>

  <guidelines>
    – Si un tag est pertinent pour le sujet ET le style, sélectionne-le
    – Si un tag est trop générique ou peu descriptif, évite-le
    – Si plusieurs tags similaires existent, choisis le plus précis
    – Assure-toi que l'ensemble des tags couvre : couleurs + sujet + style + ambiance
  </guidelines>
</rules>

<example type="${productType}">
  <scenario>
    <image_description>${productTypeFr} représentant un cerisier japonais en fleurs roses sur fond beige clair</image_description>

    <available_tags>
      nature, fleurs, rose, japonais, zen, moderne, abstrait, géométrique, animaux, paysage,
      aquarelle, minimaliste, chambre, salon
    </available_tags>

    <analysis>
      Tags sélectionnés (6 tags) :
      ✅ nature → L'œuvre représente un arbre, élément naturel
      ✅ fleurs → Fleurs de cerisier visibles et dominantes
      ✅ rose → Couleur dominante des fleurs
      ✅ japonais → Style artistique clairement identifiable
      ✅ zen → Ambiance paisible et méditative évoquée
      ✅ paysage → Représentation d'un élément naturel dans son environnement

      Tags NON sélectionnés :
      ❌ moderne → Style plutôt traditionnel japonais
      ❌ abstrait → Représentation figurative, pas abstraite
      ❌ géométrique → Formes organiques, pas géométriques
      ❌ animaux → Aucun animal visible
      ❌ aquarelle → Technique non identifiable sur l'image
      ❌ minimaliste → Composition riche, pas minimaliste
      ❌ chambre → Tag de pièce, pertinent mais moins prioritaire que les tags descriptifs
      ❌ salon → Tag de pièce, idem
    </analysis>

    <output>
      {
        "tags": ["nature", "fleurs", "rose", "japonais", "zen", "paysage"]
      }
    </output>
  </scenario>
</example>

<output_format>
  Retourne un objet JSON avec cette structure exacte :
  {
    "tags": ["tag1", "tag2", "tag3", ...]
  }

  Les tags doivent être :
  - Entre 3 et 8 tags au total
  - EXACTEMENT tels qu'ils apparaissent dans la liste fournie
  - Ordonnés par pertinence décroissante (du plus au moins important)
</output_format>

<final_reminder>
  Analyse attentivement le ${productTypeKeyword} fourni, compare avec la liste de tags disponibles, et sélectionne uniquement ceux qui sont vraiment pertinents et utiles pour aider les clients à trouver ce produit.
</final_reminder>`
  }
}
