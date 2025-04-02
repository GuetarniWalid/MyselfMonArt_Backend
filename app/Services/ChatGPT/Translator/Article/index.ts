import type { LanguageCode } from 'Types/Translation'
import type { ArticleToTranslate, ArticleToTranslateFormatted } from 'Types/Article'
import ArticleToTranslateValidator from 'App/Validators/ArticleToTranslateValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import { z } from 'zod'

export default class ArticleTranslator {
  private targetLanguage: LanguageCode
  private payload: Partial<ArticleToTranslate>

  constructor(payload: Partial<ArticleToTranslate>, targetLanguage: LanguageCode) {
    this.targetLanguage = targetLanguage
    this.payload = payload
  }

  public async verifyPayloadValidity(payload: unknown) {
    const isValidArticle = await this.isValidArticleForTranslation(payload)
    if (!isValidArticle) {
      throw new Error('data format is not valid for translation')
    }
  }

  private async isValidArticleForTranslation(payload: unknown) {
    try {
      await validator.validate({
        schema: new ArticleToTranslateValidator().schema,
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
    if (this.payload.summary) {
      schema.summary = z.string()
    }
    if (this.payload.body) {
      schema.body = z.string()
    }
    if (this.payload.handle) {
      schema.handle = z.string()
    }
    if (this.payload.image?.altText) {
      schema.imageAltText = z.string()
    }

    return z.object(schema)
  }

  private getPayloadFormattedForTranslation(): ArticleToTranslateFormatted {
    const payload = {} as ArticleToTranslateFormatted

    if (this.payload.title) {
      payload.title = this.payload.title
    }
    if (this.payload.summary) {
      payload.summary = this.payload.summary
    }
    if (this.payload.body) {
      payload.body = this.payload.body
    }
    if (this.payload.handle) {
      payload.handle = this.payload.handle
    }
    if (this.payload.image?.altText) {
      payload.imageAltText = this.payload.image.altText
    }

    return payload
  }

  private getTranslationSystemPrompt() {
    const language = this.getLanguageFromISOCode()

    return `You are a professional translation model specializing in e-commerce product data. Your task is to translate blog article data accurately while maintaining the tone, context, and formatting. 
When translating, prioritize SEO optimization by using the most commonly searched keywords and phrases in ${language}, rather than direct word-for-word translation. 
Ensure all fields, including title, description, SEO metadata, and image alt text, are optimized for search engines in ${language} while maintaining a natural, user-friendly tone. 
For the descriptionHtml field, preserve all HTML tags while translating its content. Use your knowledge of linguistic and cultural nuances to produce a high-quality translation that aligns with local search behaviors and preferences`
  }

  public formatTranslationResponse({
    response,
    payload,
  }: {
    response: Partial<ArticleToTranslateFormatted>
    payload: Partial<ArticleToTranslate>
  }): Partial<ArticleToTranslate> {
    const responseFormatted = {} as Partial<ArticleToTranslate>

    responseFormatted.id = payload.id
    if (response.title) {
      responseFormatted.title = response.title
    }
    if (response.summary) {
      responseFormatted.summary = response.summary
    }
    if (response.body) {
      responseFormatted.body = response.body
    }
    if (response.handle) {
      responseFormatted.handle = response.handle
    }
    if (response.imageAltText) {
      responseFormatted.image = {
        id: payload.image!.id,
        altText: response.imageAltText,
      }
    }

    return responseFormatted
  }
}
