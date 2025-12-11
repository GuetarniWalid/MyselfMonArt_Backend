import type { Product } from 'Types/Product'
import { schema, rules, validator } from '@ioc:Adonis/Core/Validator'
import { z } from 'zod'

export default class UpdateToWallArtTerminology {
  public async checkData(productData: any) {
    const productSchema = schema.create({
      title: schema.string({ trim: true }, [rules.minLength(5)]),
      handle: schema.string({ trim: true }),
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
      title: z.string(),
      metaTitle: z.string(),
    })
  }

  private formatProduct(product: Product) {
    return {
      title: product.title,
      description: product.description,
      handle: product.handle,
      seo: {
        title: product.seo.title,
      },
      collectionTitle:
        product.metafields.edges.find(
          (metafield) =>
            metafield.node.namespace === 'link' && metafield.node.key === 'mother_collection'
        )?.node.reference?.title ?? null,
    }
  }

  private getSystemPrompt() {
    const title = this.getRandomWallArtTitleReplacement()
    const metaTitle = this.getRandomWallArtMetaTitleReplacement()

    return `CONTEXTE
Je possède une boutique e-commerce spécialisée dans les tableaux décoratifs et l'art mural : MyselfMonArt.
J'ai récemment arrêté de vendre des posters, des cadres en aluminium et des supports en plexiglass.
Désormais, je ne vends QUE des tableaux sur toile.
Tous les titres de produits doivent refléter cette nouvelle orientation et ne plus mentionner "poster", "affiche", "aluminium", "plexiglass" ou "plexi".

OBJECTIF
Mettre à jour les titres et méta-titres pour :
1. Remplacer toute référence à "poster", "affiche", "aluminium", "plexiglass" par une terminologie appropriée pour les tableaux
2. Utiliser une approche mixte combinant la terminologie "peinture/tableau" ET "art mural/décoration murale"
3. Conserver l'essence, le thème et le style évocateur du produit
4. Maintenir la différenciation SEO entre le titre et le méta-titre
5. Garder un langage naturel, fluide et orienté client
6. Si le titre est déjà optimisé, ignorer toutes les étapes precedentes et suivante et ne pas le modifier


PARTIE 1 : TITRE OPTIMISÉ
OBJECTIF :
Remplacer la terminologie obsolète tout en conservant un titre percutant et évocateur qui capte l'attention.

RÈGLES POUR LE TITRE
● Le mot fixe (${title}) est invariable et représente l'art mural / les tableaux décoratifs
● Ne JAMAIS utiliser : "poster", "affiche", "aluminium", "plexiglass", "plexi"
● Conserver le mot-clé principal et l'essence du produit (thème, émotion, sujet)
● Compléter de manière immersive et émotionnelle
● Ne pas dépasser 55 caractères pour garantir lisibilité et impact SEO
● Utiliser un langage fluide, naturel et inspirant

FORMAT DU TITRE
${title} (Mot fixe) + Mot-clé principal du produit + Complément évocateur (max 55 caractères)

EXEMPLES DE TRANSFORMATION:
AVANT: Poster mural - L'élégance mystique d'une geisha
APRÈS: Tableau sur toile – L'élégance mystique d'une geisha

AVANT: Affiche aluminium - Vagues déchaînées, énergie brute
APRÈS: Art mural – L'énergie brute des vagues déchaînées

AVANT: Cadre plexiglass - Lion rugissant majestueux
APRÈS: Toile décorative – L'aura indomptable du lion rugissant


PARTIE 2 : MÉTA-TITRE OPTIMISÉ
OBJECTIF :
Créer un méta-titre différencié du titre, en évitant la répétition des mêmes mots-clés, tout en reflétant l'orientation art mural.

RÈGLES POUR LE MÉTA-TITRE
● Le mot fixe (${metaTitle}) est invariable
● Ne JAMAIS utiliser : "poster", "affiche", "aluminium", "plexiglass", "plexi"
● Utiliser un synonyme ou une reformulation du mot-clé du titre pour éviter la répétition
● Apporter une information complémentaire (bénéfice, émotion, caractéristique)
● Ne pas dépasser 60 caractères pour un affichage optimal sur Google
● Utiliser un langage fluide, naturel et engageant
● Finir par le nom de marque MyselfMonArt

FORMAT DU MÉTA-TITRE
${metaTitle} (Mot fixe) + Synonyme ou variation du mot-clé + Information complémentaire - MyselfMonArt (max 60 caractères)

EXEMPLES DE TRANSFORMATION:
AVANT: Affiche murale - Portrait geisha japonaise - MyselfMonArt
APRÈS: Œuvre murale - Portrait geisha japonaise raffiné - MyselfMonArt

AVANT: Poster mural – Chef-d'œuvre aux teintes éclatantes - MyselfMonArt
APRÈS: Peinture murale – Un tableau aux couleurs vibrantes - MyselfMonArt

AVANT: Cadre aluminium – Bambou zen apaisant - MyselfMonArt
APRÈS: Toile design – Décor bambou pour ambiance relaxante - MyselfMonArt


RÉSUMÉ DES CHANGEMENTS

TERMINOLOGIE À REMPLACER:
❌ Poster, Affiche → ✅ Tableau, Toile, Art mural, Peinture murale
❌ Aluminium, Plexiglass, Plexi → ✅ Toile, Cadre (bois), Décoration murale
❌ Support rigide → ✅ Toile tendue, Canvas

TERMINOLOGIE APPROUVÉE (approche mixte):
✅ Tableau moderne, Tableau sur toile, Toile murale
✅ Art mural, Peinture murale, Décoration murale
✅ Œuvre murale, Création artistique, Toile d'artiste
✅ Cadre décoratif (bois uniquement), Toile décorative

EXEMPLES À ÉVITER:
- Titres qui ne sont pas naturels ou compréhensibles par un client lambda
- Répétition des mêmes mots-clés entre titre et méta-titre
- Langage trop technique ou orienté métier
- Formulations qui ne sonnent pas "humaines"

IMPORTANT:
Conserve l'essence émotionnelle et le thème du produit original. Ne change que la terminologie obsolète.
Si le titre est déjà optimisé, ignorer toutes les étapes precedentes et ne pas le modifier.
`
  }

  private getRandomWallArtTitleReplacement() {
    const replacements = [
      'Tableau moderne',
      'Tableau déco',
      'Tableau design',
      'Grand tableau',
      'Tableau mural',
      'Tableaux déco',
      'Décoration murale',
      'Toile murale',
      'Tableau décoratif',
      'Tableau original',
      'Tableau sur toile',
      'Toile',
      'Toile moderne',
      'Toile déco',
      'Toile design',
      'Tableau toile',
      'Toile décorative',
      'Décor mural',
      'Art mural',
      'Peinture murale',
      'Toile contemporaine',
      'Toile originale',
      'Œuvre murale',
      'Création artistique',
      'Cadre décoratif',
      'Cadre moderne',
      'Cadre design',
      "Toile d'artiste",
      "Tableau d'art",
      'Peinture décorative',
    ]
    return replacements[this.getRandomInt(replacements.length - 1)]
  }

  private getRandomWallArtMetaTitleReplacement() {
    const replacements = [
      "Reproduction d'art",
      'Œuvre murale',
      'Création artistique',
      "Toile d'artiste",
      "Toile d'illustration",
      'Art décoratif mural',
      'Tableau moderne',
      'Tableau déco',
      'Tableau design',
      'Grand tableau',
      'Tableau mural',
      'Tableaux déco',
      'Décoration murale',
      'Toile murale',
      'Tableau décoratif',
      'Tableau original',
      'Tableau sur toile',
      'Toile',
      'Toile moderne',
      'Toile déco',
      'Toile design',
      'Tableau toile',
      'Toile décorative',
      'Décor mural',
      'Art mural',
      'Peinture murale',
      'Toile contemporaine',
      'Toile originale',
      'Cadre moderne',
      'Cadre déco',
      'Cadre design',
      'Cadre décoratif',
      'Peinture décorative',
      "Tableau d'art",
    ]
    return replacements[this.getRandomInt(replacements.length - 1)]
  }

  private getRandomInt(max: number) {
    return Math.floor(Math.random() * (max + 1))
  }
}
