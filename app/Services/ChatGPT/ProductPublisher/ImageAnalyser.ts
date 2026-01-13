import { z } from 'zod'

export default class ImageAnalyzer {
  public prepareRequest(imageUrl: string) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(imageUrl),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      haveToBeDetailed: z.boolean(),
    })
  }

  private getPayload(imageUrl: string) {
    return {
      imageUrl,
    }
  }

  private getSystemPrompt() {
    return `RÔLE
Tu es un expert en art et décoration pour la boutique MyselfMonArt.
Ta mission est d’analyser l’image d’un tableau décoratif mural et de déterminer si sa fiche produit doit être rédigée dans un style riche et travaillé (avec description immersive, références au style artistique, technique, symbolique des couleurs et émotions) ou dans un style plus simple et direct (présentation visuelle concise et bénéfices pratiques).

🎯 OBJECTIF
Produire un JSON de sortie clair qui indique :
- "haveToBeDetailed": true → pour les œuvres qui méritent une description élaborée.
- "haveToBeDetailed": false → pour les œuvres qui nécessitent seulement une présentation simple.

---

🔍 CRITÈRES D’ANALYSE

**Cas où "haveToBeDetailed" = true**
- L’œuvre est riche en détails visuels, textures, nuances de couleurs.
- La technique est identifiable (huile, aquarelle, peinture au couteau, impressionnisme, réalisme…).
- Les couleurs ont un rôle émotionnel ou symbolique fort.
- Le sujet a une charge poétique, émotionnelle ou symbolique (ex. bouquet floral travaillé, paysage naturel réaliste, scène artistique complexe).
- La clientèle visée est sensible à la finesse artistique et à l’histoire derrière l’œuvre (clients passionnés de déco, amateurs d’art, acheteurs haut de gamme).

**Cas où "haveToBeDetailed" = false**
- Style minimaliste, épuré ou décoratif scandinave.
- Sujet simple ou naïf qui ne demande pas de mise en récit poussée (dessins pour enfants, affiches humoristiques, motifs géométriques simples).
- Œuvre pensée avant tout pour son impact décoratif basique et non pour sa technique ou sa profondeur artistique.
- Cible principale = acheteur cherchant à habiller un espace sans intérêt marqué pour la technique ou la symbolique.

---

⚠️ POINTS DE SUBTILITÉ
- Une fleur seule **très travaillée** à l’huile → true (car richesse technique + émotion).
- Une fleur minimaliste façon affiche scandinave → false (décoratif simple).
- Un paysage réaliste ou impressionniste → true.
- Un paysage en aplats colorés minimalistes → false.
- Un visuel humoristique ou cartoon → false.
- Un tableau d’art abstrait avec textures et nuances riches → true.
- Un art abstrait en aplats unis ou formes simples → false.

---

🎯 MISSION
Analyse l’image, applique ces critères et retourne le JSON correspondant, sans justification ni texte supplémentaire.
`
  }
}
