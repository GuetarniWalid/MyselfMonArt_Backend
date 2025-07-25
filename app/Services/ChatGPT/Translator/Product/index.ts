import type { LanguageCode, RegionCode } from 'Types/Translation'
import type { ProductToTranslate, ProductToTranslateFormatted } from 'Types/Product'
import ProductToTranslateValidator from 'App/Validators/ProductToTranslateValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import { z } from 'zod'
import English from './English'

export default class ProductTranslator {
  private targetLanguage: LanguageCode
  private targetRegion?: RegionCode
  private payload: Partial<ProductToTranslate>

  constructor(
    payload: Partial<ProductToTranslate>,
    targetLanguage: LanguageCode,
    targetRegion?: RegionCode
  ) {
    this.targetLanguage = targetLanguage
    this.targetRegion = targetRegion
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
    if (this.payload.productType) {
      schema.productType = z.string()
    }
    if (this.payload.seo?.title) {
      schema.metaTitle = z.string()
    }
    if (this.payload.seo?.description) {
      schema.metaDescription = z.string()
    }
    if (this.payload.media?.alts) {
      schema.mediaAltTexts = z.array(z.string())
    }
    if (this.payload.options?.[0]?.name) {
      schema.option1Name = z.string()
    }
    if (this.payload.options?.[1]?.name) {
      schema.option2Name = z.string()
    }
    if (this.payload.options?.[2]?.name) {
      schema.option3Name = z.string()
    }

    return z.object(schema)
  }

  private getPayloadFormattedForTranslation(): ProductToTranslateFormatted {
    const payload = {} as ProductToTranslateFormatted

    if (this.payload.title) {
      payload.title = this.payload.title
    }
    if (this.payload.descriptionHtml) {
      payload.descriptionHtml = this.payload.descriptionHtml
    }
    if (this.payload.handle) {
      payload.handle = this.payload.handle
    }
    if (this.payload.productType) {
      payload.productType = this.payload.productType
    }
    if (this.payload.seo?.title) {
      payload.metaTitle = this.payload.seo.title
    }
    if (this.payload.seo?.description) {
      payload.metaDescription = this.payload.seo.description
    }
    if (this.payload.media?.alts) {
      payload.mediaAltTexts = this.payload.media.alts
    }
    if (this.payload.options?.[0]?.name) {
      payload.option1Name = this.payload.options[0].name
    }
    if (this.payload.options?.[1]?.name) {
      payload.option2Name = this.payload.options[1].name
    }
    if (this.payload.options?.[2]?.name) {
      payload.option3Name = this.payload.options[2].name
    }

    return payload
  }

  private getTranslationSystemPrompt() {
    const language = this.getLanguageFromISOCode()

    return `You are a professional translation model specializing in e-commerce product data. Your task is to translate product data accurately while maintaining the tone, context, and formatting. 
When translating, prioritize SEO optimization by using the most commonly searched keywords and phrases in ${language}, rather than direct word-for-word translation. 
Ensure all fields, including title, description, SEO metadata, and media alt text, are optimized for search engines in ${language} while maintaining a natural, user-friendly tone. 
For the descriptionHtml field, preserve all HTML tags while translating its content. Use your knowledge of linguistic and cultural nuances to produce a high-quality translation that aligns with local search behaviors and preferences`
  }

  public formatTranslationResponse({
    response,
    payload,
  }: {
    response: Partial<ProductToTranslateFormatted>
    payload: Partial<ProductToTranslate>
  }): Partial<ProductToTranslate> {
    const responseFormatted = {} as Partial<ProductToTranslate>

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
    if (response.productType) {
      responseFormatted.productType = response.productType
    }
    if (response.metaTitle || response.metaDescription) {
      responseFormatted.seo = {} as ProductToTranslate['seo']
    }
    if (response.metaTitle) {
      responseFormatted.seo!.title = response.metaTitle
    }
    if (response.metaDescription) {
      responseFormatted.seo!.description = response.metaDescription
    }
    if (response.mediaAltTexts) {
      responseFormatted.media = {
        id: payload.media!.id,
        alts: response.mediaAltTexts,
      }
    }

    responseFormatted.options = payload.options?.map((option, index) => {
      const optionFormatted = {
        id: option.id,
        optionValues:
          option.optionValues?.map((optionValue) => ({
            id: optionValue.id,
            name: this.translateOptionValueByLanguage(optionValue.name),
          })) || [],
      } as { id: string; optionValues: { id: string; name: string }[] } & Partial<
        ProductToTranslate['options'][number]
      >

      if (response.option1Name && index === 0) {
        optionFormatted.name = response.option1Name
      }
      if (response.option2Name && index === 1) {
        optionFormatted.name = response.option2Name
      }
      if (response.option3Name && index === 2) {
        optionFormatted.name = response.option3Name
      }
      return optionFormatted
    })

    if (!responseFormatted.options) {
      delete responseFormatted.options
    }
    return responseFormatted
  }

  private translateOptionValueByLanguage(optionValue: string) {
    const languageHandler = this.getLanguageHandler()
    return languageHandler?.translateOptionValue(optionValue) ?? optionValue
  }

  public getLanguageHandler() {
    switch (this.targetLanguage) {
      case 'en':
        return new English(this.targetRegion)
    }
  }
}
