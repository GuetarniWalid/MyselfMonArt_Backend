import type { Product } from 'Types/Product'
import { schema, rules, validator } from '@ioc:Adonis/Core/Validator'
import { z } from 'zod'

export default class UpdateDescriptionsToWallArt {
  public async checkData(productData: any) {
    const productSchema = schema.create({
      description: schema.string({ trim: true }, [rules.minLength(10)]),
    })

    try {
      await validator.validate({
        schema: productSchema,
        data: productData,
      })
    } catch (error) {
      throw new Error(`❌ Erreurs de validation : ${error.messages}`)
    }
  }

  public prepareRequest(product: Product) {
    return {
      responseFormat: this.getResponseFormat(),
      productFormatted: this.formatProduct(product),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      description: z.string(),
      metaDescription: z.string(),
    })
  }

  private formatProduct(product: Product) {
    return {
      title: product.title,
      description: product.description,
      seo: {
        description: product.seo.description,
      },
    }
  }

  private getSystemPrompt() {
    return `CONTEXTE
Je possède une boutique e-commerce spécialisée dans les tableaux décoratifs et l'art mural : MyselfMonArt.
J'ai récemment arrêté de vendre des posters, des cadres en aluminium et des supports en plexiglass.
Désormais, je ne vends QUE des tableaux sur toile et de l'art mural (peintures murales décoratives).
Toutes les descriptions de produits doivent refléter cette nouvelle orientation et ne plus mentionner "poster", "affiche", "aluminium", "plexiglass" ou "plexi".

OBJECTIF
Mettre à jour les descriptions et méta-descriptions pour :
1. Remplacer toute référence à "poster", "affiche", "aluminium", "plexiglass" par une terminologie appropriée pour l'art mural et les tableaux sur toile
2. Utiliser une approche mixte combinant la terminologie "peinture/tableau/toile" ET "art mural/décoration murale"
3. Conserver le contenu, les caractéristiques, les dimensions et les bénéfices du produit
4. Maintenir un langage naturel, fluide et orienté client
5. Différencier la description produit de la méta-description SEO


PARTIE 1 : DESCRIPTION PRODUIT
OBJECTIF :
Remplacer la terminologie obsolète dans la description tout en conservant les informations importantes du produit.

RÈGLES POUR LA DESCRIPTION
● Ne JAMAIS utiliser : "poster", "affiche", "aluminium", "plexiglass", "plexi"
● Remplacer par : "tableau", "toile", "tableau sur toile", "art mural", "peinture murale", "décoration murale", "œuvre murale"
● Conserver TOUTES les informations sur :
  - Les dimensions du produit
  - Les matériaux (remplacer si obsolètes)
  - Les caractéristiques techniques
  - Les bénéfices pour le client
  - L'ambiance et le style
  - Les conseils d'utilisation
● Maintenir la structure générale de la description originale
● Utiliser un langage naturel, descriptif et engageant
● Ne pas inventer de nouvelles caractéristiques

EXEMPLES DE REMPLACEMENT DANS LES DESCRIPTIONS :

AVANT: "Ce poster en aluminium brossé apporte..."
APRÈS: "Ce tableau mural sur toile apporte..."

AVANT: "Affiche imprimée sur support plexiglass..."
APRÈS: "Tableau sur toile tendue de haute qualité..."

AVANT: "Notre poster décoratif est parfait..."
APRÈS: "Notre tableau décoratif est parfait..."

AVANT: "Support rigide en aluminium garantissant..."
APRÈS: "Toile tendue sur châssis en bois garantissant..."


PARTIE 2 : MÉTA-DESCRIPTION (SEO)
OBJECTIF :
Créer une méta-description optimisée pour les moteurs de recherche, DIFFÉRENTE de la description produit, qui incite au clic.

RÈGLES POUR LA MÉTA-DESCRIPTION
● Longueur stricte : 150-160 caractères maximum
● Ne JAMAIS utiliser : "poster", "affiche", "aluminium", "plexiglass", "plexi"
● Doit être DIFFÉRENTE de la description produit (utiliser des synonymes et reformulations)
● Inclure :
  - Le type de produit (tableau, toile, art mural)
  - Le thème ou sujet principal
  - Un bénéfice clé ou caractéristique unique
  - Un appel à l'action subtil ou une promesse
● Optimisée SEO : mots-clés pertinents mais naturels
● Ton engageant qui donne envie de cliquer
● Finir idéalement par "MyselfMonArt" si possible dans la limite de caractères

EXEMPLES DE MÉTA-DESCRIPTIONS :

DESCRIPTION: "Ce magnifique tableau sur toile représente une geisha japonaise dans toute son élégance. Imprimé en haute définition sur toile de qualité premium..."
MÉTA: "Tableau toile geisha japonaise élégante pour décoration murale. Impression HD, qualité premium. Livraison rapide - MyselfMonArt" (145 caractères)

DESCRIPTION: "Notre art mural contemporain aux couleurs éclatantes transformera votre intérieur. Cette toile moderne de grande taille (120x80cm) crée un point focal..."
MÉTA: "Art mural moderne aux couleurs vibrantes. Toile grand format 120x80cm, effet wow garanti pour votre déco intérieure - MyselfMonArt" (138 caractères)


TERMINOLOGIE À REMPLACER:
❌ Poster, Affiche → ✅ Tableau, Toile, Art mural, Tableau sur toile
❌ Aluminium, Plexiglass, Plexi → ✅ Toile, Toile tendue, Canvas, Châssis bois
❌ Support rigide, Panneau rigide → ✅ Toile tendue sur châssis, Toile montée
❌ Impression sur aluminium → ✅ Impression sur toile, Impression haute définition

TERMINOLOGIE APPROUVÉE :
✅ Tableau sur toile, Toile tendue, Canvas premium
✅ Art mural, Peinture murale, Décoration murale
✅ Œuvre murale, Toile décorative, Tableau décoratif
✅ Châssis en bois, Toile montée sur cadre

IMPORTANT:
- Conserve TOUTES les informations techniques et bénéfices du produit original
- Change uniquement la terminologie obsolète
- La méta-description doit être DISTINCTE de la description (pas un simple copier-coller)
- Respecte strictement la limite de 150-160 caractères pour la méta-description
`
  }
}
