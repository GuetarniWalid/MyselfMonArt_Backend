import type { LanguageCode } from 'Types/Translation'
import type { PageToTranslate, PageToTranslateFormatted } from 'Types/Page'
import PageToTranslateValidator from 'App/Validators/PageToTranslateValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import { z } from 'zod'

export default class PageTranslator {
  private targetLanguage: LanguageCode
  private payload: Partial<PageToTranslate>

  constructor(payload: Partial<PageToTranslate>, targetLanguage: LanguageCode) {
    this.targetLanguage = targetLanguage
    this.payload = payload
  }

  public async verifyPayloadValidity(payload: unknown) {
    const isValidPage = await this.isValidPageForTranslation(payload)
    if (!isValidPage) {
      throw new Error('data format is not valid for translation')
    }
  }

  private async isValidPageForTranslation(payload: unknown) {
    try {
      await validator.validate({
        schema: new PageToTranslateValidator().schema,
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
      payloadFormatted: this.getPayloadFormattedForTranslation(),
      systemPrompt: this.getTranslationSystemPrompt(),
    }
  }

  private getTranslationResponseFormat() {
    const schema: Record<string, any> = {}

    if (this.payload.title) {
      schema.title = z.string()
    }
    if (this.payload.body) {
      schema.body = z.string()
    }
    if (this.payload.handle) {
      schema.handle = z.string()
    }

    return z.object(schema)
  }

  private getPayloadFormattedForTranslation(): PageToTranslateFormatted {
    const payload = {} as PageToTranslateFormatted

    if (this.payload.title) {
      payload.title = this.payload.title
    }
    if (this.payload.body) {
      payload.body = this.payload.body
    }
    if (this.payload.handle) {
      payload.handle = this.payload.handle
    }

    return payload
  }

  private getTranslationSystemPrompt() {
    const language = this.getLanguageFromISOCode()

    return `You are a professional translation model specializing in e-commerce product data. Your task is to translate page data accurately while maintaining the tone, context, and formatting. 
When translating, prioritize SEO optimization by using the most commonly searched keywords and phrases in ${language}, rather than direct word-for-word translation. 
Ensure all fields, including title, description, SEO metadata, and image alt text, are optimized for search engines in ${language} while maintaining a natural, user-friendly tone. 
For the descriptionHtml field, preserve all HTML tags while translating its content. Use your knowledge of linguistic and cultural nuances to produce a high-quality translation that aligns with local search behaviors and preferences`
  }

  public formatTranslationResponse({
    response,
    payload,
  }: {
    response: Partial<PageToTranslateFormatted>
    payload: Partial<PageToTranslate>
  }): Partial<PageToTranslate> {
    const responseFormatted = {} as Partial<PageToTranslate>

    responseFormatted.id = payload.id
    if (response.title) {
      responseFormatted.title = response.title
    }
    if (response.body) {
      responseFormatted.body = response.body
    }
    if (response.handle) {
      responseFormatted.handle = response.handle
    }

    return responseFormatted
  }
}
