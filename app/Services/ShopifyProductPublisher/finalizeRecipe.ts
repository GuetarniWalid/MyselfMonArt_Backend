import Logger from '@ioc:Adonis/Core/Logger'
import DesignTextReader, {
  applyDesignTexts,
  DesignStepInfo,
} from 'App/Services/ShopifyProductPublisher/DesignTextReader'

/**
 * Rend la recette TELLE QU'ELLE SERA ÉCRITE sur le produit : table de remplacement lue sur le
 * design, fragments structurels imposés, élagage cohérent.
 *
 * EXTRAIT de PersonalizedSetup (21/08/2026) pour que le bouton « tester le prompt » du Publisher
 * passe par le MÊME code que la publication. Sans ça, l'aperçu de test mentirait : c'est ici que
 * le titre et les légendes du design sont résolus, et c'est exactement ce qu'il faut éprouver
 * AVANT de publier.
 */

// Rôles des deux images — identiques pour tous les produits, donc imposés en code.
export const PROMPT_IMAGE_ROLES =
  'Two images are attached. IMAGE 1 is the CUSTOMER PHOTO: it is the ONLY source for the subjects — how many they are, their left-to-right order, relative sizes, apparent ages and distinctive features. IMAGE 2 is the STYLE REFERENCE: copy its art style, composition, framing, typography and layout EXACTLY, but never copy its subjects, their faces or its words.'
export const PROMPT_COUNT_LINE =
  'The final illustration shows EXACTLY {n} person(s), in this left-to-right order: {tokens}. Render no other person, and no text other than the ones requested below.'

/** Étapes du parcours exposées au lecteur de textes (ni photo ni format : ils n'écrivent rien). */
export function designStepsOf(config: any): DesignStepInfo[] {
  return (config?.steps || [])
    .filter((s: any) => s && s.type !== 'format' && s.type !== 'photo')
    .map((s: any) => ({
      payloadKey: String(s.payloadKey || s.name),
      type: String(s.type),
      titleFr: String((s.title && s.title.fr) || s.name),
    }))
}

/**
 * Copie profonde de la recette, finalisée. `warnings` est enrichi (jamais de throw) : un design
 * illisible laisse la table du préréglage en place et le produit naît en brouillon.
 */
export async function finalizeRecipeFromDesign(input: {
  studioConfig: any
  studioRecipe: any
  referenceBase64: string
  warnings: string[]
}): Promise<any> {
  const recipe = JSON.parse(JSON.stringify(input.studioRecipe))
  const stepsInfo = designStepsOf(input.studioConfig)

  const designTexts = await new DesignTextReader().read(input.referenceBase64, stepsInfo)
  if (designTexts) {
    applyDesignTexts(
      recipe,
      designTexts,
      stepsInfo.map((s) => s.payloadKey),
      input.warnings
    )
    Logger.info(
      'design-texts: title=%s slots=%s template=%s',
      designTexts.title || '—',
      designTexts.slots.length,
      designTexts.titleTemplate || '—'
    )
  } else {
    input.warnings.push(
      'Lecture des textes du design impossible — table de remplacement du préréglage conservée, vérifie le brouillon.'
    )
  }

  // Fragments structurels imposés + élagage cohérent avec la table réellement lue.
  recipe.prompt = recipe.prompt || {}
  recipe.prompt.imageRoles = PROMPT_IMAGE_ROLES
  if (recipe.inputs && recipe.inputs.tokens) {
    recipe.prompt.countLine = PROMPT_COUNT_LINE
  } else {
    delete recipe.prompt.countLine
    delete recipe.prompt.perPerson
    delete recipe.prompt.addExtra
    delete recipe.prompt.removeExtra
    // Le comptage de figures se règle sur les légendes attendues (n = tokens.length). Sans
    // légendes, n vaut 0 : laisser le contrôle actif ferait échouer TOUS les candidats.
    if (recipe.judge && recipe.judge.figureCount) {
      recipe.judge.figureCount = false
      input.warnings.push(
        'Aucune légende par sujet lue sur le design : le comptage de personnages est désactivé pour ce produit.'
      )
    }
  }
  if (!(recipe.inputs && recipe.inputs.title)) {
    delete recipe.prompt.replaceTitle
  }
  return recipe
}
