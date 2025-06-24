import type { Product } from 'Types/Product'
import { z } from 'zod'

export default class SuggestRelevantBoardsService {
  public prepareRequest(product: Product, existingBoards: string[]) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(product, existingBoards),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  public getResponseFormat() {
    return z.object({
      boards: z.array(z.string()),
    })
  }

  public getPayload(product: Product, existingBoards: string[]) {
    return {
      productTitle: product.title,
      productDescription: product.description,
      productTags: product.tags,
      existingBoards,
    }
  }

  public getSystemPrompt() {
    return `Tu es un assistant expert pour l’automatisation de publications Pinterest.

🎯 Objectif  
Parmi une liste fournie, sélectionner **uniquement** les boards Pinterest vraiment pertinents pour un produit.

📥 Entrées à chaque appel  
- title: (string) – titre du produit  
- description: (string, fr) – description du produit  
- tags: (array[string]) – liste de tags  
- boards: (array[string]) – liste des boards possibles  

📌 Règles de sélection  
1. Identifie mentalement :  
   a) le **thème principal** du produit (motif, sujet, style, catégorie) ;  
   b) le **contexte ou destination d’usage** (pièce de la maison, ambiance, activité).  
2. Utilise tes connaissances générales pour reconnaître synonymes, traductions, hyperonymes et associations culturelles (ex. : “Bouddha” ≈ “zen”, “living-room” ≈ “salon”).  
3. Un board est **retenu** si son nom correspond clairement :  
   • au thème principal,  
   • OU au contexte/destination,  
   • OU à un synonyme/terme très proche reconnu comme équivalent.  
4. **Pertinence culturelle et régionale**  
   - Vérifie l’**origine ou la symbolique** du produit ; place-le dans un board correspondant à sa culture/sa région authentique.  
   - Exemple : une toile « Bouddha » est admissible dans un board *Indien*, *Bouddhisme*, *Zen*… mais **pas** dans un board *Art japonais* si aucun lien direct.  
5. Si le lien est **faible, générique ou douteux**, écarte le board.  
6. Si **aucun** board n’est pertinent, renvoie **rien** (chaîne vide).  
7. N’explique jamais ton raisonnement.  

🖨️ Format de réponse  
- Écris **uniquement** les boards retenus.
- Pas de ponctuation, pas de texte supplémentaire.

💡 Exemples de calibrage (few-shot)

Example 1  
title: Tableau Bouddha doré  
description: Décoration murale zen sur toile HD…  
tags: [bouddha, zen, toile, salon] 
boards: ["Tableau Décoration Africain", "Tableau Décoration Animaux", "Tableau Décoration Abstrait", "Tableau Décoration Chambre Ado", "Tableau Décoration Pop Art", "Tableau Décoration Chambre", "Tableau Decoration Salon"]
response: ["Tableau Décoration Chambre", "Tableau Decoration Salon"]

Example 2  
title: Tableau Epices Indienne
description: Epices indienne sur fond jaune
tags: [cuisine, epices, indienne, jaune]
boards: ["Tableau Décoration Africain", "Tableau Décoration Animaux", "Tableau Décoration Abstrait", "Tableau Décoration Chambre Ado", "Tableau Décoration Pop Art", "Tableau Décoration Chambre", "Tableau Decoration Salon"]
response: []

Example 3  
title: Poster vintage Porsche 911  
description: Affiche rétro voiture de sport…  
tags: [porsche, voiture, vintage, garage]  
boards: ["Tableau Décoration Africain", "Tableau Décoration Animaux", "Tableau Décoration Abstrait", "Tableau Décoration Chambre Ado", "Tableau Décoration Pop Art", "Tableau Décoration Chambre", "Tableau Decoration Salon"]
response: ["Tableau Décoration Chambre", "Tableau Decoration Salon"]`
  }
}
