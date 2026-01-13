import { z } from 'zod'

export default class ProductTypePicker {
  public prepareRequest(productTypes: string[], imageUrl: string) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(productTypes, imageUrl),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      productType: z.string(),
    })
  }

  private getPayload(productTypes: string[], imageUrl: string) {
    return {
      productTypes: JSON.stringify(productTypes),
      imageUrl,
    }
  }

  private getSystemPrompt() {
    return `🎯 OBJECTIF
Identifier automatiquement le type de produit le plus approprié pour un tableau décoratif, à partir de l'image et des types de produits existants dans la boutique.

Le productType doit servir à :
– Classer l'œuvre dans une catégorie logique et réutilisable
– Permettre aux clients de filtrer et naviguer efficacement
– Créer des collections cohérentes de produits similaires

🧠 LOGIQUE DE SÉLECTION À RESPECTER

1. ANALYSE DES TYPES EXISTANTS
- Examiner d'abord tous les productTypes existants
- Identifier si l'un d'entre eux correspond parfaitement au produit
- Évaluer la pertinence et la spécificité de chaque type

2. CRITÈRES DE SÉLECTION
- **Pertinence thématique** : Le type doit décrire le contenu ou le style de l'œuvre
- **Généricité appropriée** : Assez spécifique pour être utile, assez générique pour regrouper plusieurs produits
- **Cohérence commerciale** : Facilite la navigation et la découverte de produits similaires

3. CRÉATION D'UN NOUVEAU TYPE
Si aucun type existant n'est approprié :
- Créer un nom générique qui peut regrouper plusieurs produits similaires
- Éviter les noms trop spécifiques ou trop génériques
- Privilégier des termes commerciaux et compréhensibles

📥 ENTRÉES
– Image de l'œuvre
– Liste complète des productTypes existants

📤 SORTIE ATTENDUE
– productType : Le type de produit sélectionné ou créé

📝 EXEMPLES

Exemple 1 - Type existant approprié :
Image : Tableau abstrait avec des formes géométriques colorées
Types existants : ["Tableau Abstrait", "Paysage", "Portrait", "Nature Morte", "Art Moderne"]
Résultat : 
{
  "productType": "Tableau Abstrait",
}

Exemple 2 - Nouveau type nécessaire :
Image : Tableau représentant une scène urbaine avec des graffitis
Types existants : ["Tableau Abstrait", "Paysage", "Portrait", "Nature Morte"]
Résultat :
{
  "productType": "Street Art",
}

Exemple 3 - Type trop spécifique à éviter :
Image : Tableau d'un chat noir sur fond jaune
Types existants : ["Tableau Abstrait", "Paysage", "Portrait", "Nature Morte"]
Résultat :
{
  "productType": "Portrait",
}`
  }
}
