import type { LanguageCode } from 'Types/Translation'
import type { StaticSectionToTranslate } from 'Types/StaticSection'
import StaticSectionToTranslateValidator from 'App/Validators/StaticSectionToTranslateValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import { z } from 'zod'

export default class StaticSectionTranslator {
  private targetLanguage: LanguageCode
  private payload: StaticSectionToTranslate

  constructor(payload: StaticSectionToTranslate, targetLanguage: LanguageCode) {
    this.targetLanguage = targetLanguage
    this.payload = payload
  }

  public async verifyPayloadValidity(payload: unknown) {
    const isValidStaticSection = await this.isValidStaticSectionForTranslation(payload)
    if (!isValidStaticSection) {
      throw new Error('data format is not valid for translation')
    }
  }

  private async isValidStaticSectionForTranslation(payload: unknown) {
    try {
      await validator.validate({
        schema: new StaticSectionToTranslateValidator().schema,
        data: payload,
      })
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  private getLanguageFromISOCode() {
    switch (this.targetLanguage) {
      case 'es':
        return 'Spanish'
      case 'en':
        return 'English'
      case 'de':
        return 'German'
    }
  }

  public prepareTranslationRequest() {
    return {
      responseFormat: this.getTranslationResponseFormat(),
      payloadFormatted: this.payload,
      systemPrompt: this.getTranslationSystemPrompt(),
    }
  }

  private getTranslationResponseFormat() {
    return z.object({
      value: z.string(),
    })
  }

  private getTranslationSystemPrompt() {
    const language = this.getLanguageFromISOCode()

    return `You are a professional e-commerce translation model specialized in Shopify themes. Your task is to translate UI strings from French to ${language}, with a focus on the context of an online store selling decorative wall art and design-focused products.
    
Each text may be a component of a Shopify theme (promotion banner, paragraphs, titles, menu, buttons, system messages, etc.) and can appear on various pages such as product pages, customer accounts, checkout, articles, blogs, etc.

Your translations must:

Preserve the intended meaning and user experience, even for short or context-lacking texts.

Use natural, localized language appropriate for a professional and friendly e-commerce tone.

Avoid literal translations that may sound awkward or unnatural.

Be adapted to the context of a Shopify store selling decorative wall art and design-focused products.

Be concise, friendly, and action-oriented where applicable (especially for buttons or calls to action).

Respect variables and code placeholders such as {{ count }}, {{ quantity }}, or {{ amount }}. Do not translate or alter these elements.

Maintain HTML structure if present (e.g., <strong>, <em>, <a>).

In cases of ambiguity, choose the most likely interpretation within the context of an e-commerce store specializing in decorative wall art.

Examples:

"Réinitialiser le mot de passe" → "Reset password"

"Voir mon panier ({{ count }})" → "View my cart ({{ count }})"

"Tableau par Pièce" → "Wall Art by Room"

Return only the translated value, without any explanation or additional formatting.`
  }

  public formatTranslationResponse({
    response,
    payload,
  }: {
    response: Partial<StaticSectionToTranslate>
    payload: StaticSectionToTranslate
  }): StaticSectionToTranslate {
    return {
      id: payload.id,
      key: payload.key,
      value: response.value,
    } as StaticSectionToTranslate
  }
}
