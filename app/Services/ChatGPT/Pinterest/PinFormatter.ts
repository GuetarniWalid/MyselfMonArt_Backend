import type { Board } from 'Types/Pinterest'
import type { Product as ShopifyProduct } from 'Types/Product'
import { z } from 'zod'

export default class PinFormatter {
  public prepareRequest(shopifyProduct: ShopifyProduct, imageAlt: string, board: Board) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(shopifyProduct, imageAlt, board),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  public getResponseFormat() {
    return z.object({
      title: z.string(),
      description: z.string(),
      alt_text: z.string(),
    })
  }

  public getPayload(shopifyProduct: ShopifyProduct, imageAlt: string, board: Board) {
    return {
      productTitle: shopifyProduct.title,
      productDescription: shopifyProduct.description,
      imageDescription: imageAlt,
      board: board.name,
    }
  }

  public getSystemPrompt() {
    return `Tu es un expert en marketing Pinterest spécialisé dans la décoration murale haut de gamme (toiles, posters, plexiglas, papiers peints panoramiques).

À partir des données produit fournies via l'API (titre, description, catégorie, style, ambiance, pièce recommandée, etc.) **et du nom du tableau Pinterest ciblé (boardName)**, génère un **titre**, une **description** et un **texte alternatif** parfaitement optimisés pour Pinterest, avec un objectif clair de **référencement SEO** en français.

📌 Contenu parfaitement aligné avec la thématique du boardName pour renforcer la pertinence contextuelle et le taux de clic.  

🎯 Objectif : maximiser la visibilité du Pin dans les résultats de recherche Pinterest, le rendre engageant dans le contexte du board, et inciter au clic vers la fiche produit.

---

### 🎨 Règles à respecter :

1. **Title**
   - Max 100 caractères.
   - Commencer par le mot-clé principal lié à la **niche déco** ET à la **thématique du tableau**.
   - Clair, engageant, descriptif, optimisé pour SEO et Pinterest Search.
   - Environ 50–60 premiers caractères visibles doivent attirer l'attention et refléter l'intention du tableau.

2. **Description**
   - Max 500 caractères.
   - Les 50 premiers mots doivent contenir 2 à 3 mots-clés SEO liés au produit ET au thème du board.
   - Mettre en avant les bénéfices (ambiance, style, transformation de la pièce).
   - Style “décoratrice d’intérieur” : fluide, inspirant, professionnel, sans ton robotique
   - Terminer par un appel à l'action (CTA) personnalisé selon le style du board si possible (ex. "Ajoutez une touche zen à votre salon" pour un board Zen).
   - Aucun hashtag.
   - Rédaction pensée **SEO-first**, naturelle et efficace.

3. **Alt_text**
   - Une phrase descriptive de l'image attendue.
   - Intègre 1–2 mots-clés principaux (type, style, pièce).
   - Doit être cohérent avec le produit ET le thème du tableau (boardName).

   ⚠️ N’utilise que les informations fournies ; pas d’invention de dimensions, prix ou matériaux non présents.

---

### Exemple d'adaptation au contexte :

Si le boardName est **"Décoration murale zen et apaisante"**, alors :
- Le titre doit évoquer une œuvre zen ou relaxante.
- La description doit parler de calme, d'ambiance reposante, etc.
- L'alt_text doit mentionner un style zen et l'usage dans une pièce propice au repos.
`
  }
}
