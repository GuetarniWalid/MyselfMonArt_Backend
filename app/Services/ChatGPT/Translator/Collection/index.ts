import type { LanguageCode } from 'Types/Translation'
import type { CollectionToTranslate } from 'Types/Collection'
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

  /**
   * The FAQ metafield (custom.faq) is a JSON array of `{ q, a }` items. We translate
   * it item-by-item (one field per question/answer) and reassemble the JSON ourselves,
   * so the model can never emit malformed JSON that would break the storefront FAQ.
   * Returns the parsed items, or null when the value is absent / not a valid array.
   */
  private getParsedFaqItems(): any[] | null {
    const raw = this.payload.faq?.value
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
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
    if (this.payload.intro?.value) {
      schema.intro = z.string()
    }
    if (this.payload.guide?.value) {
      schema.guide = z.string()
    }
    const faqItems = this.getParsedFaqItems()
    if (faqItems) {
      faqItems.forEach((item, i) => {
        if (typeof item?.q === 'string' && item.q) schema[`faq_q_${i}`] = z.string()
        if (typeof item?.a === 'string' && item.a) schema[`faq_a_${i}`] = z.string()
      })
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

  private getPayloadFormattedForTranslation(): Record<string, string> {
    const payload = {} as Record<string, string>

    if (this.payload.title) {
      payload.title = this.payload.title
    }
    if (this.payload.descriptionHtml) {
      payload.descriptionHtml = this.payload.descriptionHtml
    }
    if (this.payload.intro?.value) {
      payload.intro = this.payload.intro.value
    }
    if (this.payload.guide?.value) {
      payload.guide = this.payload.guide.value
    }
    const faqItems = this.getParsedFaqItems()
    if (faqItems) {
      faqItems.forEach((item, i) => {
        if (typeof item?.q === 'string' && item.q) payload[`faq_q_${i}`] = item.q
        if (typeof item?.a === 'string' && item.a) payload[`faq_a_${i}`] = item.a
      })
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
For the descriptionHtml field, preserve all HTML tags while translating its content. Use your knowledge of linguistic and cultural nuances to produce a high-quality translation that aligns with local search behaviors and preferences.
IMPORTANT — links: translate the visible anchor text, but keep every \`href\` attribute value EXACTLY as in the source. Do NOT translate, localize, or otherwise modify any URL inside an href. URL rewriting is handled separately downstream.
The intro field is the editorial introduction text shown at the top of the collection page. Translate it fully and naturally into ${language}, preserving its tone and line breaks — never return the original text unchanged.
The guide field is an editorial HTML guide shown on the collection page; preserve all HTML tags (and href values, per the rule above) while translating its content into ${language}.
The faq_q_* fields are FAQ questions and faq_a_* fields are FAQ answers (answers may contain HTML — preserve tags and href values). Translate each one naturally and SEO-consciously into ${language}; never return the original text unchanged.`
  }

  public formatTranslationResponse({
    response,
    payload,
  }: {
    response: Record<string, any>
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
    if (response.intro && payload.intro) {
      responseFormatted.intro = {
        id: payload.intro.id,
        value: response.intro,
      }
    }
    if (response.guide && payload.guide) {
      responseFormatted.guide = {
        id: payload.guide.id,
        value: response.guide,
      }
    }
    // Reassemble the FAQ JSON from the per-item translations, starting from the
    // original parsed items so structure/extra keys/order are preserved exactly.
    if (payload.faq) {
      const rebuilt = this.rebuildFaq(payload.faq.value, response)
      if (rebuilt) {
        responseFormatted.faq = { id: payload.faq.id, value: rebuilt }
      }
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

  /**
   * Rebuilds the FAQ JSON string from the original source array + the model's
   * per-item translations (faq_q_i / faq_a_i). Returns null if the source can't be
   * parsed as an array, so a bad payload never overwrites the live metafield.
   */
  private rebuildFaq(sourceValue: string, response: Record<string, any>): string | null {
    let items: any[]
    try {
      const parsed = JSON.parse(sourceValue)
      if (!Array.isArray(parsed)) return null
      items = parsed
    } catch {
      return null
    }

    // Only overlay values the model actually returned AND that differ from the source.
    // If nothing changed (empty response, or the model echoed the source), return null
    // so the caller omits the FAQ entirely — otherwise we'd re-register the untranslated
    // French JSON as the English translation and freeze it (the value===original guard
    // can't catch it because re-serialization changes the bytes).
    let changed = false
    const rebuilt = items.map((item, i) => {
      // Pass non-object entries through verbatim (never spread a string/number/null).
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item
      const next = { ...item }
      const q = response[`faq_q_${i}`]
      const a = response[`faq_a_${i}`]
      if (typeof q === 'string' && q !== item.q) {
        next.q = q
        changed = true
      }
      if (typeof a === 'string' && a !== item.a) {
        next.a = a
        changed = true
      }
      return next
    })

    return changed ? JSON.stringify(rebuilt) : null
  }
}
