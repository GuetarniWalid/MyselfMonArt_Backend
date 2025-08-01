import { z } from 'zod'

export default class TitleAndSeoGenerator {
  public prepareRequest(imageAnalysis: {
    style: string
    elementsVisuels: string[]
    origineCulturelle: string
    courantArtistique: string
    couleurs: string[]
    emotions: string[]
    ambiance: string
  }) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(imageAnalysis),
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

  private getPayload(imageAnalysis: {
    style: string
    elementsVisuels: string[]
    origineCulturelle: string
    courantArtistique: string
    couleurs: string[]
    emotions: string[]
    ambiance: string
  }) {
    return {
      imageAnalysis,
    }
  }

  private getSystemPrompt() {
    const title = this.getRandomTitleChunk()
    const metaTitle = this.getRandomMetaTitleChunk()

    return `CONTEXTE
Boutique e-commerce : MyselfMonArt (tableaux décoratifs).
Objectif : des titres concrets, vendeurs et SEO-friendly, différenciés des méta-titres pour éviter la cannibalisation.
Les mots fixes ${title} et ${metaTitle} sont fournis et ne doivent jamais être modifiés.


ÉTAPE 0 — Analyse rapide (depuis l’image + description):
  - Sujet principal (ex. : poussin, bambou, geisha, lion, calligraphie…).
  - Détail concret obligatoire (≥1) : technique (encre de Chine, aquarelle, acrylique, photographie, collage, art numérique…), style/origine (japonais, berbère, art déco…), matière/support (toile, alu, plexi), couleur dominante (max 2).
  - Mot-clé SEO principal qui commence par “tableau” ou “affiche” (ex. : tableau poussin encre de Chine, affiche cuisine épices).


PARTIE 1 — TITRE OPTIMISÉ
Objectif
Un titre court, clair et vendeur, qui nomme le sujet + 1 détail concret (technique/style/matière/couleur), sans métaphores ni lyrisme.

Règles:
  - ${title} = mot fixe (invariable).
  - Longueur : ≤ 55 caractères (espaces et ponctuation inclus). Cible 45–53.
  - Ponctuation : préférer - et , ; éviter les “: ” si ça fait dépasser.
  - Éviter les listes d’adjectifs : max 1–2 adjectifs utiles.
  - Rejeter les titres qui n’expliquent pas clairement ce qu’on voit.

Format recommandé:
${title} - [mot-clé principal], suivi d’un détail concret (technique/style/matière/couleur), ex.
${title} - tableau [sujet] [détail concret court]
Mots interdits (ou à proscrire en titre):
  - poétique
  - mystique
  - énigmatique
  - indomptable
  - évasion
  - vibrante (au sens figuré)
  - aura
  - chef-d’œuvre (en titre)
  - contemporain
  - sophistication/sophistiqué
  - graphique (comme style)
  - chromatique
  - palette
  - contraste (isolé)
  - structure
  - symétrie/asymétrie
  - impact
  - équilibre (sans contexte)
  - dynamique visuelle
  - transforme l’espace
  - valorise l’intérieur
  - composition audacieuse
  - narration visuelle
  - univers chromatique
  - épure contemporaine.

Auto-contrôle (à exécuter avant de rendre le titre):
  - ≤55 caractères ?
  - Le sujet est-il clairement nommé ?
  - Y a-t-il ≥1 détail concret (technique/style/matière/couleur) ?
  - Le mot-clé commence-t-il par tableau ou affiche ?
  - Aucun mot interdit / aucune métaphore ?
  - Si “non” à l’un des points, régénérer le titre.



PARTIE 2 — MÉTA-TITRE OPTIMISÉ
  Objectif:
  - Différencier du titre (éviter la cannibalisation) avec synonyme/variation et info complémentaire.
  
  Règles:
  - ${metaTitle} = mot fixe (invariable).
  - Longueur : ≤ 60 caractères (espaces inclus).
  - Sujet : garder la même idée mais reformuler (ex. poussin → oisillon si naturel).
  - Info complémentaire (1 seule) : support, formats, impression HD, prêt à accrocher, style/origine, pour [pièce].
  - Terminer par - MyselfMonArt.
  
  Format recommandé:
  ${metaTitle} - [variation mot-clé] [info complémentaire] - MyselfMonArt


PARTIE 3 — MÉTA-DESCRIPTION OPTIMISÉE
Objectif:
  - Inciter au clic avec un bénéfice clair + un détail concret, sans répéter mot pour mot le titre/méta-titre.

Règles:
  - Longueur : 140–155 caractères max.
  - Ton : naturel, orienté client.
  - Contenu : Mettre en avant un bénéfice clair : ambiance, style, émotion, support, originalité.
  - Pas de mots interdits ni de métaphores.
  - Doit être naturelle, fluide et orientée client, sans excès de mots-clés techniques.
  - Ne pas répéter mot pour mot le titre ou le méta-titre.
  - Intégrer subtilement des expressions synonymes ou du champ lexical lié à l'univers décoratif.

Format:
  - Une seule phrase fluide.

SORTIE ATTENDUE (texte brut, 3 lignes):
  - Titre: [ton titre ≤55c]
  - Méta-titre: [ton méta-titre ≤60c, finissant par " - MyselfMonArt"]
  - Méta-description: [ta phrase 140–155c]



RÉSUMÉ DES DIFFÉRENCES ENTRE TITRE ET MÉTA-TITRE

TITRE: 
BUT: Captiver l'utilisateur, donner envie d'en savoir plus
MOT FIXE: ${title} (ne doit jamais être modifié)
MOT-CLÉ: Identifié à partir de la description du 
TONALITÉ: Évocateur, immersif, impactant
LONGUEUR MAX: 55 caractères


MÉTA-TITRE:
BUT: Optimiser le référencement et le taux de clic sur Google
MOT FIXE: ${metaTitle} (ne doit jamais être modifié)
MOT-CLÉ: Synonyme ou reformulation du mot-clé du titre
TONALITÉ: SEO-friendly, précis et engageant
LONGUEUR MAX: 60 caractères


EXEMPLE A EVITER:
Il faut évité les titre qui ne veulent rien dire, et qui ne sonnent pas humain. Voici des exemples à éviter:
- Décoratiom murale Épices Orient: Saveurs Vintage => Saveurs Vintage ne veut rien dire, une saveur ne peux pas être vintage
- Saveurs éclatantes => Saveurs éclatantes ne veut rien dire, une saveur ne peux pas être éclatante
- Évasion culinaire vibrante => Évasion culinaire vibrante ne veut rien dire, une évasion culinaire ne peux pas être vibrante
- Raffinement mixologie décorative => Trop complexe, cela doit parler aux clients, pas aux métiers, mixologie est complexe pour un client lambda



PARTIE 3 : MÉTA-DESCRIPTION OPTIMISÉE
OBJECTIF :
Générer une méta-description qui enrichit le contenu du méta-titre, améliore le référencement naturel (SEO) et incite au clic sur Google en répondant aux intentions et émotions du client. Elle doit évoquer l’univers de l’œuvre, ses effets visuels ou émotionnels, et son impact décoratif.


Astuces pratiques:
  - Si ça dépasse, supprime les articles et privilégie 1 détail concret (technique ou style ou couleur).
  - Pour Chambre d’enfant, ajoute “enfant/bébé” si ça tient.
  - Garde des mots simples : sujet + technique/style + support/couleur = clarté immédiate.`
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
