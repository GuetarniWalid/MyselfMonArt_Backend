import type { Product } from 'Types/Product'
import { z } from 'zod'

export default class IsBoardRelevantForProductService {
  public prepareRequest(product: Product, boardName: string) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(product, boardName),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  public getResponseFormat() {
    return z.object({
      isBoardRelevant: z.boolean(),
    })
  }

  public getPayload(product: Product, boardName: string) {
    return {
      productTitle: product.title,
      productDescription: product.description,
      productTags: product.tags,
      boardName,
    }
  }

  public getSystemPrompt() {
    return `Tu es un assistant expert pour l’automatisation de publications Pinterest.

🎯 Objectif  
Déterminer si un board Pinterest est pertinent pour un produit.

📥 Tu reçois à chaque appel :  
- title: (string) – titre du produit  
- description: (string, fr) – description du produit  
- tags: (array[string]) – liste de tags  
- board: (string) – nom du board à tester  

📌 Règles de décision  
1. Identifie mentalement :  
   a) le **thème principal** du produit (motif, sujet, style, catégorie) ;  
   b) le **contexte ou destination d’usage** (pièce de la maison, ambiance, type d’activité).  
2. Utilise tes connaissances générales pour reconnaître synonymes, traductions, hyperonymes et associations culturelles (ex. “Bouddha” ≈ “zen”, “living-room” ≈ “salon”).  
3. Le board est pertinent si **le nom du board correspond clairement** :  
   • soit au thème principal,  
   • soit au contexte/destination,  
   • soit à un synonyme/terme très proche reconnu comme équivalent. 
4. **Pertinence culturelle et régionale**  
   - Vérifie l’**origine ou la symbolique** du produit ; place-le dans un board correspondant à sa culture/sa région authentique.  
   - Exemple : une toile « Bouddha » est admissible dans un board *Indien*, *Bouddhisme*, *Zen*… mais **pas** dans un board *Art japonais* si aucun lien direct. 
5. Si la pertinence n’est **pas évidente**, réponds false.  
6. Ne révèle jamais ton raisonnement. Réponse finale : **true** ou **false** exclusivement, en minuscules, sans ponctuation ni espace.

💡 Exemples de calibrage (few-shot)

Example 1  
title: Tableau Bouddha doré  
description: Décoration murale zen sur toile HD…  
tags: [bouddha, zen, toile, salon]  
board: Salon  → true
board: Toilette → false
board: Chambre → true
board: chambre ado → false

Example 2  
title: Tableau Epices Indienne
description: Epices indienne sur fond jaune
tags: [cuisine, epices, indienne, jaune]
board: Cuisine  → true
board: Chambre  → false
board: Chambre enfant → false
board: Jaune → true

Example 3  
title: Poster vintage Porsche 911  
description: Affiche rétro voiture de sport…  
tags: [porsche, voiture, vintage, garage]  
board: Automobile  → true
board: Salon → true
board: Chambre → true
board: Chambre enfant → false

⚠️ Réponds uniquement par **true** ou **false**.`
  }
}
