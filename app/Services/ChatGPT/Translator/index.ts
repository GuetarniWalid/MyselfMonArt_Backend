import type { LanguageCode, TranslatableContent } from 'Types/Translation'
import type { ProductToTranslate } from 'Types/Product'
import { zodResponseFormat } from 'openai/helpers/zod'
import Authentication from '../Authentication'
import ProductTranslator from './Product'

export default class Translator extends Authentication {
  private translationHandler: ProductTranslator

  constructor(
    payload: Partial<ProductToTranslate>,
    resources: 'product' | 'collection',
    targetLanguage: LanguageCode
  ) {
    super()
    switch (resources) {
      case 'product':
        this.translationHandler = new ProductTranslator(payload, targetLanguage)
        break
    }
  }

  public async translate<T extends TranslatableContent>(payload: T) {
    try {
      await this.translationHandler.verifyPayloadValidity(payload)

      const { responseFormat, payloadFormatted, systemPrompt } =
        this.translationHandler.prepareTranslationRequest()

      const completion = await this.openai.beta.chat.completions.parse({
        model: 'gpt-4o-2024-08-06',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: JSON.stringify(payloadFormatted) },
        ],
        response_format: zodResponseFormat(responseFormat, 'translation'),
      })
      const response = completion.choices[0]

      if (response.finish_reason === 'length') {
        throw new Error('ChatGPT did not return a complete translation')
      } else if (response.message.refusal) {
        throw new Error(
          `ChatGPT refused to translate for the following reason: ${response.message.refusal}`
        )
      } else if (!response.message.parsed) {
        throw new Error('ChatGPT did not return a valid translation')
      }

      return this.translationHandler.formatTranslationResponse({
        response: response.message.parsed,
        payload,
      })
    } catch (error) {
      console.error('Error during translation: ', error)
      throw new Error('Failed to translate text')
    }
  }
}
