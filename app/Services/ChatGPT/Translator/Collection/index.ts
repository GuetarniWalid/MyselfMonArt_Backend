import type { LanguageCode } from 'Types/Translation'
import type { CollectionToTranslate, CollectionToTranslateFormatted } from 'Types/Collection'
import CollectionToTranslateValidator from 'App/Validators/CollectionToTranslateValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import { z } from 'zod'

export default class CollectionTranslator {
  private targetLanguage: LanguageCode
  private payload: Partial<CollectionToTranslate>

  constructor(payload: Partial<CollectionToTranslate>, targetLanguage: LanguageCode) {
    this.targetLanguage = targetLanguage
    this.payload = payload
  }

  public async verifyPayloadValidity(payload: unknown) {
    const isValidCollection = await this.isValidCollectionForTranslation(payload)
    if (!isValidCollection) {
      throw new Error('data format is not valid for translation')
    }
  }

  private async isValidCollectionForTranslation(payload: unknown) {
    try {
      await validator.validate({
        schema: new CollectionToTranslateValidator().schema,
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
    if (this.payload.descriptionHtml) {
      schema.descriptionHtml = z.string()
    }
    if (this.payload.handle) {
      schema.handle = z.string()
    }
    if (this.payload.seo?.title) {
      schema.metaTitle = z.string()
    }
    if (this.payload.seo?.description) {
      schema.metaDescription = z.string()
    }
    if (this.payload.image?.altText) {
      schema.imageAltText = z.string()
    }

    return z.object(schema)
  }

  private getPayloadFormattedForTranslation(): CollectionToTranslateFormatted {
    const payload = {} as CollectionToTranslateFormatted

    if (this.payload.title) {
      payload.title = this.payload.title
    }
    if (this.payload.descriptionHtml) {
      payload.descriptionHtml = this.payload.descriptionHtml
    }
    if (this.payload.handle) {
      payload.handle = this.payload.handle
    }
    if (this.payload.seo?.title) {
      payload.metaTitle = this.payload.seo.title
    }
    if (this.payload.seo?.description) {
      payload.metaDescription = this.payload.seo.description
    }
    if (this.payload.image?.altText) {
      payload.imageAltText = this.payload.image.altText
    }

    return payload
  }

  private getTranslationSystemPrompt() {
    const language = this.getLanguageFromISOCode()

    return `You are a professional translation model specializing in e-commerce product data. Your task is to translate collection data accurately while maintaining the tone, context, and formatting. 
When translating, prioritize SEO optimization by using the most commonly searched keywords and phrases in ${language}, rather than direct word-for-word translation. 
Ensure all fields, including title, description, SEO metadata, and image alt text, are optimized for search engines in ${language} while maintaining a natural, user-friendly tone. 
For the descriptionHtml field, preserve all HTML tags while translating its content. Use your knowledge of linguistic and cultural nuances to produce a high-quality translation that aligns with local search behaviors and preferences`
  }

  public formatTranslationResponse({
    response,
    payload,
  }: {
    response: Partial<CollectionToTranslateFormatted>
    payload: Partial<CollectionToTranslate>
  }): Partial<CollectionToTranslate> {
    const responseFormatted = {} as Partial<CollectionToTranslate>

    responseFormatted.id = payload.id
    if (response.title) {
      responseFormatted.title = response.title
    }
    if (response.descriptionHtml) {
      responseFormatted.descriptionHtml = response.descriptionHtml
    }
    if (response.handle) {
      responseFormatted.handle = response.handle
    }
    if (response.metaTitle || response.metaDescription) {
      responseFormatted.seo = {} as CollectionToTranslate['seo']
    }
    if (response.metaTitle) {
      responseFormatted.seo!.title = response.metaTitle
    }
    if (response.metaDescription) {
      responseFormatted.seo!.description = response.metaDescription
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
