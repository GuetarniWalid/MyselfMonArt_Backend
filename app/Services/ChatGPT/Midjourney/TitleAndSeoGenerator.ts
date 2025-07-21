import { z } from 'zod'

export default class TitleAndSeoGenerator {
  public prepareRequest(imageUrl: string, descriptionHtml: string) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(imageUrl, descriptionHtml),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      title: z.string(),
      metaTitle: z.string(),
      metaDescription: z.string(),
    })
  }

  private getPayload(imageUrl: string, descriptionHtml: string) {
    return {
      imageUrl,
      descriptionHtml,
    }
  }

  private getSystemPrompt() {
    const title = this.getRandomTitleChunk()
    const metaTitle = this.getRandomMetaTitleChunk()

    return `CONTEXTE
Je possède une boutique e-commerce spécialisée dans les tableaux décoratifs : MyselfMonArt.
Affin de résoudre le problème de cannibalisation SEO, les titres des fiches produits et les méta-titres doivent être enrichis et différenciés, tout en respectant les bonnes pratiques SEO et en évitant la répétition des mêmes mots-clés entre le titre et le méta-titre.
Le titre et meta-titre doivent être orientés vers les clients, pas vers les métiers, et doivent être compréhensible par un client lambda.


PARTIE 1 : TITRE OPTIMISÉ
OBJECTIF :
Générer des titres percutants et évocateurs, qui captivent immédiatement l’utilisateur, suscitent une curiosité irrésistible et donnent envie d’en savoir plus, tout en restant SEO-friendly.

RÈGLES POUR LE TITRE
● Le mot fixe (${title}) est invariable et représente un univers du produit : les tableaux de décoration
● Le mot-clé principal doit être identifié à partir de la description et de l'image du produit et mis en avant de manière fluide.
● Compléter le mot fixe de manière immersive et émotionnelle, qui capte l’essence du produit et évoque une image forte.
● Ne pas dépasser 55 caractères pour garantir lisibilité et impact SEO.
● Utiliser un langage fluide, naturel et inspirant, évitant les formulations trop classiques ou génériques.

FORMAT DU TITRE
${title} (Mot fixe) + Mot-clé principal du produit + Complément évocateur (max 55 caractères)

EXEMPLES DE TITRES PUISSANTS:
Tableau sur toile – L’élégance mystique d’une geisha 
Poster mural - Art Contemporain: une explosion de couleurs vibrantes 
Affiche murale - Ambiance Zen: Le souffle apaisant du bambou 
Cadre moderne – L’énergie brute des vagues déchaînées 
Décoration – L’aura indomptable du lion rugissant 
Toile - Minimalisme Chic: Une touche de sérénité absolue



PARTIE 2 : MÉTA-TITRE OPTIMISÉ
OBJECTIF :
Créer des méta-titres différenciés du titre, en évitant la répétition des mêmes mots-clés, tout en optimisant le SEO et le taux de clic (CTR). Le méta-titre doit apporter une information complémentaire sur le produit.

RÈGLES POUR LE MÉTA-TITRE
● Le mot fixe (${metaTitle}) est invariable et ne doit jamais être modifié.
● Le mot-clé principal ne doit pas être identique à celui du titre mais utiliser un synonyme ou une reformulation pour éviter la cannibalisation SEO.
● Apporter une information complémentaire, comme un bénéfice, une émotion, une caractéristique unique ou un support.
● Ne pas dépasser 60 caractères pour un affichage optimal sur Google.
● Utiliser un langage fluide, naturel et engageant, qui évite les répétitions inutiles et capte l’attention de l’utilisateur.
● Finir par le nom de marque MyselfMonArt

FORMAT DU MÉTA-TITRE
${metaTitle} (Mot fixe) + Synonyme ou variation du mot-clé + Information complémentaire - MyselfMonArt (max 60 caractères)

EXEMPLES DE MÉTA-TITRES DIFFÉRENCIÉS DU TITRE

Titre: Tableau Murale – L’élégance mystique d’une geisha 
Méta-Titre: Œuvre murale - Portrait geisha japonaise raffiné - MyselfMonArt

Titre: Art Contemporain – Une explosion de couleurs vibrantes 
Méta-Titre: Peinture Moderne – Un chef-d’œuvre aux teintes éclatantes - MyselfMonArt

Titre: Tableau sur toile – Le souffle apaisant du bambou, ambiance Zen
Méta-Titre: Tableau original – Tableau bambou pour une déco relaxante - MyselfMonArt

Titre: Décor mural – L’énergie brute des vagues déchaînées 
Méta-Titre: Toile design – L’intensité des flots en mouvement - MyselfMonArt

Titre: Grand tableau – L’aura indomptable du lion rugissant 
Méta-Titre: Affiche et poster – La puissance d’un lion en pleine majesté - MyselfMonArt

Titre: Déco – Une touche de sérénité absolue, chic et minimaliste
Méta-Titre: Toile – Élégance et simplicité pour un intérieur zen - MyselfMonArt



RÉSUMÉ DES DIFFÉRENCES ENTRE TITRE ET MÉTA-TITRE

TITRE: 
BUT: Captiver l'utilisateur, donner envie d'en savoir plus
MOT FIXE: ${title} (ne doit jamais être modifié)
MOT-CLÉ: Identifié à partir de la description du 
TONALITÉ: Évocateur, immersif, impactant
LONGUEUR MAX: 55 caractères
EXEMPLE: ${title} - L'élégance mystique d'une geisha - MyselfMonArt


MÉTA-TITRE:
BUT: Optimiser le référencement et le taux de clic sur Google
MOT FIXE: ${metaTitle} (ne doit jamais être modifié)
MOT-CLÉ: Synonyme ou reformulation du mot-clé du titre
TONALITÉ: SEO-friendly, précis et engageant
LONGUEUR MAX: 60 caractères
EXEMPLE: ${metaTitle} - Portrait raffiné inspiré du Japon - MyselfMonArt


EXEMPLE A EVITER:
Il faut évité les titre qui ne veulent rien dire, et qui ne sonnent pas humain. Voici des exemples à éviter:
- Décoratiom murale Épices Orient: Saveurs Vintage => Saveurs Vintage ne veut rien dire, une saveur ne peux pas être vintage
- Saveurs éclatantes => Saveurs éclatantes ne veut rien dire, une saveur ne peux pas être éclatante
- Évasion culinaire vibrante => Évasion culinaire vibrante ne veut rien dire, une évasion culinaire ne peux pas être vibrante
- Raffinement mixologie décorative => Trop complexe, cela doit parler aux clients, pas aux métiers, mixologie est complexe pour un client lambda



PARTIE 3 : MÉTA-DESCRIPTION OPTIMISÉE
OBJECTIF :
Générer une méta-description qui enrichit le contenu du méta-titre, améliore le référencement naturel (SEO) et incite au clic sur Google en répondant aux intentions et émotions du client. Elle doit évoquer l’univers de l’œuvre, ses effets visuels ou émotionnels, et son impact décoratif.

RÈGLES POUR LA MÉTA-DESCRIPTION
● Doit être naturelle, fluide et orientée client, sans excès de mots-clés techniques.
● Mettre en avant un bénéfice clair : ambiance, style, émotion, support, originalité.
● Ne pas répéter mot pour mot le titre ou le méta-titre.
● Intégrer subtilement des expressions synonymes ou du champ lexical lié à l'univers décoratif.
● Ne pas dépasser 155 caractères (idéalement entre 140 et 155) pour un affichage optimal dans les résultats Google.

FORMAT DE LA MÉTA-DESCRIPTION
Une phrase engageante, descriptive et émotionnelle qui donne envie de découvrir l’œuvre. Doit se lire comme un petit teaser de l’univers décoratif proposé.

EXEMPLES DE MÉTA-DESCRIPTIONS OPTIMISÉES :

– Apportez une touche zen et apaisante à votre pièce avec ce tableau inspiré du Japon.
– Mettez de la couleur sur vos murs et donnez du peps à votre déco avec cette œuvre pleine de vie.
– Créez une ambiance calme et naturelle dans votre salon grâce à cette toile aux tons doux.
– Faites entrer l’énergie de l’océan chez vous avec ce visuel puissant et vivant.
– Ajoutez du caractère à votre mur avec ce portrait animal qui impose sa présence
`
  }

  private getRandomTitleChunk() {
    const replacements = [
      'Tableau moderne',
      'Tableau déco',
      'Tableau design',
      'Grand tableau',
      'Tableau mural',
      'Tableaux déco',
      'Décoration',
      'Toile murale',
      'Tableau décoratif',
      'Tableau original',
      'Affiche murale',
      'Tableau sur toile',
      'Toile',
      'Toile moderne',
      'Toile déco',
      'Toile design',
      'Toile murale',
      'Tableau toile',
      'Toile décorative',
      'Décor mural',
      'Affiche et poster',
      'Poster mural',
      'Tableau sur toile',
      'Toile comtemporaine',
      'Toile originale',
      'Tableau sur toile',
      'Décoratiom murale',
      'Affiche',
      'Affiche murale',
      'Poster mural',
      'Poster',
      'Déco',
      'Cadre',
      'Cadre moderne',
      'Cadre déco',
      'Cadre design',
      'Cadre mural',
      'Cadre décoratif',
      'Cadre original',
    ]
    return replacements[this.getRandomInt(replacements.length - 1)]
  }

  private getRandomMetaTitleChunk() {
    const replacements = [
      'Reproduction d’art',
      'Œuvre murale',
      'Création artistique',
      'Estampe moderne',
      'Illustration murale',
      'Affiche artistique',
      'Fresque murale',
      'Sérigraphie d’art',
      'Toile d’artiste',
      'Toile d’illustration',
      'Art graphique mural',
      'Composition artistique',
      'Image imprimée',
      'Art décoratif mural',
      'Tableau moderne',
      'Tableau déco',
      'Tableau design',
      'Grand tableau',
      'Tableau mural',
      'Tableaux déco',
      'Décoration',
      'Toile murale',
      'Tableau décoratif',
      'Tableau original',
      'Affiche murale',
      'Tableau sur toile',
      'Toile',
      'Toile moderne',
      'Toile déco',
      'Toile design',
      'Toile murale',
      'Tableau toile',
      'Toile décorative',
      'Décor mural',
      'Affiche et poster',
      'Poster mural',
      'Tableau sur toile',
      'Toile comtemporaine',
      'Toile originale',
      'Tableau sur toile',
      'Décoratiom murale',
      'Affiche',
      'Affiche murale',
      'Poster mural',
      'Poster',
      'Déco',
      'Cadre',
      'Cadre moderne',
      'Cadre déco',
      'Cadre design',
      'Cadre mural',
      'Cadre décoratif',
      'Cadre original',
    ]
    return replacements[this.getRandomInt(replacements.length - 1)]
  }

  private getRandomInt(max: number) {
    return Math.floor(Math.random() * (max + 1))
  }
}
