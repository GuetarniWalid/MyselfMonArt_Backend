import type { LanguageCode } from 'Types/Translation'
import type { MetaobjectToTranslate, MetaobjectToTranslateFormatted } from 'Types/Metaobject'
import MetaobjectToTranslateValidator from 'App/Validators/MetaobjectToTranslateValidator'
import { validator } from '@ioc:Adonis/Core/Validator'
import { z } from 'zod'
import ProductTranslator from '../Product'
import English from '../Product/English'

export default class MetaobjectTranslator {
  private targetLanguage: LanguageCode
  private payload: MetaobjectToTranslate
  private languageHandler: English | undefined

  constructor(payload: MetaobjectToTranslate, targetLanguage: LanguageCode) {
    this.targetLanguage = targetLanguage
    this.payload = payload

    const productTranslator = new ProductTranslator(payload, targetLanguage)
    this.languageHandler = productTranslator.getLanguageHandler()
  }

  public async verifyPayloadValidity(payload: unknown) {
    const isValidMetaobject = await this.isValidMetaobjectForTranslation(payload)
    if (!isValidMetaobject) {
      throw new Error('data format is not valid for translation')
    }
  }

  private async isValidMetaobjectForTranslation(payload: unknown) {
    try {
      await validator.validate({
        schema: new MetaobjectToTranslateValidator().schema,
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

    if (this.payload.type === 'radio_container') {
      schema.title = z.string()
    }

    if (this.payload.type === 'popup' && this.payload.field?.key === 'title') {
      schema.title = z.string()
    }

    if (this.payload.type === 'popup' && this.payload.field?.key === 'description') {
      schema.description = z.string()
    }

    if (this.payload.type === 'custom_media' && this.payload.field?.key === 'alt') {
      schema.alt = z.string()
    }

    return z.object(schema)
  }

  private getPayloadFormattedForTranslation(): MetaobjectToTranslateFormatted {
    const payload = {} as MetaobjectToTranslateFormatted

    if (this.payload.type === 'radio_container') {
      payload.title = this.payload.field.jsonValue
    }

    if (this.payload.type === 'popup' && this.payload.field?.key === 'title') {
      payload.title = this.payload.field.jsonValue
    }

    if (this.payload.type === 'popup' && this.payload.field?.key === 'description') {
      payload.description = this.payload.field.jsonValue
    }

    if (this.payload.type === 'custom_media' && this.payload.field?.key === 'alt') {
      payload.alt = this.payload.field.jsonValue
    }

    return payload
  }

  private getTranslationSystemPrompt() {
    const language = this.getLanguageFromISOCode()

    return `You are a professional translation model specialized in e-commerce product content, especially in the field of decorative wall art (canvas, posters, prints). Your task is to translate texts accurately while preserving their meaning, tone, and formatting.

Important rules:

Always translate the French word “tableau” as "wall art", "artwork", or "canvas", depending on context, never as "chart" or "table".

When a dimension like "30x40 cm" or "100 x 100 cm" is mentioned with “tableau”, interpret it as a physical decorative artwork, not as a chart or size guide.

Translate with SEO in mind: use natural, frequently searched terms in ${language}, particularly in the context of home decor and wall art.

For HTML content, preserve all HTML tags and only translate the visible text.

Ensure translations are natural, user-friendly, and culturally adapted to the target market, while optimizing for common search terms in the wall decor niche. Maintain consistency and avoid overly literal translations.`
  }

  public formatTranslationResponse({
    response,
    payload,
  }: {
    response: Partial<MetaobjectToTranslateFormatted>
    payload: MetaobjectToTranslate
  }): MetaobjectToTranslate {
    const responseFormatted = {} as MetaobjectToTranslate

    responseFormatted.id = payload.id

    if (payload.type === 'painting_option' && payload.field?.jsonValue) {
      responseFormatted.field = {} as MetaobjectToTranslate['field']
      responseFormatted.field.jsonValue =
        this.languageHandler?.translateOptionValue(payload.field.jsonValue) ??
        payload.field.jsonValue
    }

    if (payload.type === 'radio_container' && response.title) {
      responseFormatted.field = {} as MetaobjectToTranslate['field']
      responseFormatted.field.jsonValue = response.title
    }

    if (payload.type === 'popup' && response.title) {
      responseFormatted.field = {} as MetaobjectToTranslate['field']
      responseFormatted.field.jsonValue =
        this.languageHandler?.translateSizeInText(response.title) ?? response.title
    }

    if (payload.type === 'popup' && response.description) {
      responseFormatted.field = {} as MetaobjectToTranslate['field']
      responseFormatted.field.jsonValue =
        this.languageHandler?.translateSizeInText(response.description) ?? response.description
    }

    if (payload.type === 'custom_media' && response.alt) {
      responseFormatted.field = {} as MetaobjectToTranslate['field']
      responseFormatted.field.jsonValue =
        this.languageHandler?.translateSizeInText(response.alt) ?? response.alt
    }

    return responseFormatted
  }
}
