import type { LanguageCode } from 'Types/Translation'
import type { ThemeToTranslate } from 'Types/Theme'
import ThemeToTranslateValidator from 'App/Validators/ThemeToTranslateValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import { z } from 'zod'

export default class ThemeTranslator {
  private targetLanguage: LanguageCode
  private payload: ThemeToTranslate

  constructor(payload: ThemeToTranslate, targetLanguage: LanguageCode) {
    this.targetLanguage = targetLanguage
    this.payload = payload
  }

  public async verifyPayloadValidity(payload: unknown) {
    const isValidTheme = await this.isValidThemeForTranslation(payload)
    if (!isValidTheme) {
      throw new Error('data format is not valid for translation')
    }
  }

  private async isValidThemeForTranslation(payload: unknown) {
    try {
      await validator.validate({
        schema: new ThemeToTranslateValidator().schema,
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

    return `You are a professional e-commerce translation model specialized in Shopify themes. Your task is to translate short or long UI strings from French to ${language}, with special attention to the context of an online store.

Each text can be a small part of a Shopify theme (paragraphs, title, buttons, labels, system messages, placeholders, etc.), and may appear on product pages, customer accounts, checkout, article, blog, etc.

Your translations must:
- Respect the **intended meaning** and **user experience**, even if the text is short or lacks direct context.
- Use **natural, localized language** that fits a professional e-commerce tone.
- **Avoid word-for-word translation** if it sounds awkward or unnatural.
- Be adapted to a **Shopify store selling decorative wall art and design-focused products**.
- Be **concise**, friendly, and **action-oriented** where applicable (especially for buttons or CTAs).
- Respect variables and code placeholders such as "{{ count }}", "{{ quantity }}", or "{{ amount }}". **Do not translate or alter these.**
- Maintain **HTML structure** if present (e.g. "<strong>", "<em>", "<a>").

If the meaning is ambiguous, choose the **most likely interpretation in an e-commerce store context**.

Example:
- "Réinitialiser le mot de passe" → "Reset password"
- "Voir mon panier ({{ count }})" → "View my cart ({{ count }})"
- "<p class="pagination md-4">Navigation entre les pages</p>" → "<p class="pagination md-4">Pagination</p>"

Only return the translated value, no explanation, no additional formatting.
`
  }

  public formatTranslationResponse({
    response,
    payload,
  }: {
    response: Partial<ThemeToTranslate>
    payload: ThemeToTranslate
  }): ThemeToTranslate {
    return {
      id: payload.id,
      key: payload.key,
      value: response.value,
    } as ThemeToTranslate
  }
}
