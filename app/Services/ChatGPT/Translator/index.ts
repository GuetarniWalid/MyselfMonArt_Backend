import type { LanguageCode, TranslatableContent } from 'Types/Translation'
import type { ProductToTranslate } from 'Types/Product'
import type { CollectionToTranslate } from 'Types/Collection'
import type { ArticleToTranslate } from 'Types/Article'
import type { PageToTranslate } from 'Types/Page'
import type { ThemeToTranslate } from 'Types/Theme'
import type { Resource } from 'Types/Resource'
import { zodResponseFormat } from 'openai/helpers/zod'
import Authentication from '../Authentication'
import ProductTranslator from './Product'
import CollectionTranslator from './Collection'
import ArticleTranslator from './Article'
import BlogTranslator from './Blog'
import PageTranslator from './Page'
import ThemeTranslator from './Theme'

export default class Translator extends Authentication {
  private translationHandler:
    | ProductTranslator
    | CollectionTranslator
    | ArticleTranslator
    | BlogTranslator
    | PageTranslator
    | ThemeTranslator

  constructor(
    payload:
      | Partial<ProductToTranslate>
      | Partial<CollectionToTranslate>
      | Partial<ArticleToTranslate>
      | Partial<PageToTranslate>,
    resources: Resource,
    targetLanguage: LanguageCode
  ) {
    super()
    switch (resources) {
      case 'product':
        this.translationHandler = new ProductTranslator(payload, targetLanguage)
        break
      case 'collection':
        this.translationHandler = new CollectionTranslator(payload, targetLanguage)
        break
      case 'article':
        this.translationHandler = new ArticleTranslator(payload, targetLanguage)
        break
      case 'blog':
        this.translationHandler = new BlogTranslator(payload, targetLanguage)
        break
      case 'page':
        this.translationHandler = new PageTranslator(payload, targetLanguage)
        break
      case 'theme':
        this.translationHandler = new ThemeTranslator(payload as ThemeToTranslate, targetLanguage)
        break
    }
  }

  public async translate<T extends TranslatableContent>(payload: T) {
    try {
      await this.translationHandler.verifyPayloadValidity(payload)

      const { responseFormat, payloadFormatted, systemPrompt } =
        this.translationHandler.prepareTranslationRequest()

      if (Object.keys(payloadFormatted).length === 0) {
        return this.translationHandler.formatTranslationResponse({
          response: {},
          payload: payload as any,
        })
      }

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
        payload: payload as any,
      })
    } catch (error) {
      console.error('Error during translation: ', error)
      throw new Error('Failed to translate text')
    }
  }
}
