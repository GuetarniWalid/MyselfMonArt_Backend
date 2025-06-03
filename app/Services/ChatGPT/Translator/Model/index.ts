import type { LanguageCode } from 'Types/Translation'
import type { ModelToTranslate } from 'Types/Model'
import ModelToTranslateValidator from 'App/Validators/ModelToTranslateValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import { z } from 'zod'

export default class ModelTranslator {
  private targetLanguage: LanguageCode
  private payload: ModelToTranslate

  constructor(payload: ModelToTranslate, targetLanguage: LanguageCode) {
    this.targetLanguage = targetLanguage
    this.payload = payload
  }

  public async verifyPayloadValidity(payload: unknown) {
    const isValidModel = await this.isValidModelForTranslation(payload)
    if (!isValidModel) {
      throw new Error('data format is not valid for translation')
    }
  }

  private async isValidModelForTranslation(payload: unknown) {
    try {
      await validator.validate({
        schema: new ModelToTranslateValidator().schema,
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
    const schema: Record<string, any> = {}

    if (this.payload.file) {
      schema.file = z.object({
        alt: z.string(),
        fileName: z.string(),
      })
    } else {
      schema.value = z.string()
    }
    return z.object(schema)
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
- Translate the file name if it is a media file and eliminate the extension.

If the meaning is ambiguous, choose the **most likely interpretation in an e-commerce store context**.

Example:
- "Réinitialiser le mot de passe" → "Reset password"
- "Voir mon panier ({{ count }})" → "View my cart ({{ count }})"
- "<p class="pagination md-4">Navigation entre les pages</p>" → "<p class="pagination md-4">Pagination</p>"
- "Quelle-est-la-couleur-la-moins-salissante-pour-une-cuisine.jpg" → "What-is-the-least-dirty-color-for-a-kitchen"

Only return the translated value, no explanation, no additional formatting.
`
  }

  public formatTranslationResponse({
    response,
    payload,
  }: {
    response: Partial<ModelToTranslate>
    payload: ModelToTranslate
  }): ModelToTranslate {
    if (payload.file) {
      return {
        ...payload,
        file: {
          alt: response.file?.alt as string,
          fileName: response.file?.fileName as string,
          oldUrl: payload.file.oldUrl,
          url: payload.file.url,
        },
      }
    }

    return {
      id: payload.id,
      key: payload.key,
      value: this.changeLanguageHrefs(response.value as string),
    } as ModelToTranslate
  }

  private changeLanguageHrefs(value: string) {
    return value.replace(
      /href="https:\/\/www\.myselfmonart\.com\/([^"]+)"/g,
      `href="https://www.myselfmonart.com/${this.targetLanguage}/$1"`
    )
  }
}
