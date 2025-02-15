import type { LanguageCode } from 'Types/Translation'
import type { ProductToTranslate, ProductToTranslateFormatted } from 'Types/Product'
import ProductToTranslateValidator from 'App/Validators/ProductToTranslateValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import { z } from 'zod'
import English from './English'

export default class ProductTranslator {
  private targetLanguage: LanguageCode
  private payload: ProductToTranslate

  constructor(payload: ProductToTranslate, targetLanguage: LanguageCode) {
    this.targetLanguage = targetLanguage
    this.payload = payload
  }

  public async verifyPayloadValidity(payload: unknown) {
    const isValidProduct = await this.isValidProductForTranslation(payload)
    if (!isValidProduct) {
      throw new Error('data format is not valid for translation')
    }
  }

  private async isValidProductForTranslation(payload: unknown) {
    try {
      await validator.validate({
        schema: new ProductToTranslateValidator().schema,
        data: payload,
      })
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  private getTranslationResponseFormat() {
    return z.object({
      title: z.string(),
      descriptionHtml: z.string(),
      handle: z.string(),
      productType: z.string(),
      metaTitle: z.string(),
      metaDescription: z.string(),
      imageAltTexts: z.array(z.string()),
    })
  }

  private getTranslationSystemPrompt() {
    const language = this.getLanguageFromISOCode()

    return `You are a professional translation model specializing in e-commerce product data. Your task is to translate product data accurately while maintaining the tone, context, and formatting. 
When translating, prioritize SEO optimization by using the most commonly searched keywords and phrases in ${language}, rather than direct word-for-word translation. 
Ensure all fields, including title, description, SEO metadata, and media alt text, are optimized for search engines in ${language} while maintaining a natural, user-friendly tone. 
For the descriptionHtml field, preserve all HTML tags while translating its content. Use your knowledge of linguistic and cultural nuances to produce a high-quality translation that aligns with local search behaviors and preferences`
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

  private getPayloadFormattedForTranslation(): ProductToTranslateFormatted {
    return {
      title: this.payload.title,
      descriptionHtml: this.payload.descriptionHtml,
      handle: this.payload.handle,
      productType: this.payload.productType,
      metaTitle: this.payload.seo.title,
      metaDescription: this.payload.seo.description,
      imageAltTexts: this.payload.media.nodes.map((node) => node.alt),
    }
  }

  public prepareTranslationRequest() {
    return {
      responseFormat: this.getTranslationResponseFormat(),
      payloadFormatted: this.getPayloadFormattedForTranslation(),
      systemPrompt: this.getTranslationSystemPrompt(),
    }
  }

  public formatTranslationResponse({
    response,
    payload,
  }: {
    response: ProductToTranslateFormatted
    payload: ProductToTranslate
  }): ProductToTranslate {
    return {
      ...payload,
      title: response.title,
      descriptionHtml: response.descriptionHtml,
      handle: response.handle,
      productType: response.productType,
      seo: {
        title: response.metaTitle,
        description: response.metaDescription,
      },
      media: {
        nodes: response.imageAltTexts.map((altText, index) => ({
          id: payload.media.nodes[index].id,
          alt: altText,
        })),
      },
      options: payload.options.map((option) => ({
        optionValues: option.optionValues.map((optionValue) => ({
          id: optionValue.id,
          name: this.translateOptionValueByLanguage(optionValue.name),
        })),
      })),
    }
  }

  private translateOptionValueByLanguage(optionValue: string) {
    const languageHandler = this.getLanguageHandler()
    return languageHandler?.translateOptionValue(optionValue) ?? optionValue
  }

  private getLanguageHandler() {
    switch (this.targetLanguage) {
      case 'en':
        return new English()
    }
  }
}
