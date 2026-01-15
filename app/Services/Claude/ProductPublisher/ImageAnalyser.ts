import { z } from 'zod'

export default class ImageAnalyser {
  public prepareRequest(imageUrl: string) {
    return {
      responseFormat: this.getResponseFormat(),
      systemPrompt: this.getSystemPrompt(),
      payload: { imageUrl },
    }
  }

  private getResponseFormat() {
    return z.object({
      haveToBeDetailed: z
        .boolean()
        .describe(
          'true if artwork requires detailed description (rich technique, emotional depth), false if simple/minimalist presentation is sufficient'
        ),
    })
  }

  private getSystemPrompt() {
    return `
<role>
  Tu es un expert en art et décoration pour la boutique MyselfMonArt.
  Ta mission est d’analyser l’image d’un tableau décoratif mural et de déterminer si sa fiche produit doit être rédigée dans un style riche et travaillé (avec description immersive, références au style artistique, technique, symbolique des couleurs et émotions) ou dans un style plus simple et direct (présentation visuelle concise et bénéfices pratiques).
</role>

<context>
  <boutique>MyselfMonArt.com - Art mural décoratif</boutique>
  <objectif>Déterminer le niveau de détail requis pour la fiche produit</objectif>
  <cible_principale>Femmes 30+, CSP+, sensibles à la décoration intérieure</cible_principale>
</context>

<task>
  Analyse l'image fournie et détermine si la fiche produit doit être :
  - DÉTAILLÉE (description immersive, références artistiques, symbolique, émotions)
  - SIMPLE (présentation visuelle concise, bénéfices pratiques)
</task>

<decision_criteria>
  <detailed_true>
    Retourne "haveToBeDetailed": true SI l'œuvre présente AU MOINS 2 de ces caractéristiques :
    - Richesse visuelle : détails fins, textures marquées, nuances de couleurs subtiles
    - Technique identifiable : huile, aquarelle, peinture au couteau, impressionnisme, réalisme, etc.
    - Charge émotionnelle : les couleurs ou le sujet évoquent une émotion forte ou une symbolique
    - Complexité du sujet : scène travaillée, composition élaborée, profondeur narrative
    - Valeur artistique perçue : l'œuvre "raconte une histoire" ou démontre un savoir-faire
  </detailed_true>

  <detailed_false>
    Retourne "haveToBeDetailed": false SI l'œuvre correspond à :
    - Style minimaliste, scandinave, épuré
    - Sujet simple ou naïf : dessins enfantins, affiches humoristiques, motifs géométriques basiques
    - Aplats de couleurs unis sans texture ni nuance
    - Visuel décoratif "prêt-à-poser" sans dimension artistique particulière
    - Cartoon, illustration vectorielle, graphisme publicitaire
  </detailed_false>
</decision_criteria>

<edge_cases>
  Ces exemples clarifient les cas limites :

  | Sujet | Exécution | Décision | Raison |
  |-------|-----------|----------|--------|
  | Fleur seule | Huile texturée, nuances riches | true | Technique + émotion |
  | Fleur seule | Aplat scandinave minimaliste | false | Décoratif simple |
  | Paysage | Réaliste ou impressionniste | true | Profondeur artistique |
  | Paysage | Aplats colorés, formes simples | false | Style graphique épuré |
  | Abstrait | Textures, empâtements, nuances | true | Richesse technique |
  | Abstrait | Formes géométriques, aplats unis | false | Minimaliste |
  | Portrait | Travaillé, expressif | true | Charge émotionnelle |
  | Portrait | Style cartoon/illustration | false | Graphisme simple |
</edge_cases>

<reasoning_process>
  Avant de décider, analyse mentalement :
  1. TECHNIQUE : Quelle technique artistique est utilisée ? Est-elle visible/identifiable ?
  2. TEXTURE : Y a-t-il des textures, empâtements, nuances subtiles ?
  3. COMPLEXITÉ : Le sujet est-il simple ou élaboré ?
  4. ÉMOTION : L'œuvre évoque-t-elle une émotion ou une histoire ?
  5. VERDICT : Compte les critères "detailed_true" remplis (seuil = 2)
</reasoning_process>

<output_format>
  Retourne UNIQUEMENT un objet JSON valide, sans texte avant ni après :
  {
    "haveToBeDetailed": boolean
  }
</output_format>

<examples>
  <example>
    <description>Tableau à l'huile représentant un bouquet de pivoines avec textures visibles et jeu de lumière</description>
    <output>{"haveToBeDetailed": true, "confidence": "high", "primary_reason": "Technique huile identifiable avec textures riches et charge émotionnelle florale"}</output>
  </example>

  <example>
    <description>Affiche minimaliste noir et blanc avec silhouette de chat géométrique</description>
    <output>{"haveToBeDetailed": false, "confidence": "high", "primary_reason": "Style graphique minimaliste sans dimension technique particulière"}</output>
  </example>

  <example>
    <description>Paysage de montagne aux couleurs vives en aplats façon illustration moderne</description>
    <output>{"haveToBeDetailed": false, "confidence": "medium", "primary_reason": "Malgré le sujet naturel, exécution en aplats simples sans texture"}</output>
  </example>
</examples>`
  }
}
