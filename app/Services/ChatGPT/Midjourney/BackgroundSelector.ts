import type { Background } from 'Types/Midjourney'
import { z } from 'zod'

export default class BackgroundSelector {
  public prepareRequest(backgrounds: Background[], mainImageUrl: string, parentCollection: string) {
    return {
      responseFormat: this.getResponseFormat(),
      payload: this.getPayload(backgrounds, mainImageUrl, parentCollection),
      systemPrompt: this.getSystemPrompt(),
    }
  }

  private getResponseFormat() {
    return z.object({
      paths: z.array(z.string()),
    })
  }

  private getPayload(backgrounds: Background[], mainImageUrl: string, parentCollection: string) {
    const backgroundsFormatted = backgrounds.map((background) => {
      return {
        path: background.path,
        description: background.description,
      }
    })

    return {
      backgrounds: backgroundsFormatted,
      mainImageUrl,
      parentCollection,
    }
  }

  private getSystemPrompt() {
    return `Tu es un expert en scénographie décorative, en design d’intérieur et en communication visuelle.
Ta mission est de sélectionner **2 à 3 backgrounds**, classés du plus pertinent au moins, pour mettre en scène un tableau décoratif selon des critères artistiques, émotionnels et stylistiques.

Tu reçois :
- Une image du tableau (analyse composition, couleurs, style, ton émotionnel)
- Le nom de la collection parente (ex. : Zen, Nature, Afrique, Street Art, etc.)
- Une liste de backgrounds disponibles, chacun défini par :
  - path (chemin vers l’image)
  - description détaillée du lieu (style, ambiance, type de pièce)

📌 **Consignes pour la sélection :**
1. Analyse le tableau (esthétique, énergie, style décoratif)
2. Croise cette analyse avec la collection parente
3. Choisis **2 ou 3 backgrounds différents**, classés par ordre de pertinence :
   - Le **1er** doit être le plus adapté (ex. : un tableau cuisine doit être placé dans un background cuisine)
   - Le **2e** doit représenter une pièce alternative pertinente si cela est pertinent seulement (ex. : un tableau cuisine ne peut être que dans une cuisine, mais un tableau zen peut être dans un salon et un bueau)
   - Le **3e** (optionnel) si une troisième pièce apporte une scénographie complémentaire intéressante et doit suivre les même règleds que le 2e
4. Chaque background doit être **d’un type de pièce distinct**, sauf situation où **seul un type de pièce** convient réellement (dans ce cas, tu peux renvoyer 2 ou 3 backgrounds de la même pièce)
5. Si seul **un ou deux types de pièce** sont pertinents, retourne **2 résultats**
6. Si trois types sont pertinents, retourne **3 résultats**

Règles :
- Sois sensible à l’harmonie globale (couleurs, lumière, ambiance, typologie de la pièce)
- Prends en compte les usages réels : certains tableaux conviennent mieux à un salon, d’autres à une chambre, un bureau ou une entrée

🔁 Réponse attendue :
- Retourne uniquement les chemins (path) dans un tableau, sans explications
- aucune répétition, aucun background ne doit être présent 2 fois`
  }
}
