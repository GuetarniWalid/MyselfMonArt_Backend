import type { LanguageCode } from 'Types/Translation'
import type { BlogToTranslate, BlogToTranslateFormatted } from 'Types/Blog'
import BlogToTranslateValidator from 'App/Validators/BlogToTranslateValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import { z } from 'zod'

export default class BlogTranslator {
  private targetLanguage: LanguageCode
  private payload: Partial<BlogToTranslate>

  constructor(payload: Partial<BlogToTranslate>, targetLanguage: LanguageCode) {
    this.targetLanguage = targetLanguage
    this.payload = payload
  }

  public async verifyPayloadValidity(payload: unknown) {
    const isValidBlog = await this.isValidBlogForTranslation(payload)
    if (!isValidBlog) {
      throw new Error('data format is not valid for translation')
    }
  }

  private async isValidBlogForTranslation(payload: unknown) {
    try {
      await validator.validate({
        schema: new BlogToTranslateValidator().schema,
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
    if (this.payload.handle) {
      schema.handle = z.string()
    }

    return z.object(schema)
  }

  private getPayloadFormattedForTranslation(): BlogToTranslateFormatted {
    const payload = {} as BlogToTranslateFormatted

    if (this.payload.title) {
      payload.title = this.payload.title
    }
    if (this.payload.handle) {
      payload.handle = this.payload.handle
    }

    return payload
  }

  private getTranslationSystemPrompt() {
    const language = this.getLanguageFromISOCode()

    return `You are a professional translation model specializing in e-commerce product data. Your task is to translate blog data accurately while maintaining the tone, context, and formatting. 
When translating, prioritize SEO optimization by using the most commonly searched keywords and phrases in ${language}, rather than direct word-for-word translation. 
Ensure all fields, including title, description, SEO metadata, and image alt text, are optimized for search engines in ${language} while maintaining a natural, user-friendly tone. 
For the descriptionHtml field, preserve all HTML tags while translating its content. Use your knowledge of linguistic and cultural nuances to produce a high-quality translation that aligns with local search behaviors and preferences`
  }

  public formatTranslationResponse({
    response,
    payload,
  }: {
    response: Partial<BlogToTranslateFormatted>
    payload: Partial<BlogToTranslate>
  }): Partial<BlogToTranslate> {
    const responseFormatted = {} as Partial<BlogToTranslate>

    responseFormatted.id = payload.id
    if (response.title) {
      responseFormatted.title = response.title
    }
    if (response.handle) {
      responseFormatted.handle = response.handle
    }

    return responseFormatted
  }
}
