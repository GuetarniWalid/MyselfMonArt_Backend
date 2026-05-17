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
Je possède une boutique e-commerce spécialisée dans les tableaux décoratifs sur toile : MyselfMonArt.
Mon catalogue ne contient QUE des tableaux sur toile (les posters, cadres aluminium et plexiglass ont été retirés depuis longtemps — ce n'est pas l'objet de cette tâche).

PROBLÈME ACTUEL :
Beaucoup de titres et méta-titres existants commencent par des mots qui ne contiennent PAS le mot-clé "Tableau" — par exemple "Art mural", "Œuvre murale", "Création artistique", "Cadre moderne", "Décor mural", "Peinture murale", "Cadeau personnalisé". Ces openers font perdre toute la valeur SEO sur Google : les acheteurs tapent "tableau X" (jamais "art mural X" ou "œuvre murale X"). Conséquence : ces fiches sont invisibles dans les SERP.

OBJECTIF
Migrer ces openers vers "Tableau" ou "Toile" pour récupérer la visibilité Google.
1. Remplacer tout opener qui ne contient PAS "Tableau" ou "Toile" par un opener légitime
2. Conserver le sujet, la référence iconique (Frida Kahlo, Petit Prince, etc.) et l'essence émotionnelle du produit
3. Différencier les produits similaires via le DESCRIPTEUR (la partie après le tiret), JAMAIS via le mot d'ouverture
4. Garder un langage naturel, fluide et orienté client
5. Si le titre est DÉJÀ optimisé (commence par "Tableau" ou "Toile" + sujet), ne pas le modifier


PARTIE 1 : TITRE OPTIMISÉ
OBJECTIF :
Remplacer la terminologie obsolète tout en conservant un titre percutant et évocateur qui capte l'attention ET le mot-clé "tableau" (le plus tapé sur Google).

RÈGLES POUR LE TITRE
● Le mot fixe (${title}) DOIT être en première position du titre (jamais au milieu, jamais à la fin)
● Le mot fixe contient toujours "Tableau" ou "Toile"
● Conserver le sujet principal / la référence iconique (Frida Kahlo, Le Petit Prince, Femme africaine, Calligraphie arabe, etc.) juste après le mot fixe
● Compléter de manière immersive et émotionnelle via un descripteur après le sujet
● Ne pas dépasser 55 caractères
● Utiliser un langage fluide, naturel et inspirant

FORMAT DU TITRE
${title} (mot fixe, toujours en premier) + Sujet/Référence principale + Descripteur évocateur (max 55 caractères)

EXEMPLES DE TRANSFORMATION:
AVANT: Art mural - Prince rêveur, évasion céleste
APRÈS: Tableau Le Petit Prince - Poésie étoilée

AVANT: Œuvre murale Calligraphie arabe – Harmonie spirituelle
APRÈS: Tableau Calligraphie arabe - Harmonie spirituelle

AVANT: Cadre moderne CR7 - Énergie urbaine colorée
APRÈS: Tableau Ronaldo - Énergie urbaine colorée

AVANT: Décor mural Touareg - Méditation au désert
APRÈS: Tableau Touareg - Méditation au désert

AVANT: Création artistique Tête de mort colorée
APRÈS: Tableau Crâne mexicain - Couleurs vibrantes pop art

AVANT: Cadeau Personnalisé Foot Coloré
APRÈS: Tableau personnalisé Football - Prénom et numéro joueur

AVANT: Peinture murale Femme berbère - Éclat authentique
APRÈS: Tableau Femme berbère - Éclat authentique du Maroc


PARTIE 2 : MÉTA-TITRE OPTIMISÉ (CRITIQUE POUR LE SEO)
OBJECTIF :
Créer un méta-titre qui contient le mot-clé exact "Tableau" en première position. C'est le 1er signal vu par Google et les utilisateurs en SERP.

RÈGLES POUR LE MÉTA-TITRE
● Le mot fixe (${metaTitle}) DOIT être "${metaTitle}" et placé en TOUTE PREMIÈRE position
● Structure : ${metaTitle} + Sujet/Référence principale + " - " + Descripteur court + " | MyselfMonArt"
● Le méta-titre PEUT (et doit souvent) reprendre la racine du titre (le sujet/référence). On évite la cannibalization en différenciant via le DESCRIPTEUR, pas en cachant le mot-clé.
● Ne JAMAIS commencer par "Art mural", "Œuvre murale", "Création artistique", "Cadre", "Cadre moderne", "Peinture murale", "Décor mural", "Décoration murale", "Cadeau personnalisé"
● Apporter un descripteur émotionnel court (3-5 mots)
● MAX 60 caractères TOTAL (incluant " | MyselfMonArt" = ~16 chars → reste ~44 chars pour le contenu)
● Se termine TOUJOURS par " | MyselfMonArt" (séparateur PIPE, pas tiret)
● Utiliser un langage fluide, naturel et engageant

FORMAT DU MÉTA-TITRE
${metaTitle} [Sujet/Référence principale] - [Descripteur court] | MyselfMonArt (max 60 caractères)

EXEMPLES DE TRANSFORMATION:
AVANT: Art mural - Prince rêveur, évasion céleste - MyselfMonArt
APRÈS: Tableau Le Petit Prince - Poésie étoilée | MyselfMonArt

AVANT: Œuvre murale Calligraphie arabe - Harmonie spirituelle - MyselfMonArt
APRÈS: Tableau Calligraphie arabe spirituelle | MyselfMonArt

AVANT: Cadre moderne CR7 - Énergie urbaine colorée - MyselfMonArt
APRÈS: Tableau Ronaldo - Énergie urbaine | MyselfMonArt

AVANT: Décor mural - Portrait urbain coloré - MyselfMonArt
APRÈS: Tableau Pop art - Portrait urbain coloré | MyselfMonArt

AVANT: Création artistique Shiba drôle pour WC - MyselfMonArt
APRÈS: Tableau Shiba - Humour pour WC | MyselfMonArt

AVANT: Cadeau Personnalisé Foot - Poster Prénom et Numéro Joueur - MyselfMonArt
APRÈS: Tableau Football personnalisé - Prénom et numéro | MyselfMonArt


RÉSUMÉ DES CHANGEMENTS

OPENERS À REMPLACER (perte SEO du mot-clé "tableau") :
❌ Art mural, Œuvre murale, Création artistique → ✅ Tableau / Toile
❌ Cadre, Cadre moderne, Cadre décoratif, Cadre design → ✅ Tableau / Toile
❌ Peinture murale, Peinture décorative → ✅ Tableau / Toile
❌ Décor mural, Décoration murale → ✅ Tableau / Toile
❌ Cadeau personnalisé → ✅ Tableau personnalisé
❌ Toile d'artiste, Tableau d'art → ✅ Toile / Tableau (formes simples)

OPENERS APPROUVÉS :
✅ Tableau, Tableau moderne, Tableau mural, Tableau sur toile, Tableau décoratif, Tableau original, Grand tableau
✅ Toile, Toile contemporaine, Toile décorative

PRINCIPE ANTI-CANNIBALIZATION SEO :
Plusieurs produits du catalogue peuvent cibler le même sujet (5 Petit Prince, 10 Frida Kahlo, 30 Femme africaine, etc.). La cannibalization SEO se résout en différenciant le DESCRIPTEUR (la partie après le tiret), JAMAIS en variant le mot d'ouverture.

✅ BON pattern (autorité concentrée) :
"Tableau Le Petit Prince - Poésie étoilée | MyselfMonArt"
"Tableau Le Petit Prince - Voyage cosmique | MyselfMonArt"
"Tableau Le Petit Prince - Renard et amitié | MyselfMonArt"

❌ MAUVAIS pattern (autorité dispersée) :
"Tableau Le Petit Prince - Poésie étoilée | MyselfMonArt"
"Art mural Le Petit Prince - Voyage cosmique | MyselfMonArt"
"Œuvre murale Le Petit Prince - Renard et amitié | MyselfMonArt"

EXEMPLES À ÉVITER (forme) :
- Titres qui ne sont pas naturels ou compréhensibles par un client lambda
- Langage trop technique ou orienté métier
- Formulations qui ne sonnent pas "humaines"
- Bourrage de mots-clés sans descripteur émotionnel

IMPORTANT:
Conserve l'essence émotionnelle et le thème du produit original. Ne change que la terminologie obsolète + le mot d'ouverture s'il ne respecte pas les règles.
Si le titre est DÉJÀ optimisé (commence par "Tableau" ou "Toile" + référence + descripteur), ne le modifie pas inutilement.
`
  }

  /**
   * Variantes autorisées pour le mot d'ouverture du H1.
   * Toutes commencent par "Tableau" ou "Toile" (mots-clés que les utilisateurs tapent sur Google).
   * INTERDIT : "Art mural", "Œuvre murale", "Création artistique", "Cadre", "Peinture murale", "Décor mural".
   * Anti-cannibalization : on varie l'ouverture entre produits, MAIS toujours dans la famille du mot-clé.
   */
  private getRandomWallArtTitleReplacement() {
    const replacements = [
      'Tableau',
      'Tableau sur toile',
      'Tableau moderne',
      'Tableau mural',
      'Tableau décoratif',
      'Tableau original',
      'Grand tableau',
      'Toile',
      'Toile contemporaine',
      'Toile décorative',
    ]
    return replacements[this.getRandomInt(replacements.length - 1)]
  }

  /**
   * Pour le metaTitle (60 chars budget serré), on hardcode "Tableau" (mot-clé court).
   * Aucune variation : Google tronque à ~55 chars, on ne peut pas se permettre "Tableau sur toile" (17 chars).
   * Le metaTitle se différencie via le DESCRIPTEUR, pas via le mot d'ouverture.
   */
  private getRandomWallArtMetaTitleReplacement() {
    return 'Tableau'
  }

  private getRandomInt(max: number) {
    return Math.floor(Math.random() * (max + 1))
  }
}
